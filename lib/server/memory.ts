import crypto from "node:crypto";
import { getNamedCollection } from "@/lib/server/vector-store";
import { deleteStoredMemory, listStoredMemories, upsertStoredMemory } from "@/lib/server/storage";
import { embedText } from "@/lib/server/ollama";
import type { AgentMemoryItem, AppConfig, RetrievedMemory } from "@/types/backend";

export async function addAgentMemory(
  config: AppConfig,
  input: {
    ownerUsername: string;
    content: string;
    category?: AgentMemoryItem["category"];
    source?: AgentMemoryItem["source"];
  },
): Promise<AgentMemoryItem> {
  const content = input.content.trim();
  if (!content) {
    throw new Error("Memory content is required.");
  }

  const now = new Date().toISOString();
  const memory: AgentMemoryItem = {
    id: crypto.randomUUID(),
    ownerUsername: input.ownerUsername,
    content,
    category: input.category || "note",
    source: input.source || "user",
    createdAt: now,
    updatedAt: now,
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  };

  const embedding = await embedText(config, content);
  const collection = await getNamedCollection(config, config.memory.collectionName);

  await collection.upsert({
    ids: [memory.id],
    documents: [memory.content],
    embeddings: [embedding],
    metadatas: [
      {
        category: memory.category,
        source: memory.source,
        createdAt: memory.createdAt,
        updatedAt: memory.updatedAt,
        ownerUsername: memory.ownerUsername,
      },
    ],
  });

  await upsertStoredMemory(memory);
  return memory;
}

export async function queryAgentMemory(config: AppConfig, query: string, ownerUsername: string): Promise<RetrievedMemory[]> {
  if (!config.memory.enabled) return [];

  const queryEmbedding = await embedText(config, query);
  const collection = await getNamedCollection(config, config.memory.collectionName);
  const result = await collection.query({
    queryEmbeddings: [queryEmbedding],
    nResults: config.memory.topK,
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
      content: documents[index] || "",
      category: memoryCategoryValue(metadata.category),
      source: memorySourceValue(metadata.source),
      distance: distances[index] ?? undefined,
    };
  });
}

export async function listAgentMemories(ownerUsername: string) {
  return listStoredMemories(ownerUsername);
}

export async function deleteAgentMemory(config: AppConfig, id: string, ownerUsername: string) {
  const collection = await getNamedCollection(config, config.memory.collectionName);
  const deleted = await deleteStoredMemory(id, ownerUsername);
  if (deleted) await collection.delete({ ids: [id] });
  return deleted;
}

function memoryCategoryValue(value: unknown): AgentMemoryItem["category"] {
  return value === "preference" || value === "environment" || value === "incident" || value === "note" ? value : "note";
}

function memorySourceValue(value: unknown): AgentMemoryItem["source"] {
  return value === "user" || value === "assistant" || value === "system" ? value : "user";
}
