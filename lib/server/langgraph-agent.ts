import crypto from "node:crypto";
import path from "node:path";
import { Annotation, END, START, StateGraph } from "@langchain/langgraph";
import { SqliteSaver } from "@langchain/langgraph-checkpoint-sqlite";
import { getDatabase, retentionExpiry } from "@/lib/server/database";
import { runChatAgent } from "@/lib/server/agent";
import { matchFdeSpecialist, routeSpecialistAgent } from "@/lib/server/specialists/orchestrator";
import { normalizeHistory, shouldUseAgenticRag } from "@/lib/server/conversation";
import type { AppConfig, ChatApiRequest, ChatApiResponse } from "@/types/backend";

const GraphState = Annotation.Root({
  question: Annotation<string>,
  request: Annotation<ChatApiRequest>,
  ownerUsername: Annotation<string>,
  config: Annotation<AppConfig>,
  specialist: Annotation<string>,
  response: Annotation<ChatApiResponse>,
  graphNodes: Annotation<string[]>({ reducer: (left, right) => [...left, ...right], default: () => [] }),
});

let saver: SqliteSaver | undefined;
function checkpointer() {
  if (!saver) saver = SqliteSaver.fromConnString(path.join(process.cwd(), ".app-data", "weblogic-copilot.sqlite"));
  return saver;
}

export function langGraphEnabled() { return process.env.LANGGRAPH_ENABLED === "true"; }
export async function resolveConversation(ownerUsername: string, requestedId?: string) {
  const db = await getDatabase();
  const now = new Date().toISOString();
  if (requestedId) {
    const row = db.prepare("SELECT id FROM chat_conversations WHERE id = ? AND owner_username = ? AND expires_at > ?").get(requestedId, ownerUsername, now);
    if (!row) return null;
    db.prepare("UPDATE chat_conversations SET updated_at = ?, expires_at = ? WHERE id = ?").run(now, retentionExpiry(), requestedId);
    return requestedId;
  }
  const id = crypto.randomUUID();
  db.prepare("INSERT INTO chat_conversations VALUES (?, ?, ?, ?, ?)").run(id, ownerUsername, now, now, retentionExpiry());
  return id;
}

export async function runLangGraphAgent(config: AppConfig, question: string, request: ChatApiRequest, ownerUsername: string, conversationId: string) {
  const graph = new StateGraph(GraphState)
    .addNode("supervisor", async (state) => {
      const history = normalizeHistory(state.request.history);
      const fde = matchFdeSpecialist(state.question, history);
      const route = fde || (shouldUseAgenticRag(state.question, history) ? routeSpecialistAgent(state.question, history) : { specialist: "general" as const });
      return { specialist: route.specialist, graphNodes: ["supervisor"] };
    })
    .addNode("retrieve", async () => ({ graphNodes: ["retrieve"] }))
    .addNode("specialist", async (state) => ({ response: await runChatAgent(state.config, state.question, state.request, state.ownerUsername), graphNodes: [`${state.specialist}_specialist`] }))
    .addNode("finalize", async () => ({ graphNodes: ["finalize"] }))
    .addEdge(START, "supervisor")
    .addEdge("supervisor", "retrieve")
    .addEdge("retrieve", "specialist")
    .addEdge("specialist", "finalize")
    .addEdge("finalize", END)
    .compile({ checkpointer: checkpointer() });
  const result = await graph.invoke({ question, request, ownerUsername, config }, { configurable: { thread_id: threadKey(ownerUsername, conversationId) } });
  return { response: result.response, graphNodes: result.graphNodes, specialist: result.specialist };
}

export function threadKey(ownerUsername: string, conversationId: string) {
  return crypto.createHash("sha256").update(`${ownerUsername}:${conversationId}`).digest("hex");
}

export async function langGraphHealth() {
  try { checkpointer(); const db = await getDatabase(); const row = db.prepare("SELECT value FROM langgraph_runtime_state WHERE key = ?").get("last-failure-at") as {value:string}|undefined; return { available: true, lastFailureAt: row?.value || null }; }
  catch { const value = new Date().toISOString(); const db = await getDatabase(); db.prepare("INSERT INTO langgraph_runtime_state VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run("last-failure-at", value); return { available: false, lastFailureAt: value }; }
}

export async function recordLangGraphFailure() {
  const db = await getDatabase();
  db.prepare("INSERT INTO langgraph_runtime_state VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run("last-failure-at", new Date().toISOString());
}

export async function cleanupExpiredLangGraphConversations() {
  const db = await getDatabase();
  const expired = db.prepare("SELECT id, owner_username FROM chat_conversations WHERE expires_at <= ?").all(new Date().toISOString()) as unknown as Array<{id:string; owner_username:string}>;
  for (const item of expired) await checkpointer().deleteThread(threadKey(item.owner_username, item.id));
  db.prepare("DELETE FROM chat_conversations WHERE expires_at <= ?").run(new Date().toISOString());
}
