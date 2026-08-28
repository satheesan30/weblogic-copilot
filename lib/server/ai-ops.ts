import { getAppConfig } from "@/lib/server/config";
import { listObservabilityEvents } from "@/lib/server/observability";
import { listStoredDocuments, listStoredMemories } from "@/lib/server/storage";
import type { AiOpsSummary, EvaluationMetrics, ObservabilityEvent } from "@/types/backend";

export async function getAiOpsSummary(ownerUsername = process.env.WEBLOGIC_COPILOT_USERNAME || "local-admin"): Promise<AiOpsSummary> {
  const [config, events, documents, memories] = await Promise.all([
    getAppConfig(),
    listObservabilityEvents(),
    listStoredDocuments(ownerUsername),
    listStoredMemories(ownerUsername),
  ]);
  const successfulEvents = events.filter((event) => event.status === "success");
  const failedEvents = events.filter((event) => event.status === "error");
  const latestEvent = events[0];
  const latestEvaluation = successfulEvents.find((event) => event.evaluation)?.evaluation;

  return {
    evaluation: {
      latest: latestEvaluation,
      averageConfidence: averageMetric(successfulEvents, "confidence"),
      averageGroundedness: averageMetric(successfulEvents, "groundedness"),
      averageHallucinationRisk: averageMetric(successfulEvents, "hallucinationRisk"),
    },
    observability: {
      totalRequests: events.length,
      successfulRequests: successfulEvents.length,
      failedRequests: failedEvents.length,
      errorRate: events.length ? Math.round((failedEvents.length / events.length) * 100) : 0,
      averageLatencyMs: average(events.map((event) => event.latencyMs)),
      latestEvents: events.slice(0, 8),
      modelUsage: modelUsage(events),
      timeline: events
        .slice(0, 20)
        .reverse()
        .map((event) => ({
          timestamp: event.timestamp,
          latencyMs: event.latencyMs,
          confidence: typeof event.evaluation?.confidence === "number" ? event.evaluation.confidence : null,
          status: event.status,
        })),
    },
    dataFoundation: {
      documentCount: documents.length,
      indexedDocumentCount: documents.filter((document) => document.status === "Indexed").length,
      failedDocumentCount: documents.filter((document) => document.status === "Failed").length,
      totalChunks: documents.reduce((total, document) => total + document.chunkCount, 0),
      memoryCount: memories.length,
      vectorStoreProvider: config.vectorStore.provider,
      vectorCollection: config.vectorStore.collectionName,
      embeddingModel: config.vectorStore.embeddingModel,
    },
    orchestration: {
      latestMode: latestEvent?.mode || "unknown",
      latestStepCount: latestEvent?.agentStepCount || 0,
      latestLatencyMs: latestEvent?.latencyMs || 0,
      latestStatus: latestEvent?.status || "none",
    },
    governance: {
      authProtected: true,
      apiProtected: true,
      localTelemetry: true,
      citationMode: config.retrieval.citationMode,
      promptGuardrails: [
        "Orchestrator routes to JDBC, BEA, WLST, Live Log, FDE architecture, or RCA specialists.",
        "Operational questions use agentic RAG retrieval with evidence assessment.",
        "Weak evidence triggers a rewrite_query hop before final answer.",
        "WLST specialist defaults to read-only checklists.",
        "Live Log specialist prefers freshly injected or tailed log chunks.",
        "General questions skip citations and RCA formatting.",
        "Missing evidence is reported instead of guessed.",
      ],
    },
  };
}

function averageMetric(events: ObservabilityEvent[], metric: keyof EvaluationMetrics) {
  return average(events.map((event) => event.evaluation?.[metric]).filter((value): value is number => typeof value === "number"));
}

function average(values: number[]) {
  if (!values.length) return 0;
  return Math.round(values.reduce((total, value) => total + value, 0) / values.length);
}

function modelUsage(events: ObservabilityEvent[]) {
  const usage = new Map<string, number>();

  for (const event of events) {
    usage.set(event.model, (usage.get(event.model) || 0) + 1);
  }

  return Array.from(usage.entries())
    .map(([model, count]) => ({ model, count }))
    .sort((left, right) => right.count - left.count);
}
