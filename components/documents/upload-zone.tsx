"use client";

import { useState } from "react";
import { FileUp, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { StoredDocument } from "@/types/backend";

const supportedTypes = ["PDF", "TXT", "MD", "HTML", "XML", "properties", "log files"];
const PART_SIZE = 8 * 1024 * 1024; // 8 MB
const MAX_FILE_BYTES = 1024 * 1024 * 1024; // 1 GB
const MAX_FILES = 5;

export function UploadZone() {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [files, setFiles] = useState<FileList | null>(null);
  const [uploadedDocuments, setUploadedDocuments] = useState<StoredDocument[]>([]);

  async function handleUpload() {
    if (!files?.length) {
      setStatus("Choose one or more files first.");
      return;
    }
    if (files.length > MAX_FILES) {
      setStatus(`Upload at most ${MAX_FILES} files per batch.`);
      return;
    }

    setLoading(true);
    setStatus("Uploading and indexing documents...");
    const indexed: StoredDocument[] = [];

    try {
      for (const file of Array.from(files)) {
        if (file.size > MAX_FILE_BYTES) {
          throw new Error(`'${file.name}' exceeds 1 GB.`);
        }
        setStatus(`Uploading ${file.name} (${formatSize(file.size)})...`);
        const document = await uploadFileChunked(file, (progress) => {
          setStatus(`Uploading ${file.name}: ${progress}`);
        });
        indexed.push(document);
      }
      setUploadedDocuments(indexed);
      setStatus(`Indexed ${indexed.length} document(s).`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Upload failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="border border-dashed border-line bg-paper p-8 text-center">
      <div className="mx-auto grid h-14 w-14 place-items-center border border-line bg-paper-2 text-forest">
        {loading ? <Loader2 className="h-6 w-6 animate-spin" aria-hidden="true" /> : <FileUp className="h-6 w-6" aria-hidden="true" />}
      </div>
      <h2 className="mt-4 font-display text-lg font-semibold text-ink">Drop WebLogic knowledge files</h2>
      <p className="mx-auto mt-2 max-w-2xl text-sm leading-6 text-ink-soft">
        Upload up to 1 GB per file. Large files are sent in 8 MB parts, then streamed into embedding chunks for RAG.
      </p>
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        {supportedTypes.map((type) => (
          <span className="border border-line bg-paper-2 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-ink-soft" key={type}>
            {type}
          </span>
        ))}
      </div>
      <div className="mt-5 flex flex-col items-center gap-3">
        <input
          className="max-w-full border border-line bg-paper-2 px-3 py-2 text-sm"
          multiple
          onChange={(event) => setFiles(event.target.files)}
          type="file"
        />
        <Button disabled={loading} onClick={handleUpload} type="button">
          {loading ? "Uploading" : "Upload and index"}
        </Button>
      </div>
      {status ? <p className="mt-4 text-sm font-medium text-ink">{status}</p> : null}
      {uploadedDocuments.length ? (
        <div className="mx-auto mt-4 grid max-w-3xl gap-2 text-left">
          {uploadedDocuments.map((document) => (
            <div className="border border-forest/25 bg-forest/10 px-3 py-2 text-sm text-forest-deep" key={document.id}>
              {document.filename} indexed into {document.chunkCount} chunk(s)
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

async function uploadFileChunked(file: File, onProgress: (label: string) => void) {
  const totalParts = Math.max(1, Math.ceil(file.size / PART_SIZE));

  const initResponse = await fetch("/api/upload/init", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ filename: file.name, size: file.size, totalParts }),
  });
  const initPayload = await readJson(initResponse);
  if (!initResponse.ok) throw new Error(initPayload.error || "Could not start upload.");
  const uploadId = String(initPayload.uploadId);

  for (let partIndex = 0; partIndex < totalParts; partIndex += 1) {
    const start = partIndex * PART_SIZE;
    const end = Math.min(start + PART_SIZE, file.size);
    const blob = file.slice(start, end);
    const formData = new FormData();
    formData.append("uploadId", uploadId);
    formData.append("partIndex", String(partIndex));
    formData.append("part", blob, `${file.name}.part${partIndex}`);

    onProgress(`part ${partIndex + 1}/${totalParts}`);
    const partResponse = await fetch("/api/upload/part", { method: "POST", body: formData });
    const partPayload = await readJson(partResponse);
    if (!partResponse.ok) throw new Error(partPayload.error || `Part ${partIndex + 1} failed.`);
  }

  onProgress("assembling and embedding chunks...");
  const completeResponse = await fetch("/api/upload/complete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ uploadId }),
  });
  const completePayload = await readJson(completeResponse);
  if (!completeResponse.ok) throw new Error(completePayload.error || "Indexing failed.");
  return completePayload.document as StoredDocument;
}

async function readJson(response: Response) {
  const raw = await response.text();
  if (!raw.trim()) {
    throw new Error(
      response.ok
        ? "Empty response from server."
        : `Upload failed (${response.status}): empty response. Try a smaller part or refresh.`,
    );
  }
  try {
    return JSON.parse(raw) as Record<string, unknown> & { error?: string; uploadId?: string; document?: StoredDocument };
  } catch {
    throw new Error(`Upload failed (${response.status}): invalid JSON response.`);
  }
}

function formatSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}
