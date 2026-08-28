import type { DeliveryApproach, FdeUseCase, FdeUseCaseInput } from "@/types/fde";

function clampScore(value: number | undefined, fallback: number) {
  const next = typeof value === "number" && Number.isFinite(value) ? value : fallback;
  return Math.max(1, Math.min(5, Math.round(next)));
}

export function scoreUseCase(input: FdeUseCaseInput): { recommendedApproach: DeliveryApproach; approachRationale: string } {
  const impact = clampScore(input.impact, 3);
  const dataReadiness = clampScore(input.dataReadiness, 3);
  const risk = clampScore(input.risk, 3);
  const complexity = clampScore(input.complexity, 3);
  const latencySensitivity = clampScore(input.latencySensitivity, 3);
  const deterministic = Boolean(input.deterministic);
  const needsJudgment = Boolean(input.needsJudgment);

  if (deterministic && !needsJudgment) {
    return {
      recommendedApproach: latencySensitivity >= 4 || complexity <= 2 ? "traditional" : "automation",
      approachRationale:
        "The work looks rule-based. Prefer traditional engineering or workflow automation over an LLM until judgment or messy evidence appears.",
    };
  }

  if (risk >= 4 && dataReadiness <= 2) {
    return {
      recommendedApproach: "traditional",
      approachRationale:
        "High operational risk with weak data readiness. Do not put an agent in the path until logs, access, and eval data exist.",
    };
  }

  if (needsJudgment && dataReadiness >= 3 && impact >= 3) {
    return {
      recommendedApproach: "ai-agent",
      approachRationale:
        "Judgment over private evidence with meaningful impact. A grounded agent with retrieval, eval, and human-in-the-loop is appropriate.",
    };
  }

  if (!needsJudgment && (complexity >= 3 || impact >= 3)) {
    return {
      recommendedApproach: "automation",
      approachRationale:
        "Repeatable integration work without open-ended judgment. Automate APIs, tickets, or checks; keep LLMs off the critical path.",
    };
  }

  const composite = impact * 2 + dataReadiness * 2 - risk - complexity - Math.max(0, latencySensitivity - 3);
  if (composite >= 8 && needsJudgment) {
    return {
      recommendedApproach: "ai-agent",
      approachRationale: "Impact and data readiness outweigh risk. Prototype with grounded RAG and explicit SLOs.",
    };
  }

  return {
    recommendedApproach: "automation",
    approachRationale: "Default to simpler automation. Revisit an agent only if retrieval and judgment become the bottleneck.",
  };
}

export function deliveryGaps(useCase: FdeUseCase): string[] {
  const gaps: string[] = [];
  if (!useCase.problem.trim() || !useCase.users.trim()) gaps.push("Problem and users are incomplete.");
  if (!useCase.workflow.trim() || !useCase.integrations.trim() || !useCase.dataFlows.trim()) {
    gaps.push("Architecture canvas is missing workflow, integrations, or data flow.");
  }
  if (!useCase.patternId) gaps.push("No reusable reference pattern selected.");
  if (!useCase.evaluationPlan.trim()) gaps.push("Evaluation plan (offline/online/canary) is missing.");
  if (!useCase.operationalNotes.trim()) gaps.push("Operational / compliance notes are missing.");
  if (useCase.recommendedApproach === "ai-agent" && useCase.dataReadiness < 3) {
    gaps.push("Agent path selected but data readiness is below 3/5.");
  }
  return gaps;
}

export const DELIVERY_GATES = [
  { id: "problem", label: "Problem and users written", stage: "intake" as const },
  { id: "fit", label: "AI vs automation vs traditional decision recorded", stage: "intake" as const },
  { id: "arch", label: "Workflow, integrations, and data flow documented", stage: "design" as const },
  { id: "pattern", label: "Reference pattern selected", stage: "design" as const },
  { id: "eval", label: "Offline/online eval plan written", stage: "prototype" as const },
  { id: "slo", label: "SLOs enrolled in local telemetry", stage: "prototype" as const },
  { id: "guard", label: "Guardrails and privacy notes accepted", stage: "production" as const },
  { id: "handoff", label: "Stakeholder handoff pack generated", stage: "production" as const },
];

