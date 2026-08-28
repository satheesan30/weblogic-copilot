"use client";

import { useCallback, useEffect, useState } from "react";
import { promptChips } from "@/lib/mock-data";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { RefreshCw, SendHorizontal } from "lucide-react";
import type { ChatApiResponse, ChatModelOption, ChatRequestMessage } from "@/types/backend";

interface PromptComposerProps {
  history?: ChatRequestMessage[];
  conversationId?: string;
  onAssistantResponse?: (message: string, response: ChatApiResponse) => void;
  onAssistantStreamStart?: () => string;
  onAssistantToken?: (id: string, token: string) => void;
  onAssistantStreamDone?: (id: string, response: ChatApiResponse) => void;
  onAssistantStreamError?: (id: string, message: string) => void;
  onUserMessage?: (message: string) => void;
}

export function PromptComposer({
  history = [],
  conversationId,
  onAssistantResponse,
  onAssistantStreamStart,
  onAssistantToken,
  onAssistantStreamDone,
  onAssistantStreamError,
  onUserMessage,
}: PromptComposerProps) {
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [models, setModels] = useState<ChatModelOption[]>([]);
  const [selectedModel, setSelectedModel] = useState("");
  const [modelStatus, setModelStatus] = useState("Loading configured models...");

  const applyModelPayload = useCallback((payload: { defaultModel?: string; hiddenEmbeddingModels?: number; models?: ChatModelOption[]; provider?: string }) => {
    const runningModels = payload.models || [];
    setModels(runningModels);
    setSelectedModel((current) => {
      if (runningModels.some((model) => model.model === current)) return current;
      if (runningModels.some((model) => model.model === payload.defaultModel)) return payload.defaultModel || "";
      return runningModels[0]?.model || payload.defaultModel || "";
    });
    const hiddenText = payload.hiddenEmbeddingModels ? `, ${payload.hiddenEmbeddingModels} embedding model(s) hidden` : "";
    const provider = payload.provider || "configured provider";
    setModelStatus(runningModels.length ? `${runningModels.length} chat model(s) from ${provider}${hiddenText}` : `No configured chat model. Default: ${payload.defaultModel}${hiddenText}`);
  }, []);

  useEffect(() => {
    let active = true;

    async function loadInitialModels() {
      try {
        const payload = await fetchRunningModels();
        if (!active) return;
        applyModelPayload(payload);
      } catch (caughtError) {
        if (!active) return;
        setModels([]);
        setModelStatus(caughtError instanceof Error ? caughtError.message : "Could not load configured models.");
      }
    }

    void loadInitialModels();
    return () => {
      active = false;
    };
  }, [applyModelPayload]);

  async function loadRunningModels() {
    setModelStatus("Loading configured models...");
    try {
      const payload = await fetchRunningModels();
      applyModelPayload(payload);
    } catch (caughtError) {
      setModels([]);
      setModelStatus(caughtError instanceof Error ? caughtError.message : "Could not load configured models.");
    }
  }

  async function handleSubmit() {
    const trimmedMessage = message.trim();
    if (!trimmedMessage) return;

    setLoading(true);
    setError("");
    onUserMessage?.(trimmedMessage);
    setMessage("");

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: trimmedMessage,
          model: selectedModel || undefined,
          history,
          conversationId: conversationId || undefined,
          stream: true,
        }),
      });

      if (response.headers.get("content-type")?.includes("text/event-stream")) {
        await consumeStream(response);
      } else {
        const payload = await readJsonResponse(response);
        if (!response.ok) throw new Error(payload.error || "Chat request failed.");
        onAssistantResponse?.(trimmedMessage, payload as ChatApiResponse);
      }
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Chat request failed.");
    } finally {
      setLoading(false);
    }
  }

  async function consumeStream(response: Response) {
    if (!response.body) throw new Error("Chat request failed.");
    const messageId = onAssistantStreamStart?.();
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const events = buffer.split("\n\n");
      buffer = events.pop() || "";

      for (const rawEvent of events) {
        const line = rawEvent.trim();
        if (!line.startsWith("data:")) continue;
        const parsed = JSON.parse(line.slice(5).trim()) as
          | { type: "token"; value: string }
          | { type: "done"; response: ChatApiResponse }
          | { type: "error"; error: string };

        if (parsed.type === "token" && messageId) {
          onAssistantToken?.(messageId, parsed.value);
        } else if (parsed.type === "done" && messageId) {
          onAssistantStreamDone?.(messageId, parsed.response);
        } else if (parsed.type === "error") {
          if (messageId) onAssistantStreamError?.(messageId, parsed.error);
          throw new Error(parsed.error);
        }
      }
    }
  }

  return (
    <div className="desk-panel p-4">
      <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
        <Textarea
          aria-label="Chat message"
          className="min-h-24"
          onChange={(event) => setMessage(event.target.value)}
          placeholder="Ask about WebLogic configuration, BEA errors, JDBC, JMS, Node Manager, WLST, clustering, or logs..."
          value={message}
        />
        <Button className="self-end" disabled={loading} onClick={handleSubmit} size="lg" type="button">
          <SendHorizontal className="h-4 w-4" aria-hidden="true" />
          {loading ? "Sending" : "Send"}
        </Button>
      </div>
      {error ? <p className="mt-3 border border-danger/25 bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p> : null}

      <div className="mt-3 grid gap-2 border border-line bg-paper-2/60 p-3 md:grid-cols-[1fr_auto] md:items-end">
        <label className="grid gap-1.5 text-sm font-semibold text-ink">
          Chat model route
          <Select disabled={loading} onChange={(event) => setSelectedModel(event.target.value)} value={selectedModel}>
            {models.length ? (
              models.map((model) => (
                <option key={model.model} value={model.model}>
                  {model.model}
                </option>
              ))
            ) : (
              <option value={selectedModel}>{selectedModel || "No configured model"}</option>
            )}
          </Select>
        </label>
        <Button disabled={loading} onClick={loadRunningModels} type="button" variant="outline">
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          Refresh
        </Button>
        <p className="font-mono text-[11px] text-ink-soft md:col-span-2">{modelStatus}</p>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {promptChips.map((prompt) => (
          <button
            className="border border-line bg-paper px-3 py-1.5 text-xs font-semibold text-ink-soft transition hover:border-forest hover:bg-mist/40 hover:text-ink"
            key={prompt}
            onClick={() => setMessage((current) => (current ? `${current}\n${prompt}` : prompt))}
            type="button"
          >
            {prompt}
          </button>
        ))}
      </div>
    </div>
  );
}

async function readJsonResponse(response: Response) {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { error: text };
  }
}

async function fetchRunningModels() {
  const response = await fetch("/api/models", { cache: "no-store" });
  const payload = await readJsonResponse(response);
  if (!response.ok) throw new Error(payload.error || "Could not load configured models.");
  return payload as { defaultModel?: string; hiddenEmbeddingModels?: number; models?: ChatModelOption[]; provider?: string };
}
