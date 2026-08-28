import { getAiOpsSummary } from "@/lib/server/ai-ops";
import { ARCHITECTURE_PATTERNS, PLATFORM_OPTIONS, SLO_DEFINITIONS } from "@/lib/server/fde/catalog";
import { listFdeUseCases } from "@/lib/server/fde/store";
import { listObservabilityEvents } from "@/lib/server/observability";
import type { FdeStage, FdeSummary, GuardrailCheck, SloStatus } from "@/types/fde";

const EMPTY_STAGE: Record<FdeStage, number> = {
  intake: 0,
  design: 0,
  prototype: 0,
  production: 0,
  parked: 0,
};

export async function getFdeSummary(): Promise<FdeSummary> {
  const [useCases, aiOps, events] = await Promise.all([listFdeUseCases(), getAiOpsSummary(), listObservabilityEvents()]);
  const byStage = { ...EMPTY_STAGE };
  for (const useCase of useCases) byStage[useCase.stage] += 1;

  const evaluated = events.filter((event) => event.status === "success" && event.evaluation);
  const evalCoverage = events.filter((event) => event.status === "success").length
    ? Math.round((evaluated.length / events.filter((event) => event.status === "success").length) * 100)
    : 0;

  const slos: SloStatus[] = SLO_DEFINITIONS.map((definition) => {
    if (definition.id === "availability") {
      const met = events.length === 0 || aiOps.observability.errorRate <= 1;
      return {
        ...definition,
        current: events.length ? `${100 - aiOps.observability.errorRate}%` : "n/a",
        met,
        detail: events.length ? `${aiOps.observability.successfulRequests}/${aiOps.observability.totalRequests} succeeded` : "No traffic yet",
      };
    }
    if (definition.id === "latency") {
      const met = events.length === 0 || aiOps.observability.averageLatencyMs <= 12000;
      return {
        ...definition,
        current: events.length ? `${aiOps.observability.averageLatencyMs} ms` : "n/a",
        met,
        detail: "Local Ollama often exceeds gateway targets; treat 12s as the local SLO.",
      };
    }
    if (definition.id === "groundedness") {
      const value = aiOps.evaluation.averageGroundedness;
      return {
        ...definition,
        current: events.length ? String(value) : "n/a",
        met: events.length === 0 || value >= 70,
        detail: "Deterministic local scorer on RAG answers.",
      };
    }
    if (definition.id === "hallucination") {
      const value = aiOps.evaluation.averageHallucinationRisk;
      return {
        ...definition,
        current: events.length ? String(value) : "n/a",
        met: events.length === 0 || value <= 35,
        detail: "Higher when evidence is thin or retrieval hops warn.",
      };
    }
    if (definition.id === "action-safety") {
      const values = evaluated.map((event) => event.evaluation?.actionSafety).filter((value): value is number => typeof value === "number");
      const average = values.length ? Math.round(values.reduce((total, value) => total + value, 0) / values.length) : 0;
      return {
        ...definition,
        current: values.length ? String(average) : "n/a",
        met: values.length === 0 || average >= 75,
        detail: "Penalizes agent steps that did not complete cleanly.",
      };
    }
    return {
      ...definition,
      current: events.length ? `${evalCoverage}%` : "n/a",
      met: events.length === 0 || evalCoverage >= 95,
      detail: `${evaluated.length} evaluated successful requests.`,
    };
  });

  const actionSafety = Number(slos.find((item) => item.id === "action-safety")?.current) || 0;

  const guardrails: GuardrailCheck[] = [
    {
      id: "auth",
      name: "Desk and API authentication",
      status: aiOps.governance.authProtected && aiOps.governance.apiProtected ? "pass" : "fail",
      detail: "Session cookie required for FDE, chat, and telemetry APIs.",
    },
    {
      id: "telemetry",
      name: "Inference telemetry enrolled",
      status: aiOps.governance.localTelemetry ? "pass" : "fail",
      detail: "Chat events write local JSONL for SLIs and eval.",
    },
    {
      id: "citations",
      name: "Grounding / citation mode",
      status: "pass",
      detail: `Retrieval citation mode is ${aiOps.governance.citationMode}.`,
    },
    {
      id: "error-rate",
      name: "Failure pattern watch",
      status: aiOps.observability.errorRate >= 10 ? "fail" : aiOps.observability.errorRate > 1 ? "watch" : "pass",
      detail: `Current error rate ${aiOps.observability.errorRate}%.`,
    },
    {
      id: "hallucination",
      name: "Hallucination anomaly",
      status: aiOps.evaluation.averageHallucinationRisk > 50 ? "fail" : aiOps.evaluation.averageHallucinationRisk > 35 ? "watch" : "pass",
      detail: `Average hallucination risk ${aiOps.evaluation.averageHallucinationRisk}.`,
    },
    {
      id: "action",
      name: "Unsafe-action pattern",
      status: actionSafety && actionSafety < 60 ? "fail" : actionSafety && actionSafety < 75 ? "watch" : "pass",
      detail: "WLST specialist stays read-only unless the user explicitly asks for high-impact steps.",
    },
    {
      id: "privacy",
      name: "Privacy / audit posture",
      status: "watch",
      detail: "Local POC: do not store passwords, tokens, or customer secrets in agent memory.",
    },
  ];

  return {
    pipeline: {
      total: useCases.length,
      byStage,
      aiAgent: useCases.filter((item) => item.recommendedApproach === "ai-agent").length,
      automation: useCases.filter((item) => item.recommendedApproach === "automation").length,
      traditional: useCases.filter((item) => item.recommendedApproach === "traditional").length,
    },
    useCases,
    patterns: ARCHITECTURE_PATTERNS,
    platforms: PLATFORM_OPTIONS,
    slos,
    guardrails,
    telemetry: {
      totalRequests: aiOps.observability.totalRequests,
      errorRate: aiOps.observability.errorRate,
      averageLatencyMs: aiOps.observability.averageLatencyMs,
      averageGroundedness: aiOps.evaluation.averageGroundedness,
      averageHallucinationRisk: aiOps.evaluation.averageHallucinationRisk,
      averageActionSafety: actionSafety,
      averageConfidence: aiOps.evaluation.averageConfidence,
    },
  };
}
