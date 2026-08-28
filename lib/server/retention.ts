import { getDatabase } from "@/lib/server/database";
import { getAppConfig } from "@/lib/server/config";
import { deleteChunksByDocumentId } from "@/lib/server/vector-store";
import { cleanupExpiredLangGraphConversations } from "@/lib/server/langgraph-agent";
const KEY = "retention-last-run";
export async function runDueRetention() {
  const db = await getDatabase(); const now = new Date();
  const prior = db.prepare("SELECT value FROM maintenance_state WHERE key = ?").get(KEY) as { value: string } | undefined;
  if (prior && now.getTime() - Date.parse(prior.value) < 24 * 60 * 60 * 1000) return prior.value;
  const cutoff = now.toISOString();
  const documentIds = db.prepare("SELECT id FROM documents WHERE expires_at <= ?").all(cutoff) as unknown as Array<{id:string}>;
  const streamDocuments = db.prepare("SELECT document_id FROM live_streams WHERE expires_at <= ?").all(cutoff) as unknown as Array<{document_id:string}>;
  const config = await getAppConfig();
  for (const item of documentIds) await deleteChunksByDocumentId(config, item.id);
  for (const item of streamDocuments) await deleteChunksByDocumentId(config, item.document_id);
  db.exec(`DELETE FROM documents WHERE expires_at <= '${cutoff}'; DELETE FROM memories WHERE expires_at <= '${cutoff}'; DELETE FROM live_streams WHERE expires_at <= '${cutoff}'; DELETE FROM live_alerts WHERE expires_at <= '${cutoff}'; DELETE FROM observability_events WHERE expires_at <= '${cutoff}'; DELETE FROM upload_sessions WHERE expires_at <= '${cutoff}';`);
  db.prepare("INSERT INTO maintenance_state(key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(KEY, cutoff);
  await cleanupExpiredLangGraphConversations();
  return cutoff;
}
export async function retentionStatus() { const db = await getDatabase(); return (db.prepare("SELECT value FROM maintenance_state WHERE key = ?").get(KEY) as {value:string}|undefined)?.value || null; }
