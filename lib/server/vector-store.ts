import { ChromaClient, type Collection } from "chromadb";
import type { AppConfig, RetrievedChunk } from "@/types/backend";

const collectionCache = new Map<string, Promise<Collection>>();

export async function getCollection(config: AppConfig) {
  return getNamedCollection(config, config.vectorStore.collectionName);
}

export async function getNamedCollection(config: AppConfig, collectionName: string) {
  const cacheKey = `${config.vectorStore.endpoint}::${collectionName}`;
  const existing = collectionCache.get(cacheKey);
  if (existing) return existing;

  const pending = (async () => {
    const endpoint = new URL(config.vectorStore.endpoint);
    const client = new ChromaClient({
      host: endpoint.hostname,
      port: Number(endpoint.port || 8000),
      ssl: endpoint.protocol === "https:",
    });
    // null = we supply embeddings ourselves via Ollama; do not load DefaultEmbeddingFunction.
    return client.getOrCreateCollection({
      name: collectionName,
      embeddingFunction: null,
    });
  })();

  collectionCache.set(cacheKey, pending);
  try {
    return await pending;
  } catch (error) {
    collectionCache.delete(cacheKey);
    throw error;
  }
}

export async function addChunksToVectorStore(
  config: AppConfig,
  chunks: Array<{ id: string; text: string; embedding: number[]; metadata: Record<string, string | number> }>,
) {
  const collection = await getCollection(config);
  await collection.upsert({
    ids: chunks.map((chunk) => chunk.id),
    documents: chunks.map((chunk) => chunk.text),
    embeddings: chunks.map((chunk) => chunk.embedding),
    metadatas: chunks.map((chunk) => chunk.metadata),
  });
}

export async function deleteChunksByDocumentId(config: AppConfig, documentId: string) {
  const collection = await getCollection(config);
  await collection.delete({ where: { documentId } });
}

export async function queryVectorStore(config: AppConfig, queryEmbedding: number[], topK: number, ownerUsername: string): Promise<RetrievedChunk[]> {
  const collection = await getCollection(config);
  const result = await collection.query({
    queryEmbeddings: [queryEmbedding],
    nResults: topK,
    include: ["documents", "metadatas", "distances"],
    where: { ownerUsername },
  });

  const ids = result.ids?.[0] || [];
  const documents = result.documents?.[0] || [];
  const metadatas = result.metadatas?.[0] || [];
  const distances = result.distances?.[0] || [];

  return ids.map((id, index) => {
    const metadata = metadatas[index] || {};
    return {
      id,
      documentName: String(metadata.filename || "Unknown document"),
      section: `Lines ${metadata.lineStart || "?"}-${metadata.lineEnd || "?"}`,
      text: documents[index] || "",
      distance: distances[index] ?? undefined,
    };
  });
}
