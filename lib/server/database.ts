import { DatabaseSync } from "node:sqlite";
import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";

const DATA_DIR = path.join(process.cwd(), ".app-data");
const DATABASE_FILE = path.join(DATA_DIR, "weblogic-copilot.sqlite");
const RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
let database: DatabaseSync | undefined;
let initialized: Promise<void> | undefined;

export const retentionExpiry = (from = Date.now()) => new Date(from + RETENTION_MS).toISOString();
export const uploadExpiry = (from = Date.now()) => new Date(from + 24 * 60 * 60 * 1000).toISOString();

export async function getDatabase() {
  if (!initialized) initialized = initialize();
  await initialized;
  return database!;
}

async function initialize() {
  await mkdir(DATA_DIR, { recursive: true });
  database = new DatabaseSync(DATABASE_FILE);
  database.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");
  database.exec(`
    CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY, owner_username TEXT NOT NULL, filename TEXT NOT NULL, type TEXT NOT NULL,
      size TEXT NOT NULL, upload_date TEXT NOT NULL, status TEXT NOT NULL, line_count INTEGER NOT NULL,
      chunk_count INTEGER NOT NULL, created_at TEXT NOT NULL, expires_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS documents_owner_expiry ON documents(owner_username, expires_at);
    CREATE TABLE IF NOT EXISTS memories (
      id TEXT PRIMARY KEY, owner_username TEXT NOT NULL, content TEXT NOT NULL, category TEXT NOT NULL,
      source TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, expires_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS memories_owner_expiry ON memories(owner_username, expires_at);
    CREATE TABLE IF NOT EXISTS live_streams (
      id TEXT PRIMARY KEY, owner_username TEXT NOT NULL, env TEXT NOT NULL, server TEXT NOT NULL,
      source TEXT NOT NULL, file_path TEXT, status TEXT NOT NULL, document_id TEXT NOT NULL, filename TEXT NOT NULL,
      line_count INTEGER NOT NULL, chunk_count INTEGER NOT NULL, bytes_ingested INTEGER NOT NULL,
      last_seen_at TEXT NOT NULL, created_at TEXT NOT NULL, expires_at TEXT NOT NULL, error TEXT,
      ingest_token_hash TEXT NOT NULL, ingest_token_created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS live_streams_owner_expiry ON live_streams(owner_username, expires_at);
    CREATE TABLE IF NOT EXISTS live_alerts (
      id TEXT PRIMARY KEY, stream_id TEXT NOT NULL, owner_username TEXT NOT NULL, env TEXT NOT NULL,
      server TEXT NOT NULL, severity TEXT NOT NULL, title TEXT NOT NULL, detail TEXT NOT NULL, matched TEXT NOT NULL,
      created_at TEXT NOT NULL, expires_at TEXT NOT NULL,
      FOREIGN KEY(stream_id) REFERENCES live_streams(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS live_alerts_owner_created ON live_alerts(owner_username, created_at DESC);
    CREATE TABLE IF NOT EXISTS observability_events (
      id TEXT PRIMARY KEY, owner_username TEXT NOT NULL, timestamp TEXT NOT NULL, payload TEXT NOT NULL, expires_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS observability_owner_time ON observability_events(owner_username, timestamp DESC);
    CREATE TABLE IF NOT EXISTS upload_sessions (
      upload_id TEXT PRIMARY KEY, owner_username TEXT NOT NULL, filename TEXT NOT NULL, size INTEGER NOT NULL,
      total_parts INTEGER NOT NULL, received_parts TEXT NOT NULL, created_at TEXT NOT NULL, expires_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS upload_sessions_expiry ON upload_sessions(expires_at);
    CREATE TABLE IF NOT EXISTS chat_conversations (
      id TEXT PRIMARY KEY, owner_username TEXT NOT NULL, created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL, expires_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS chat_conversations_owner_expiry ON chat_conversations(owner_username, expires_at);
    CREATE TABLE IF NOT EXISTS langgraph_runtime_state (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS maintenance_state (key TEXT PRIMARY KEY, value TEXT NOT NULL);
  `);
  await migrateLegacyFiles();
}

async function migrateLegacyFiles() {
  const db = database!;
  if (db.prepare("SELECT 1 FROM maintenance_state WHERE key = ?").get("legacy-migration-v1")) return;
  const owner = process.env.WEBLOGIC_COPILOT_USERNAME?.trim() || "local-admin";
  const now = new Date().toISOString();
  const expiresAt = retentionExpiry();
  const readJson = async <T>(file: string, fallback: T): Promise<T> => {
    try { return JSON.parse(await readFile(path.join(DATA_DIR, file), "utf8")) as T; } catch { return fallback; }
  };
  const documents = await readJson<Array<Record<string, unknown>>>("documents.json", []);
  const memories = await readJson<Array<Record<string, unknown>>>("memory.json", []);
  const logs = await readJson<{ streams?: Array<Record<string, unknown>>; alerts?: Array<Record<string, unknown>> }>("live-logs.json", {});
  const insertDocument = db.prepare("INSERT OR IGNORE INTO documents VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
  for (const item of documents) insertDocument.run(String(item.id), owner, String(item.filename), String(item.type), String(item.size), String(item.uploadDate), String(item.status), Number(item.lineCount || 0), Number(item.chunkCount || 0), now, expiresAt);
  const insertMemory = db.prepare("INSERT OR IGNORE INTO memories VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
  for (const item of memories) insertMemory.run(String(item.id), owner, String(item.content), String(item.category || "note"), String(item.source || "user"), String(item.createdAt || now), String(item.updatedAt || now), expiresAt);
  const insertStream = db.prepare("INSERT OR IGNORE INTO live_streams VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
  for (const item of logs.streams || []) insertStream.run(String(item.id), owner, String(item.env), String(item.server), String(item.source || "http"), item.filePath ? String(item.filePath) : null, String(item.status || "active"), String(item.documentId || item.id), String(item.filename || "live.log"), Number(item.lineCount || 0), Number(item.chunkCount || 0), Number(item.bytesIngested || 0), String(item.lastSeenAt || now), String(item.createdAt || now), expiresAt, item.error ? String(item.error) : null, "", now);
  const insertAlert = db.prepare("INSERT OR IGNORE INTO live_alerts VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
  for (const item of logs.alerts || []) insertAlert.run(String(item.id), String(item.streamId), owner, String(item.env), String(item.server), String(item.severity || "info"), String(item.title), String(item.detail), String(item.matched), String(item.createdAt || now), expiresAt);
  try {
    const lines = (await readFile(path.join(DATA_DIR, "observability-events.jsonl"), "utf8")).split(/\r?\n/).filter(Boolean);
    const insertEvent = db.prepare("INSERT OR IGNORE INTO observability_events VALUES (?, ?, ?, ?, ?)");
    for (const line of lines) { try { const event = JSON.parse(line) as { id: string; timestamp: string }; insertEvent.run(event.id, owner, event.timestamp || now, line, expiresAt); } catch {} }
  } catch {}
  db.prepare("INSERT INTO maintenance_state(key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run("legacy-migration-v1", now);
}
