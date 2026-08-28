export const MAX_UPLOAD_FILE_BYTES = 1024 * 1024 * 1024; // 1 GB
export const MAX_FILES_PER_REQUEST = 5;
export const CLIENT_UPLOAD_PART_BYTES = 8 * 1024 * 1024; // 8 MB parts
export const EMBED_BATCH_SIZE = 8;
export const ALLOWED_UPLOAD_EXTENSIONS = new Set([
  ".html",
  ".log",
  ".md",
  ".pdf",
  ".properties",
  ".txt",
  ".xml",
  ".out",
  ".trc",
]);

export function sanitizeUploadFilename(filename: string) {
  return filename.replaceAll("\\", "/").split("/").pop()?.replace(/[^\w.\- ()]/g, "_") || "uploaded-file";
}

export function validateUploadFile(filename: string, size: number) {
  const extension = filename.includes(".") ? filename.slice(filename.lastIndexOf(".")).toLowerCase() : "";
  if (!ALLOWED_UPLOAD_EXTENSIONS.has(extension)) {
    return `Unsupported file type '${extension || "unknown"}'. Upload log, txt, md, html, xml, properties, or pdf files.`;
  }
  if (size > MAX_UPLOAD_FILE_BYTES) {
    return `File '${filename}' is too large. Max size is 1 GB.`;
  }
  if (size <= 0) {
    return `File '${filename}' is empty.`;
  }
  return "";
}
