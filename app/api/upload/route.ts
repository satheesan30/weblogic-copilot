import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  CLIENT_UPLOAD_PART_BYTES,
  MAX_FILES_PER_REQUEST,
  MAX_UPLOAD_FILE_BYTES,
  sanitizeUploadFilename,
  validateUploadFile,
} from "@/lib/server/upload-limits";
import {
  assembleAndIndexUpload,
  createUploadSession,
  indexFileFromDisk,
  saveUploadPart,
} from "@/lib/server/upload-processor";
import type { StoredDocument } from "@/types/backend";
import { getCurrentSession } from "@/lib/server/auth";

export const runtime = "nodejs";
export const maxDuration = 3600;

/**
 * Small-file convenience path. Large files should use /api/upload/init + /part + /complete.
 */
export async function POST(request: Request) {
  try {
    const session = await getCurrentSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const formData = await request.formData();
    const files = formData.getAll("files").filter((file): file is File => file instanceof File);

    if (!files.length) {
      return NextResponse.json({ error: "No files were uploaded." }, { status: 400 });
    }
    if (files.length > MAX_FILES_PER_REQUEST) {
      return NextResponse.json({ error: `Upload at most ${MAX_FILES_PER_REQUEST} files per request.` }, { status: 400 });
    }

    const indexedDocuments: StoredDocument[] = [];

    for (const file of files) {
      const filename = sanitizeUploadFilename(file.name);
      const validationError = validateUploadFile(filename, file.size);
      if (validationError) {
        return NextResponse.json({ error: validationError }, { status: 400 });
      }

      if (file.size <= CLIENT_UPLOAD_PART_BYTES) {
        const tmpDir = path.join(process.cwd(), ".app-data", "uploads", `direct-${crypto.randomUUID()}`);
        await mkdir(tmpDir, { recursive: true });
        try {
          const filePath = path.join(tmpDir, filename);
          const bytes = Buffer.from(await file.arrayBuffer());
          await writeFile(filePath, bytes);
          const document = await indexFileFromDisk({ filePath, filename, size: file.size, ownerUsername: session.sub });
          indexedDocuments.push(document);
        } finally {
          await rm(tmpDir, { recursive: true, force: true });
        }
        continue;
      }

      const totalParts = Math.ceil(file.size / CLIENT_UPLOAD_PART_BYTES);
      const uploadSession = await createUploadSession({ filename, size: file.size, totalParts, ownerUsername: session.sub });
      const buffer = Buffer.from(await file.arrayBuffer());
      for (let index = 0; index < totalParts; index += 1) {
        const start = index * CLIENT_UPLOAD_PART_BYTES;
        const end = Math.min(start + CLIENT_UPLOAD_PART_BYTES, buffer.length);
        await saveUploadPart(uploadSession.uploadId, index, buffer.subarray(start, end));
      }
      indexedDocuments.push(await assembleAndIndexUpload(uploadSession.uploadId));
    }

    return NextResponse.json({
      documents: indexedDocuments,
      maxFileBytes: MAX_UPLOAD_FILE_BYTES,
      partSize: CLIENT_UPLOAD_PART_BYTES,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upload failed.";
    const isBodyLimit =
      /formdata|boundary|body|10mb|request body/i.test(message) ||
      (error instanceof Error && /formdata|boundary/i.test(String((error as Error & { cause?: Error }).cause?.message || "")));
    return NextResponse.json(
      {
        error: isBodyLimit
          ? "Upload body was truncated. Use chunked upload for large files (up to 1 GB)."
          : message,
      },
      { status: 500 },
    );
  }
}
