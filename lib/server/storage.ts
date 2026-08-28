import { getDatabase, retentionExpiry } from "@/lib/server/database";
import type { AgentMemoryItem, StoredDocument } from "@/types/backend";

type DocumentRow = { id: string; owner_username: string; filename: string; type: StoredDocument["type"]; size: string; upload_date: string; status: StoredDocument["status"]; line_count: number; chunk_count: number; created_at: string; expires_at: string };
type MemoryRow = { id: string; owner_username: string; content: string; category: AgentMemoryItem["category"]; source: AgentMemoryItem["source"]; created_at: string; updated_at: string; expires_at: string };

export async function listStoredDocuments(ownerUsername: string): Promise<StoredDocument[]> {
  const db = await getDatabase();
  return (db.prepare("SELECT * FROM documents WHERE owner_username = ? AND expires_at > ? ORDER BY created_at DESC").all(ownerUsername, new Date().toISOString()) as unknown as DocumentRow[]).map(documentFromRow);
}
export async function getStoredDocument(id: string, ownerUsername: string) {
  const db = await getDatabase(); const row = db.prepare("SELECT * FROM documents WHERE id = ? AND owner_username = ? AND expires_at > ?").get(id, ownerUsername, new Date().toISOString()) as unknown as DocumentRow | undefined; return row ? documentFromRow(row) : null;
}
export async function upsertStoredDocument(document: StoredDocument) {
  const db = await getDatabase();
  db.prepare(`INSERT INTO documents VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET filename=excluded.filename, type=excluded.type, size=excluded.size, upload_date=excluded.upload_date, status=excluded.status, line_count=excluded.line_count, chunk_count=excluded.chunk_count, expires_at=excluded.expires_at`).run(document.id, document.ownerUsername, document.filename, document.type, document.size, document.uploadDate, document.status, document.lineCount, document.chunkCount, document.createdAt, document.expiresAt);
}
export async function deleteStoredDocument(id: string, ownerUsername: string) { const db = await getDatabase(); return db.prepare("DELETE FROM documents WHERE id = ? AND owner_username = ?").run(id, ownerUsername).changes > 0; }
export async function listStoredMemories(ownerUsername: string): Promise<AgentMemoryItem[]> {
  const db = await getDatabase(); return (db.prepare("SELECT * FROM memories WHERE owner_username = ? AND expires_at > ? ORDER BY updated_at DESC").all(ownerUsername, new Date().toISOString()) as unknown as MemoryRow[]).map(memoryFromRow);
}
export async function getStoredMemory(id: string, ownerUsername: string) { const db = await getDatabase(); const row = db.prepare("SELECT * FROM memories WHERE id = ? AND owner_username = ? AND expires_at > ?").get(id, ownerUsername, new Date().toISOString()) as unknown as MemoryRow | undefined; return row ? memoryFromRow(row) : null; }
export async function upsertStoredMemory(memory: AgentMemoryItem) { const db = await getDatabase(); db.prepare(`INSERT INTO memories VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET content=excluded.content, category=excluded.category, source=excluded.source, updated_at=excluded.updated_at, expires_at=excluded.expires_at`).run(memory.id, memory.ownerUsername, memory.content, memory.category, memory.source, memory.createdAt, memory.updatedAt, memory.expiresAt); }
export async function deleteStoredMemory(id: string, ownerUsername: string) { const db = await getDatabase(); return db.prepare("DELETE FROM memories WHERE id = ? AND owner_username = ?").run(id, ownerUsername).changes > 0; }
export { retentionExpiry };
function documentFromRow(row: DocumentRow): StoredDocument { return { id: row.id, ownerUsername: row.owner_username, filename: row.filename, type: row.type, size: row.size, uploadDate: row.upload_date, status: row.status, lineCount: row.line_count, chunkCount: row.chunk_count, createdAt: row.created_at, expiresAt: row.expires_at }; }
function memoryFromRow(row: MemoryRow): AgentMemoryItem { return { id: row.id, ownerUsername: row.owner_username, content: row.content, category: row.category, source: row.source, createdAt: row.created_at, updatedAt: row.updated_at, expiresAt: row.expires_at }; }
