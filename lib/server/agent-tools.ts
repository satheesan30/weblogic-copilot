import { queryAgentMemory } from "@/lib/server/memory";
import { embedText } from "@/lib/server/ollama";
import { queryVectorStore } from "@/lib/server/vector-store";
import type { AppConfig, RetrievedChunk, RetrievedMemory } from "@/types/backend";

export interface EvidenceAssessment {
  sufficient: boolean;
  detail: string;
  signals: number;
  uniqueDocuments: number;
}

export async function searchMemory(config: AppConfig, query: string, ownerUsername: string): Promise<RetrievedMemory[]> {
  return queryAgentMemory(config, query, ownerUsername);
}

export async function searchKnowledge(config: AppConfig, query: string, ownerUsername: string, topK?: number): Promise<RetrievedChunk[]> {
  const queryEmbedding = await embedText(config, query);
  return queryVectorStore(config, queryEmbedding, topK ?? config.retrieval.topK, ownerUsername);
}

export function assessEvidence(chunks: RetrievedChunk[]): EvidenceAssessment {
  if (!chunks.length) {
    return {
      sufficient: false,
      detail: "No document chunks were retrieved.",
      signals: 0,
      uniqueDocuments: 0,
    };
  }

  const combined = chunks.map((chunk) => chunk.text).join("\n").toLowerCase();
  const signals = [
    /\bbea-\d+/.test(combined),
    /\b(exception|error|failed|failure|timeout|stuck)\b/.test(combined),
    /\b\d{4}-\d{2}-\d{2}\b/.test(combined) || /\b\d{2}:\d{2}:\d{2}\b/.test(combined),
    chunks.some((chunk) => chunk.section.toLowerCase().includes("lines")),
  ].filter(Boolean).length;
  const uniqueDocuments = new Set(chunks.map((chunk) => chunk.documentName)).size;
  const sufficient = signals >= 2 || uniqueDocuments >= 2;

  return {
    sufficient,
    detail: `Retrieved ${chunks.length} chunk(s) from ${uniqueDocuments} document(s), evidence signals: ${signals}/4.`,
    signals,
    uniqueDocuments,
  };
}

export function refineQueryFromEvidence(question: string, priorChunks: RetrievedChunk[]): string {
  const evidence = priorChunks
    .slice(0, 4)
    .map((chunk) => `${chunk.documentName} ${chunk.text.slice(0, 600)}`)
    .join("\n");
  const tokens = extractOperationalTokens(`${question}\n${evidence}`);
  return tokens.length ? `${question}\n${tokens.join(" ")}`.slice(0, 1200) : question;
}

function extractOperationalTokens(value: string) {
  const matches = value.match(
    /\bBEA-\d{6}\b|\b(?:ORA|WL|JMS|JDBC)-\d{3,6}\b|\b[A-Za-z_$][\w$]*(?:Exception|Error)\b|\b[A-Za-z][\w.-]*(?:DataSource|JMSModule|Server|Cluster)\b|\b(?:stuck[ -]?thread|connection pool|classloading|SSL handshake|Node Manager)\b/gi,
  );
  return Array.from(new Set(matches?.map((match) => match.trim()) || [])).slice(0, 12);
}

export function mergeChunks(existing: RetrievedChunk[], incoming: RetrievedChunk[]): RetrievedChunk[] {
  const byId = new Map<string, RetrievedChunk>();
  for (const chunk of existing) byId.set(chunk.id, chunk);
  for (const chunk of incoming) {
    if (!byId.has(chunk.id)) byId.set(chunk.id, chunk);
  }
  return Array.from(byId.values());
}

export function scoreConfidence(chunks: RetrievedChunk[], warning: string) {
  if (warning || !chunks.length) return 35;
  const quality = assessEvidence(chunks);
  const baseScore = quality.sufficient ? 72 : 52;
  const documentBonus = Math.min(quality.uniqueDocuments * 5, 15);
  const chunkBonus = Math.min(chunks.length * 2, 10);
  return Math.min(baseScore + documentBonus + chunkBonus, 92);
}
