import { mkdir, open, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { formatBytes, getDocumentType, StreamingLineChunker, type TextChunk } from "@/lib/server/chunking";
import { getAppConfig } from "@/lib/server/config";
import { embedTexts } from "@/lib/server/embedding-batch";
import { readTextBlocks } from "@/lib/server/text-stream";
import { getDatabase } from "@/lib/server/database";
import { upsertStoredDocument } from "@/lib/server/storage";
import {
  CLIENT_UPLOAD_PART_BYTES,
  EMBED_BATCH_SIZE,
  sanitizeUploadFilename,
  validateUploadFile,
} from "@/lib/server/upload-limits";
import { addChunksToVectorStore, deleteChunksByDocumentId } from "@/lib/server/vector-store";
import type { StoredDocument } from "@/types/backend";

const UPLOAD_ROOT = path.join(process.cwd(), ".app-data", "uploads");
const UPLOAD_SESSION_TTL_MS = 24 * 60 * 60 * 1000;
const UPLOAD_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface UploadSession {
  uploadId: string;
  ownerUsername?: string;
  filename: string;
  size: number;
  totalParts: number;
  receivedParts: number[];
  createdAt: string;
}

function sessionDir(uploadId: string) {
  return path.join(UPLOAD_ROOT, uploadId);
}

function metaPath(uploadId: string) {
  return path.join(sessionDir(uploadId), "meta.json");
}

function partPath(uploadId: string, index: number) {
  return path.join(sessionDir(uploadId), `part-${String(index).padStart(6, "0")}.bin`);
}

function assembledPath(uploadId: string, filename: string) {
  return path.join(sessionDir(uploadId), filename);
}

export async function createUploadSession(input: {
  ownerUsername?: string;
  filename: string;
  size: number;
  totalParts: number;
}): Promise<UploadSession> {
  const filename = sanitizeUploadFilename(input.filename);
  if (!Number.isSafeInteger(input.size)) {
    throw new Error("size must be a whole number of bytes.");
  }
  const validationError = validateUploadFile(filename, input.size);
  if (validationError) throw new Error(validationError);
  if (!Number.isInteger(input.totalParts) || input.totalParts < 1) {
    throw new Error("totalParts must be a positive integer.");
  }
  const expectedParts = Math.ceil(input.size / CLIENT_UPLOAD_PART_BYTES);
  if (input.totalParts !== expectedParts) {
    throw new Error(`totalParts must equal ${expectedParts} for the declared file size.`);
  }

  await cleanupExpiredUploadSessions();
  const uploadId = crypto.randomUUID();
  await mkdir(sessionDir(uploadId), { recursive: true });
  const session: UploadSession = {
    uploadId,
    ownerUsername: input.ownerUsername,
    filename,
    size: input.size,
    totalParts: input.totalParts,
    receivedParts: [],
    createdAt: new Date().toISOString(),
  };
  await writeFile(metaPath(uploadId), JSON.stringify(session, null, 2));
  return session;
}

export async function getUploadSession(uploadId: string) {
  if (!UPLOAD_ID_PATTERN.test(uploadId)) return null;
  try {
    const raw = await readFile(metaPath(uploadId), "utf8");
    return JSON.parse(raw) as UploadSession;
  } catch {
    return null;
  }
}

async function saveUploadSession(session: UploadSession) {
  await writeFile(metaPath(session.uploadId), JSON.stringify(session, null, 2));
}

export async function saveUploadPart(uploadId: string, partIndex: number, bytes: Buffer, ownerUsername?: string) {
  const session = await getUploadSession(uploadId);
  if (!session) throw new Error("Upload session not found.");
  if (ownerUsername && session.ownerUsername !== ownerUsername) throw new Error("Upload session not found.");
  const db = await getDatabase();
  if (db.prepare("SELECT 1 FROM indexing_jobs WHERE upload_id=?").get(uploadId)) throw new Error("Upload is sealed for indexing.");
  if (!Number.isInteger(partIndex) || partIndex < 0 || partIndex >= session.totalParts) {
    throw new Error(`Invalid partIndex ${partIndex}.`);
  }
  const expectedBytes = Math.min(CLIENT_UPLOAD_PART_BYTES, session.size - partIndex * CLIENT_UPLOAD_PART_BYTES);
  if (bytes.length !== expectedBytes) {
    throw new Error(`Invalid part size for index ${partIndex}: expected ${expectedBytes} bytes, got ${bytes.length}.`);
  }

  await writeFile(partPath(uploadId, partIndex), bytes);
  if (!session.receivedParts.includes(partIndex)) {
    session.receivedParts.push(partIndex);
    session.receivedParts.sort((a, b) => a - b);
    await saveUploadSession(session);
  }
  return session;
}

export async function assembleAndIndexUpload(uploadId: string, ownerUsername?: string, options?: IndexOptions): Promise<StoredDocument> {
  const session = await getUploadSession(uploadId);
  if (!session) throw new Error("Upload session not found.");
  if (ownerUsername && session.ownerUsername !== ownerUsername) throw new Error("Upload session not found.");
  if (session.receivedParts.length !== session.totalParts) {
    throw new Error(`Missing parts: received ${session.receivedParts.length}/${session.totalParts}.`);
  }

  const target = assembledPath(uploadId, session.filename);
  await options?.onProgress?.("assembling", 0, options.resumeChunks || 0);
  const handle = await open(target, "w");
  try {
    for (let index = 0; index < session.totalParts; index += 1) {
      const part = await readFile(partPath(uploadId, index));
      let written = 0;
      while (written < part.length) {
        const result = await handle.write(part, written, part.length - written);
        if (!result.bytesWritten) throw new Error("Could not write upload part.");
        written += result.bytesWritten;
      }
      await options?.onProgress?.("assembling", Math.min((index + 1) * CLIENT_UPLOAD_PART_BYTES, session.size), options.resumeChunks || 0);
    }
  } finally {
    await handle.close();
  }

  const info = await stat(target);
  if (info.size !== session.size) {
    throw new Error(`Assembled size mismatch: expected ${session.size}, got ${info.size}.`);
  }

  try {
    return await indexFileFromDisk({
      filePath: target,
      filename: session.filename,
      size: info.size,
      ownerUsername: session.ownerUsername || process.env.WEBLOGIC_COPILOT_USERNAME || "local-admin",
      options,
    });
  } finally {
    if (!options) await rm(sessionDir(uploadId), { recursive: true, force: true });
  }
}

async function cleanupExpiredUploadSessions() {
  try {
    const entries = await readdir(UPLOAD_ROOT, { withFileTypes: true });
    const cutoff = Date.now() - UPLOAD_SESSION_TTL_MS;
    await Promise.all(
      entries
        .filter((entry) => entry.isDirectory() && UPLOAD_ID_PATTERN.test(entry.name))
        .map(async (entry) => {
          const directory = path.join(UPLOAD_ROOT, entry.name);
          const session = await getUploadSession(entry.name);
          const createdAt = session ? Date.parse(session.createdAt) : Number.NaN;
          const db = await getDatabase();
          const job = db.prepare("SELECT 1 FROM indexing_jobs WHERE upload_id = ?").get(entry.name);
          if (!job && (!Number.isFinite(createdAt) || createdAt < cutoff)) {
            await rm(directory, { recursive: true, force: true });
          }
        }),
    );
  } catch {
    // The upload root does not exist until the first session is created.
  }
}

export interface IndexOptions {
  documentId: string;
  resumeChunks: number;
  config: Awaited<ReturnType<typeof getAppConfig>>;
  onProgress: (phase: string, bytes: number, chunks: number) => Promise<void>;
}

export async function removeUploadFiles(uploadId: string) {
  if (!UPLOAD_ID_PATTERN.test(uploadId)) throw new Error("Invalid upload ID.");
  await rm(sessionDir(uploadId), { recursive: true, force: true });
}

export async function indexFileFromDisk(input: {
  filePath: string;
  filename: string;
  size: number;
  ownerUsername: string;
  options?: IndexOptions;
}): Promise<StoredDocument> {
  const config = input.options?.config || await getAppConfig();
  const documentId = input.options?.documentId || crypto.randomUUID();
  const filename = sanitizeUploadFilename(input.filename);
  const chunker = new StreamingLineChunker(config.retrieval.chunkSize, getDocumentType(filename));
  const pending: TextChunk[] = [];
  let chunkCount = input.options?.resumeChunks || 0;
  let bytesRead = 0;
  const writeQueue: Promise<void>[] = [];

  const flush = async () => {
    const batch = pending.splice(0, EMBED_BATCH_SIZE);
    if (!batch.length) return;

    // Pipeline: start embedding, then pipeline the store call
    const promise = (async () => {
      const embeddings = await embedBatch(config, batch);
      await storeBatch(config, documentId, filename, input.ownerUsername, batch, embeddings);
    })();

    writeQueue.push(promise);
    // Limit concurrency to 3 pending batches to avoid overwhelming the vector store
    if (writeQueue.length >= 3) {
      await Promise.all(writeQueue.splice(0, 1));
    }

    chunkCount = batch[batch.length - 1].index + 1;
    await input.options?.onProgress("indexing", bytesRead, chunkCount);
  };

  try {
    for await (const block of readTextBlocks(input.filePath)) {
      bytesRead += block.bytes;
      for (const chunk of chunker.push(block.text)) {
        if (chunk.index < (input.options?.resumeChunks || 0)) continue;
        pending.push(chunk);
        if (pending.length >= EMBED_BATCH_SIZE) await flush();
      }
      // Periodic progress update for large blocks
      await input.options?.onProgress("indexing", bytesRead, chunkCount);
    }
    for (const chunk of chunker.finish()) {
      if (chunk.index >= (input.options?.resumeChunks || 0)) pending.push(chunk);
    }
    while (pending.length) await flush();
    await Promise.all(writeQueue);

    if (!chunkCount) throw new Error("The file contains no indexable text.");
  } catch (error) {
    if (!input.options) await deleteChunksByDocumentId(config, documentId);
    throw error;
  }

  const document: StoredDocument = {
    id: documentId,
    ownerUsername: input.ownerUsername,
    filename,
    type: getDocumentType(filename),
    size: formatBytes(input.size),
    uploadDate: new Date().toLocaleDateString("en", { month: "short", day: "numeric", year: "numeric" }),
    status: "Indexed",
    lineCount: chunker.lineCount,
    chunkCount,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  };
  try { await upsertStoredDocument(document); }
  catch (error) { if (!input.options) await deleteChunksByDocumentId(config, documentId); throw error; }
  return document;
}

async function embedBatch(
  config: Awaited<ReturnType<typeof getAppConfig>>,
  batch: TextChunk[],
) {
  return await embedTexts(config, batch.map(chunk => chunk.text));
}

async function storeBatch(
  config: Awaited<ReturnType<typeof getAppConfig>>,
  documentId: string,
  filename: string,
  ownerUsername: string,
  batch: TextChunk[],
  embeddings: number[],
) {
  const vectorChunks = batch.map((chunk, index) => ({
    id: `${documentId}-${chunk.index}`,
    text: chunk.text,
    embedding: embeddings[index],
    metadata: {
      documentId,
      ownerUsername,
      filename,
      type: getDocumentType(filename),
      lineStart: chunk.lineStart,
      lineEnd: chunk.lineEnd,
      chunkIndex: chunk.index,
    },
  }));

  if (vectorChunks.length) {
    await addChunksToVectorStore(config, vectorChunks);
  }
}

async function embedAndStoreBatch(
  config: Awaited<ReturnType<typeof getAppConfig>>,
  documentId: string,
  filename: string,
  ownerUsername: string,
  batch: TextChunk[],
) {
  const embeddings = await embedBatch(config, batch);
  await storeBatch(config, documentId, filename, ownerUsername, batch, embeddings);
}
