import type { ChatApiResponse, EvaluationMetrics } from "@/types/backend";

export function evaluateChatResponse(response: ChatApiResponse): EvaluationMetrics {
  const evidenceCount = response.evidence.length;
  const hasAgentTrace = Boolean(response.agentTrace);
  const isRag = response.agentTrace?.mode === "rag" || response.agentTrace?.mode === "agentic_rag";
  const answerLength = response.answer.trim().length;
  const warningSteps = response.agentTrace?.steps.filter((step) => step.status !== "complete").length || 0;

  if (!isRag) {
    return {
      confidence: response.confidence || 75,
      groundedness: 0,
      citationCoverage: 0,
      evidenceSufficiency: 0,
      hallucinationRisk: boundedScore(answerLength > 0 ? 25 : 80),
      actionSafety: boundedScore(hasAgentTrace && warningSteps === 0 ? 82 : 68),
    };
  }

  const evidenceSufficiency = boundedScore(Math.min(evidenceCount * 28, 100));
  const groundedness = boundedScore(evidenceSufficiency);
  const confidence = boundedScore(response.confidence || groundedness);
  const hallucinationRisk = boundedScore(Math.max(8, 100 - Math.round((groundedness * 0.65) + (confidence * 0.35)) + warningSteps * 8));
  const actionSafety = boundedScore(Math.max(45, 92 - warningSteps * 12));

  return {
    confidence,
    groundedness,
    citationCoverage: 0,
    evidenceSufficiency,
    hallucinationRisk,
    actionSafety,
  };
}

function boundedScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}
