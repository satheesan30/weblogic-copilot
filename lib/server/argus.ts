/**
 * Argus wiring for WebLogic Copilot.
 *
 * Two jobs:
 *   1. a configured client (`argus`) and an input guardrail (`guard`);
 *   2. a request-scoped collector for LLM token usage.
 *
 * The usage collector exists because token counts are produced deep inside
 * `chatWithModel` but are needed at the route level, and threading them out
 * would change the signature of `runChatAgent`, `runLangGraphAgent` and every
 * specialist. `AsyncLocalStorage` carries them per-request instead — no
 * signature churn, and safe under concurrent requests (a module-level variable
 * would leak usage between them).
 */
import { AsyncLocalStorage } from "node:async_hooks";

import { Argus } from "@/lib/server/argus-client";

export const argus = new Argus({
  url: process.env.ARGUS_URL ?? "http://localhost:8080",
  apiKey: process.env.ARGUS_API_KEY,
  project: "weblogic-copilot",
  environment: process.env.NODE_ENV,
});

export interface LlmCall {
  model: string;
  promptTokens: number;
  completionTokens: number;
  cachedTokens: number;
  streamed: boolean;
  /** Raw OpenAI-shaped body, when the call was not streamed. */
  payload?: unknown;
}

const store = new AsyncLocalStorage<LlmCall[]>();

/** Run `fn` with a fresh usage collector attached to the async context. */
export function withLlmUsage<T>(fn: () => Promise<T>): Promise<T> {
  return store.run([], fn);
}

/** Called from ollama.ts after each completion. No-op outside a collector. */
export function recordLlmCall(call: LlmCall): void {
  store.getStore()?.push(call);
}

/** Everything recorded during the current request. */
export function collectedLlmCalls(): LlmCall[] {
  return store.getStore() ?? [];
}

/**
 * Pre-flight safety check on user input.
 *
 * Fails **open**: if the collector is unreachable, chat keeps working. That is
 * the right default for an internal ops assistant, where availability matters
 * more than strict enforcement. Flip the catch to `{ blocked: true }` if you
 * would rather fail closed.
 */
export async function guard(text: string): Promise<{ blocked: boolean; reason?: string }> {
  try {
    const verdict = await argus.scan(text, "input");
    if (verdict.recommended_action === "block") {
      return { blocked: true, reason: verdict.findings[0]?.evidence };
    }
    return { blocked: false };
  } catch {
    return { blocked: false };
  }
}

/** Push the app's own evaluation metrics so they trend beside Argus's evals. */
export async function pushEvaluation(
  traceId: string,
  evaluation: object | undefined,
): Promise<void> {
  if (!evaluation) return;
  const results = Object.entries(evaluation as Record<string, unknown>)
    .filter(
      (entry): entry is [string, number] =>
        typeof entry[1] === "number" && Number.isFinite(entry[1]),
    )
    .map(([name, score]) => ({
      name: `wlc_${name}`,
      trace_id: traceId,
      score,
      // hallucinationRisk is inverted — a high value is bad.
      passed: name === "hallucinationRisk" ? score < 0.3 : score >= 0.6,
    }));
  if (!results.length) return;

  try {
    await fetch(`${argus.url}/v1/evals/results`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(process.env.ARGUS_API_KEY ? { "X-Argus-Key": process.env.ARGUS_API_KEY } : {}),
      },
      body: JSON.stringify(results),
      signal: AbortSignal.timeout(5000),
    });
  } catch {
    // Telemetry must never fail a chat request.
  }
}
