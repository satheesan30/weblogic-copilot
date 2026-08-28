import { getDatabase } from "@/lib/server/database";
import type { ObservabilityEvent } from "@/types/backend";
const MAX_EVENTS_TO_READ = 500;
export async function appendObservabilityEvent(event: ObservabilityEvent) { const db = await getDatabase(); db.prepare("INSERT OR REPLACE INTO observability_events VALUES (?, ?, ?, ?, ?)").run(event.id, event.ownerUsername, event.timestamp, JSON.stringify(event), event.expiresAt); }
export async function listObservabilityEvents(ownerUsername = process.env.WEBLOGIC_COPILOT_USERNAME || "local-admin", limit = MAX_EVENTS_TO_READ): Promise<ObservabilityEvent[]> { const db = await getDatabase(); const rows = db.prepare("SELECT payload FROM observability_events WHERE owner_username = ? AND expires_at > ? ORDER BY timestamp DESC LIMIT ?").all(ownerUsername, new Date().toISOString(), limit) as unknown as Array<{payload:string}>; return rows.flatMap((row) => { try { return [JSON.parse(row.payload) as ObservabilityEvent]; } catch { return []; } }); }
