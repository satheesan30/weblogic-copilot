import { NextResponse } from "next/server";
import { runChatAgent } from "@/lib/server/agent";
import { getAppConfig } from "@/lib/server/config";
import { evaluateChatResponse } from "@/lib/server/evaluation";
import { appendObservabilityEvent } from "@/lib/server/observability";
import type { AppConfig, ChatApiRequest, ChatApiResponse, EvaluationMetrics, ObservabilityEvent } from "@/types/backend";
import { getCurrentSession } from "@/lib/server/auth";
import { langGraphEnabled, recordLangGraphFailure, resolveConversation, runLangGraphAgent } from "@/lib/server/langgraph-agent";
import { argus, collectedLlmCalls, guard, pushEvaluation, withLlmUsage } from "@/lib/server/argus";

export const runtime = "nodejs";

export async function POST(request: Request) {
  // Everything inside runs with a request-scoped LLM usage collector attached.
  return withLlmUsage(() => handleChat(request));
}

async function handleChat(request: Request) {
  const startedAt = Date.now();
  let question = "";
  let requestedModel = "";
  let config: AppConfig | undefined;
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = (await request.json()) as ChatApiRequest;
    question = body.message?.trim() || "";
    requestedModel = body.model || "";

    if (!question) {
      await recordChatEvent({
        id: crypto.randomUUID(),
        ownerUsername: session.sub,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        timestamp: new Date().toISOString(),
        questionPreview: "Empty message",
        mode: "unknown",
        model: requestedModel || "unknown",
        status: "error",
        latencyMs: Date.now() - startedAt,
        retrievalCount: 0,
        agentStepCount: 0,
        error: "Message is required.",
      });

      return NextResponse.json({ error: "Message is required." }, { status: 400 });
    }

    // Pre-flight safety check before the question reaches the model.
    const check = await guard(question);
    if (check.blocked) {
      await recordChatEvent({
        id: crypto.randomUUID(),
        ownerUsername: session.sub,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        timestamp: new Date().toISOString(),
        questionPreview: previewQuestion(question),
        mode: "unknown",
        model: requestedModel || "unknown",
        status: "error",
        latencyMs: Date.now() - startedAt,
        retrievalCount: 0,
        agentStepCount: 0,
        error: "Blocked by safety policy.",
      });
      return NextResponse.json(
        { error: "That request was blocked by the safety policy." },
        { status: 400 },
      );
    }

    config = await getAppConfig();
    const conversationId = await resolveConversation(session.sub, body.conversationId);
    if (!conversationId) return NextResponse.json({ error: "Conversation not found." }, { status: 404 });

    if (body.stream && !langGraphEnabled()) {
      return streamChatResponse({ config, question, body, ownerUsername: session.sub, conversationId, requestedModel, startedAt });
    }

    let response;
    let graph: NonNullable<ChatApiResponse["graph"]> = { enabled: langGraphEnabled(), fallback: false };
    if (langGraphEnabled()) {
      try {
        const result = await runLangGraphAgent(config, question, body, session.sub, conversationId);
        response = result.response;
        graph = { enabled: true, fallback: false, specialist: result.specialist, nodes: result.graphNodes };
      } catch (error) {
        await recordLangGraphFailure();
        response = await runChatAgent(config, question, body, session.sub);
        graph = { enabled: true, fallback: true, failure: error instanceof Error ? error.message : "LangGraph execution failed." };
      }
    } else {
      response = await runChatAgent(config, question, body, session.sub);
    }
    response = { ...response, conversationId, graph };
    const evaluation = evaluateChatResponse(response);
    await recordChatEvent({
      id: crypto.randomUUID(),
      ownerUsername: session.sub,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      timestamp: new Date().toISOString(),
      questionPreview: previewQuestion(question),
      mode: response.agentTrace?.mode || "unknown",
      model: requestedModel || config.llm.model,
      status: "success",
      latencyMs: Date.now() - startedAt,
      retrievalCount: response.evidence.length,
      agentStepCount: response.agentTrace?.steps.length || 0,
      confidence: response.confidence,
      evaluation,
      graph,
    });

    await emitArgusTrace({
      question,
      response,
      evaluation,
      session: session.sub,
      conversationId,
      requestedModel: requestedModel || config.llm.model,
      startedAt,
      graph,
    });

    return NextResponse.json(response);
  } catch (error) {
    await recordChatEvent({
      id: crypto.randomUUID(),
      ownerUsername: session.sub,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      timestamp: new Date().toISOString(),
      questionPreview: previewQuestion(question),
      mode: "unknown",
      model: requestedModel || config?.llm.model || "unknown",
      status: "error",
      latencyMs: Date.now() - startedAt,
      retrievalCount: 0,
      agentStepCount: 0,
      error: error instanceof Error ? error.message : "Chat request failed.",
    });

    const failed = argus.trace({
      name: "chat",
      userId: session.sub,
      input: question,
      metadata: { requestedModel },
    });
    failed.fail(error);
    await failed.end({ status: "error" });

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Chat request failed.",
      },
      { status: 500 },
    );
  }
}

/**
 * Send one Argus trace per chat request: a retrieval span when evidence was
 * used, and one llm span per model call the collector saw.
 */
async function emitArgusTrace(input: {
  question: string;
  response: ChatApiResponse;
  evaluation?: EvaluationMetrics;
  session: string;
  conversationId?: string;
  requestedModel: string;
  startedAt: number;
  graph?: ChatApiResponse["graph"];
}) {
  try {
    const trace = argus.trace({
      name: "chat",
      userId: input.session,
      sessionId: input.conversationId,
      input: input.question,
      tags: input.graph?.enabled ? ["langgraph"] : ["agent"],
      metadata: {
        mode: input.response.agentTrace?.mode,
        specialist: input.response.agentTrace?.specialist,
        requestedModel: input.requestedModel,
        graphFallback: input.graph?.fallback ?? false,
      },
    });

    if (input.response.evidence.length) {
      trace
        .span({ name: "vector_search", type: "retrieval" })
        .end({ output: input.response.evidence });
    }

    const calls = collectedLlmCalls();
    if (calls.length) {
      for (const call of calls) {
        trace
          .span({
            name: "generate",
            type: "llm",
            model: call.model || input.requestedModel,
            metadata: { streamed: call.streamed },
          })
          .setUsage(call.promptTokens, call.completionTokens, call.cachedTokens)
          .end({ output: input.response.answer });
      }
    } else {
      // No usage was captured (streaming server that does not emit it) — still
      // record the call so latency and error rate stay accurate.
      trace
        .span({ name: "generate", type: "llm", model: input.requestedModel })
        .end({ output: input.response.answer });
    }

    await trace.end({ output: input.response.answer });
    await pushEvaluation(trace.id, input.evaluation);
  } catch {
    // Telemetry must never fail a chat request.
  }
}

function streamChatResponse({
  config,
  question,
  body,
  ownerUsername,
  conversationId,
  requestedModel,
  startedAt,
}: {
  config: AppConfig;
  question: string;
  body: ChatApiRequest;
  ownerUsername: string;
  conversationId: string;
  requestedModel: string;
  startedAt: number;
}) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      function send(event: Record<string, unknown>) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      }

      try {
        const response = await runChatAgent(config, question, body, ownerUsername, (token) => send({ type: "token", value: token }));
        const finalResponse: ChatApiResponse = { ...response, conversationId, graph: { enabled: false, fallback: false } };
        const evaluation = evaluateChatResponse(finalResponse);

        await recordChatEvent({
          id: crypto.randomUUID(),
          ownerUsername,
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          timestamp: new Date().toISOString(),
          questionPreview: previewQuestion(question),
          mode: finalResponse.agentTrace?.mode || "unknown",
          model: requestedModel || config.llm.model,
          status: "success",
          latencyMs: Date.now() - startedAt,
          retrievalCount: finalResponse.evidence.length,
          agentStepCount: finalResponse.agentTrace?.steps.length || 0,
          confidence: finalResponse.confidence,
          evaluation,
          graph: finalResponse.graph,
        });

        send({ type: "done", response: finalResponse });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Chat request failed.";
        await recordChatEvent({
          id: crypto.randomUUID(),
          ownerUsername,
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          timestamp: new Date().toISOString(),
          questionPreview: previewQuestion(question),
          mode: "unknown",
          model: requestedModel || config.llm.model,
          status: "error",
          latencyMs: Date.now() - startedAt,
          retrievalCount: 0,
          agentStepCount: 0,
          error: message,
        });
        send({ type: "error", error: message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}

async function recordChatEvent(event: ObservabilityEvent) {
  try {
    await appendObservabilityEvent(event);
  } catch {
    // Telemetry must never break the chat path.
  }
}

function previewQuestion(question: string) {
  if (!question) return "No message captured";
  return question.length > 140 ? `${question.slice(0, 137)}...` : question;
}
