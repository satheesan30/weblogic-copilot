import crypto from "node:crypto";
import path from "node:path";
import { lstat, realpath } from "node:fs/promises";
import { formatBytes } from "@/lib/server/chunking";
import { getAppConfig } from "@/lib/server/config";
import {
  appendLiveAlerts,
  getLiveStream,
  upsertLiveStream,
  type LiveLogAlert,
  type LiveLogStream,
} from "@/lib/server/live-logs/store";
import { triageLogLines } from "@/lib/server/live-logs/triage";
import { addAgentMemory } from "@/lib/server/memory";
import { embedText } from "@/lib/server/ollama";
import { listStoredDocuments, upsertStoredDocument } from "@/lib/server/storage";
import { addChunksToVectorStore } from "@/lib/server/vector-store";
import type { AppConfig, StoredDocument } from "@/types/backend";

interface StreamBuffer {
  lines: string[];
  charCount: number;
  nextLineNumber: number;
}

const buffers = new Map<string, StreamBuffer>();

export interface InjectLogBatchInput {
  streamId: string;
  lines?: string[];
  text?: string;
  filename?: string;
  forceFlush?: boolean;
}

export interface InjectLogBatchResult {
  stream: LiveLogStream;
  acceptedLines: number;
  flushedChunks: number;
  alerts: LiveLogAlert[];
  bufferedChars: number;
}

export async function createLiveStream(input: {
  ownerUsername: string;
  env: string;
  server: string;
  source: "http" | "file";
  filePath?: string;
}): Promise<{ stream: LiveLogStream; ingestToken: string }> {
  const env = input.env.trim();
  const server = input.server.trim();
  if (!env || !server) {
    throw new Error("env and server are required.");
  }
  if (input.source === "file" && !input.filePath?.trim()) {
    throw new Error("filePath is required for file-source streams.");
  }
  const filePath = input.source === "file" ? await approvedTailPath(input.filePath!) : undefined;

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const ingestToken = crypto.randomBytes(32).toString("base64url");
  const filename = `live-${sanitizePart(env)}-${sanitizePart(server)}.log`;
  const stream: LiveLogStream = {
    id,
    ownerUsername: input.ownerUsername,
    env,
    server,
    source: input.source,
    filePath,
    status: "active",
    documentId: id,
    filename,
    lineCount: 0,
    chunkCount: 0,
    bytesIngested: 0,
    lastSeenAt: now,
    createdAt: now,
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    ingestTokenHash: crypto.createHash("sha256").update(ingestToken).digest("hex"),
    ingestTokenCreatedAt: now,
  };

  await upsertLiveStream(stream);
  buffers.set(id, { lines: [], charCount: 0, nextLineNumber: 1 });
  return { stream, ingestToken };
}

export async function injectLogBatch(input: InjectLogBatchInput): Promise<InjectLogBatchResult> {
  const config = await getAppConfig();
  const stream = await getLiveStream(input.streamId);
  if (!stream) {
    throw new Error(`Live log stream '${input.streamId}' was not found.`);
  }
  if (stream.status === "stopped") {
    throw new Error(`Live log stream '${input.streamId}' is stopped.`);
  }

  const incoming = normalizeLines(input.lines, input.text);
  const buffer = buffers.get(stream.id) || { lines: [], charCount: 0, nextLineNumber: stream.lineCount + 1 };
  for (const line of incoming) {
    buffer.lines.push(line);
    buffer.charCount += line.length + 1;
  }
  buffers.set(stream.id, buffer);

  stream.lastSeenAt = new Date().toISOString();
  stream.lineCount += incoming.length;
  stream.bytesIngested += incoming.reduce((sum, line) => sum + line.length + 1, 0);
  stream.status = "active";
  stream.error = undefined;
  await upsertLiveStream(stream);

  const shouldFlush = Boolean(input.forceFlush) || buffer.charCount >= config.retrieval.chunkSize;
  let flushedChunks = 0;
  let alerts: LiveLogAlert[] = [];

  if (shouldFlush && buffer.lines.length) {
    const flushResult = await flushBuffer(config, stream, buffer, input.filename);
    flushedChunks = flushResult.flushedChunks;
    alerts = flushResult.alerts;
  }

  const updated = (await getLiveStream(stream.id)) || stream;
  const currentBuffer = buffers.get(stream.id) || buffer;
  return {
    stream: updated,
    acceptedLines: incoming.length,
    flushedChunks,
    alerts,
    bufferedChars: currentBuffer.charCount,
  };
}

export async function flushLiveStream(streamId: string) {
  return injectLogBatch({ streamId, lines: [], forceFlush: true });
}

async function flushBuffer(
  config: AppConfig,
  stream: LiveLogStream,
  buffer: StreamBuffer,
  filenameOverride?: string,
) {
  const text = buffer.lines.join("\n");
  const lineStart = buffer.nextLineNumber;
  const lineEnd = buffer.nextLineNumber + buffer.lines.length - 1;
  const chunkIndex = stream.chunkCount;
  const chunkId = `${stream.documentId}-${chunkIndex}`;
  const filename = filenameOverride || stream.filename;

  const embedding = await embedText(config, text);
  await addChunksToVectorStore(config, [
    {
      id: chunkId,
      text,
      embedding,
      metadata: {
        documentId: stream.documentId,
        ownerUsername: stream.ownerUsername,
        filename,
        type: "live-log",
        streamId: stream.id,
        env: stream.env,
        server: stream.server,
        lineStart,
        lineEnd,
        chunkIndex,
      },
    },
  ]);

  const hits = triageLogLines(buffer.lines);
  const now = new Date().toISOString();
  const alerts: LiveLogAlert[] = hits.map((hit) => ({
    id: crypto.randomUUID(),
    streamId: stream.id,
    ownerUsername: stream.ownerUsername,
    env: stream.env,
    server: stream.server,
    severity: hit.severity,
    title: hit.title,
    detail: hit.detail,
    matched: hit.matched,
    createdAt: now,
    expiresAt: stream.expiresAt,
  }));
  await appendLiveAlerts(alerts);

  if (config.memory.enabled) {
    for (const alert of alerts.filter((item) => item.severity === "critical" || item.severity === "warn")) {
      await addAgentMemory(config, {
        ownerUsername: stream.ownerUsername,
        content: `[Live Log Agent] ${alert.env}/${alert.server}: ${alert.title} (${alert.matched}). ${alert.detail}`,
        category: "incident",
        source: "system",
      });
    }
  }

  stream.chunkCount += 1;
  await upsertLiveDocument(stream, filename);

  buffer.nextLineNumber = lineEnd + 1;
  buffer.lines = [];
  buffer.charCount = 0;
  buffers.set(stream.id, buffer);
  await upsertLiveStream(stream);

  return { flushedChunks: 1, alerts };
}

async function upsertLiveDocument(stream: LiveLogStream, filename: string) {
  const existing = (await listStoredDocuments(stream.ownerUsername)).find((doc) => doc.id === stream.documentId);
  const document: StoredDocument = {
    id: stream.documentId,
    ownerUsername: stream.ownerUsername,
    filename,
    type: "log",
    size: formatBytes(stream.bytesIngested || 0),
    uploadDate: new Date().toLocaleDateString("en", { month: "short", day: "numeric", year: "numeric" }),
    status: "Indexed",
    lineCount: stream.lineCount,
    chunkCount: stream.chunkCount,
    createdAt: stream.createdAt,
    expiresAt: stream.expiresAt,
  };
  if (existing) {
    document.uploadDate = existing.uploadDate;
  }
  await upsertStoredDocument(document);
}

function normalizeLines(lines?: string[], text?: string) {
  if (Array.isArray(lines) && lines.length) {
    return lines.map((line) => String(line)).filter((line) => line.length > 0 || line === "");
  }
  if (typeof text === "string" && text.length) {
    return text.split(/\r\n|\r|\n/);
  }
  return [];
}

function sanitizePart(value: string) {
  return value.replace(/[^\w.-]+/g, "_").slice(0, 64) || "unknown";
}

async function approvedTailPath(value: string) {
  const configuredRoot = process.env.LIVE_LOG_TAIL_ROOT?.trim();
  if (!configuredRoot) throw new Error("LIVE_LOG_TAIL_ROOT must be configured before local file tailing is enabled.");
  const requested = path.resolve(value);
  const root = await realpath(configuredRoot);
  const resolved = await realpath(requested);
  if (requested !== resolved || (resolved !== root && !resolved.startsWith(`${root}${path.sep}`))) {
    throw new Error("File tail path must be a non-symlink file inside LIVE_LOG_TAIL_ROOT.");
  }
  if ((await lstat(requested)).isSymbolicLink()) throw new Error("Symlinked log files are not allowed.");
  return resolved;
}

export function clearLiveStreamBuffer(streamId: string) {
  buffers.delete(streamId);
}
