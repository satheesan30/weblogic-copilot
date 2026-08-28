export interface TextChunk {
  index: number;
  lineStart: number;
  lineEnd: number;
  text: string;
}

export type ChunkDocumentType = "MD" | "HTML" | "XML" | "TXT" | "PDF" | "properties" | "log";

export function chunkTextByLines(text: string, maxCharacters: number): TextChunk[] {
  const lines = text.split(/\r\n|\r|\n/);
  const chunks: TextChunk[] = [];
  let currentLines: string[] = [];
  let startLine = 1;
  let currentSize = 0;

  lines.forEach((line, lineIndex) => {
    const lineSize = line.length + 1;
    if (currentLines.length > 0 && currentSize + lineSize > maxCharacters) {
      chunks.push({
        index: chunks.length,
        lineStart: startLine,
        lineEnd: lineIndex,
        text: currentLines.join("\n"),
      });
      currentLines = [];
      startLine = lineIndex + 1;
      currentSize = 0;
    }

    currentLines.push(line);
    currentSize += lineSize;
  });

  if (currentLines.length > 0) {
    chunks.push({
      index: chunks.length,
      lineStart: startLine,
      lineEnd: lines.length,
      text: currentLines.join("\n"),
    });
  }

  return chunks;
}

/** Incremental line chunker for streaming large files without loading everything into memory. */
export class StreamingLineChunker {
  private leftover = "";
  private currentLines: string[] = [];
  private currentSize = 0;
  private startLine = 1;
  private nextLineNumber = 1;
  private chunkIndex = 0;
  private activeSection = "";

  constructor(
    private readonly maxCharacters: number,
    private readonly documentType: ChunkDocumentType = "TXT",
  ) {}

  push(text: string): TextChunk[] {
    const combined = this.leftover + text;
    const parts = combined.split(/\r\n|\r|\n/);
    this.leftover = parts.pop() ?? "";
    const emitted: TextChunk[] = [];

    for (const line of parts) {
      emitted.push(...this.pushLine(line));
    }

    return emitted;
  }

  pushLine(line: string): TextChunk[] {
    const emitted: TextChunk[] = [];
    const lineSize = line.length + 1;
    const section = structuralSection(line, this.documentType);

    // A heading or meaningful FMW XML/HTML element starts a new semantic chunk.
    // Keep the new boundary as the first line of the following chunk.
    if (section && this.currentLines.length > 0) {
      emitted.push(this.flushCurrent(this.nextLineNumber - 1));
    }
    if (this.currentLines.length > 0 && this.currentSize + lineSize > this.maxCharacters) {
      emitted.push(this.flushCurrent(this.nextLineNumber - 1));
    }
    if (!this.currentLines.length && this.activeSection && !section && this.activeSection !== line) {
      this.currentLines.push(this.activeSection);
      this.currentSize += this.activeSection.length + 1;
    }
    this.currentLines.push(line);
    this.currentSize += lineSize;
    if (section) this.activeSection = line;
    this.nextLineNumber += 1;
    return emitted;
  }

  finish(): TextChunk[] {
    const emitted: TextChunk[] = [];
    if (this.leftover.length) {
      emitted.push(...this.pushLine(this.leftover));
      this.leftover = "";
    }
    if (this.currentLines.length) {
      emitted.push(this.flushCurrent(this.nextLineNumber - 1));
    }
    return emitted;
  }

  private flushCurrent(lineEnd: number): TextChunk {
    const chunk: TextChunk = {
      index: this.chunkIndex,
      lineStart: this.startLine,
      lineEnd,
      text: this.currentLines.join("\n"),
    };
    this.chunkIndex += 1;
    this.currentLines = [];
    this.currentSize = 0;
    this.startLine = lineEnd + 1;
    return chunk;
  }
}

function structuralSection(line: string, documentType: ChunkDocumentType) {
  const trimmed = line.trim();
  if (documentType === "MD") return /^#{1,6}\s+\S/.test(trimmed);
  if (documentType === "HTML") return /<h[1-6]\b[^>]*>|<(section|article|main)\b/i.test(trimmed);
  if (documentType === "XML") {
    return /<(domain|server|cluster|jdbc-system-resource|jms-system-resource|app-deployment|soa-infra|composite|service|reference)\b/i.test(trimmed);
  }
  return false;
}

export function getDocumentType(filename: string) {
  const extension = filename.split(".").pop()?.toLowerCase() || "txt";
  if (extension === "pdf") return "PDF";
  if (extension === "md") return "MD";
  if (extension === "html" || extension === "htm") return "HTML";
  if (extension === "xml") return "XML";
  if (extension === "properties") return "properties";
  if (extension === "log" || extension === "out" || extension === "trc") return "log";
  return "TXT";
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}
