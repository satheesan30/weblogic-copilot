import { NextResponse } from "next/server";
import { getAppConfig } from "@/lib/server/config";
import { liteLlmMasterKey } from "@/lib/server/ollama";
import { getDatabase } from "@/lib/server/database";
import { retentionStatus, runDueRetention } from "@/lib/server/retention";
import { langGraphEnabled, langGraphHealth } from "@/lib/server/langgraph-agent";

export async function GET() {
  const sqlite = await getDatabase().then(() => true).catch(() => false);
  if (sqlite) await runDueRetention().catch(() => undefined);
  const config = await getAppConfig();
  const provider = config.llm.provider.toLowerCase();
  const modelHealthUrl =
    provider === "litellm"
      ? config.llm.endpoint.replace(/\/v1\/chat\/completions\/?$/, "/v1/models")
      : "http://localhost:11434/api/tags";
  const [llm, chroma] = await Promise.allSettled([
    fetch(modelHealthUrl, { cache: "no-store", headers: liteLlmHeaders(config) }),
    fetch(`${config.vectorStore.endpoint}/api/v2/heartbeat`, { cache: "no-store" }),
  ]);
  const langgraph = await langGraphHealth();

  return NextResponse.json({
    llmProvider: config.llm.provider,
    llm: llm.status === "fulfilled" && llm.value.ok,
    ollama: provider === "ollama" ? llm.status === "fulfilled" && llm.value.ok : undefined,
    litellm: provider === "litellm" ? llm.status === "fulfilled" && llm.value.ok : undefined,
    chroma: chroma.status === "fulfilled" && chroma.value.ok,
    sqlite,
    retentionLastRunAt: sqlite ? await retentionStatus() : null,
    langgraph: langgraph.available,
    langgraphEnabled: langGraphEnabled(),
    langgraphLastFailureAt: langgraph.lastFailureAt,
  });
}

function liteLlmHeaders(config: Awaited<ReturnType<typeof getAppConfig>>) {
  if (config.llm.provider.toLowerCase() !== "litellm") return undefined;
  const token = liteLlmMasterKey(config);
  return token ? { Authorization: `Bearer ${token}` } : undefined;
}
