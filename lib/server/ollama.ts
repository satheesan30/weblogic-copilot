import type { AppConfig, ChatModelOption, ChatRequestMessage } from "@/types/backend";
import { recordLlmCall } from "@/lib/server/argus";

const EMBEDDING_CACHE_TTL_MS = 10 * 60 * 1000;
const MAX_CACHED_EMBEDDINGS = 256;
const embeddingCache = new Map<string, { expiresAt: number; value: Promise<number[]> }>();

export async function embedText(config: AppConfig, input: string): Promise<number[]> {
  const cacheKey = `${config.vectorStore.embeddingEndpoint}\u0000${config.vectorStore.embeddingModel}\u0000${input}`;
  const cached = embeddingCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  const pending = requestEmbedding(config, input);
  embeddingCache.set(cacheKey, { expiresAt: Date.now() + EMBEDDING_CACHE_TTL_MS, value: pending });
  if (embeddingCache.size > MAX_CACHED_EMBEDDINGS) {
    const oldestKey = embeddingCache.keys().next().value;
    if (oldestKey) embeddingCache.delete(oldestKey);
  }
  try {
    return await pending;
  } catch (error) {
    embeddingCache.delete(cacheKey);
    throw error;
  }
}

async function requestEmbedding(config: AppConfig, input: string): Promise<number[]> {
  const response = await fetch(config.vectorStore.embeddingEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: config.vectorStore.embeddingModel,
      input,
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    if (detail.includes("model") && detail.includes("not found")) {
      throw new Error(`Embedding model '${config.vectorStore.embeddingModel}' is not installed. Run: ollama pull ${config.vectorStore.embeddingModel}`);
    }
    throw new Error(`Ollama embedding request failed: ${response.status} ${detail}`);
  }

  const payload = await response.json();
  const embedding = payload.embedding || payload.embeddings?.[0];
  if (!Array.isArray(embedding)) {
    throw new Error("Ollama embedding response did not contain an embedding array.");
  }
  return embedding;
}

export async function chatWithModel(config: AppConfig, messages: ChatRequestMessage[], modelOverride?: string) {
  const model = modelOverride || config.llm.model;

  if (isEmbeddingOnlyModel(model)) {
    throw new Error(`'${model}' is an embedding model and cannot be used for chat. Select a chat model such as '${config.llm.model}'.`);
  }

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const liteLlmKey = liteLlmMasterKey(config);
  if (liteLlmKey) {
    headers.Authorization = `Bearer ${liteLlmKey}`;
  }

  const response = await fetch(config.llm.endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model,
      messages,
      temperature: config.llm.temperature,
      stream: false,
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    if (detail.includes("model") && detail.includes("not found")) {
      throw new Error(`Chat model '${model}' is not installed. Run: ollama pull ${model}`);
    }
    if (detail.includes("does not support chat")) {
      throw new Error(`'${model}' does not support chat. Select a chat model such as '${config.llm.model}'.`);
    }
    throw new Error(`${providerLabel(config.llm.provider)} chat request failed: ${response.status} ${detail}`);
  }

  const payload = await response.json();

  // LiteLLM already returns token counts on every call; before this they were
  // discarded here, which is why nothing downstream could report cost.
  recordLlmCall({
    model: payload.model || model,
    promptTokens: payload.usage?.prompt_tokens ?? 0,
    completionTokens: payload.usage?.completion_tokens ?? 0,
    cachedTokens: payload.usage?.prompt_tokens_details?.cached_tokens ?? 0,
    streamed: false,
    payload,
  });

  return payload.choices?.[0]?.message?.content || payload.message?.content || "No answer was returned by the model.";
}

export async function chatWithModelStream(
  config: AppConfig,
  messages: ChatRequestMessage[],
  modelOverride: string | undefined,
  onToken: (token: string) => void,
): Promise<string> {
  const model = modelOverride || config.llm.model;

  if (isEmbeddingOnlyModel(model)) {
    throw new Error(`'${model}' is an embedding model and cannot be used for chat. Select a chat model such as '${config.llm.model}'.`);
  }

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const liteLlmKey = liteLlmMasterKey(config);
  if (liteLlmKey) {
    headers.Authorization = `Bearer ${liteLlmKey}`;
  }

  const response = await fetch(config.llm.endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model,
      messages,
      temperature: config.llm.temperature,
      stream: true,
    }),
  });

  if (!response.ok || !response.body) {
    const detail = await response.text().catch(() => "");
    if (detail.includes("model") && detail.includes("not found")) {
      throw new Error(`Chat model '${model}' is not installed. Run: ollama pull ${model}`);
    }
    throw new Error(`${providerLabel(config.llm.provider)} chat request failed: ${response.status} ${detail}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let full = "";
  let streamUsage: { prompt_tokens?: number; completion_tokens?: number;
    prompt_tokens_details?: { cached_tokens?: number } } | undefined;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const payload = trimmed.slice(5).trim();
      if (payload === "[DONE]") continue;
      try {
        const parsed = JSON.parse(payload);
        // Some OpenAI-compatible servers emit a final usage-bearing chunk. Take
        // it when offered; the request body is left untouched so nothing about
        // the stream's behaviour changes.
        if (parsed.usage) streamUsage = parsed.usage;
        const delta: string = parsed.choices?.[0]?.delta?.content || "";
        if (delta) {
          full += delta;
          onToken(delta);
        }
      } catch {
        // Ignore malformed SSE fragments; the stream will keep flowing.
      }
    }
  }

  recordLlmCall({
    model,
    promptTokens: streamUsage?.prompt_tokens ?? 0,
    completionTokens: streamUsage?.completion_tokens ?? 0,
    cachedTokens: streamUsage?.prompt_tokens_details?.cached_tokens ?? 0,
    streamed: true,
  });

  return full || "No answer was returned by the model.";
}

export async function listRunningOllamaModels(config: AppConfig): Promise<ChatModelOption[]> {
  const response = await fetch(`${getOllamaBaseUrl(config.llm.endpoint)}/api/ps`, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Could not list running Ollama models: ${response.status} ${await response.text()}`);
  }

  const payload = await response.json();
  return (payload.models || []).map((model: { name?: string; model?: string; size?: number; expires_at?: string }) => ({
    name: model.name || model.model || "unknown",
    model: model.model || model.name || "unknown",
    size: model.size,
    expiresAt: model.expires_at,
  }));
}

export async function listChatModels(config: AppConfig): Promise<ChatModelOption[]> {
  if (isLiteLlmProvider(config.llm.provider)) {
    return config.llm.modelOptions.map((model) => ({
      name: model,
      model,
    }));
  }

  const models = await listRunningOllamaModels(config);
  return models.filter((model) => !isEmbeddingOnlyModel(model.model));
}

export function isEmbeddingOnlyModel(model: string) {
  const normalized = model.toLowerCase();
  return (
    normalized.includes("embed") ||
    normalized.includes("embedding") ||
    normalized.startsWith("nomic-embed") ||
    normalized.startsWith("mxbai-embed") ||
    normalized.startsWith("bge-") ||
    normalized.startsWith("all-minilm")
  );
}

function getOllamaBaseUrl(endpoint: string) {
  const url = new URL(endpoint);
  return `${url.protocol}//${url.host}`;
}

function isLiteLlmProvider(provider: string) {
  return provider.toLowerCase() === "litellm";
}

function providerLabel(provider: string) {
  return isLiteLlmProvider(provider) ? "LiteLLM" : "Ollama";
}

export function liteLlmMasterKey(config: AppConfig) {
  if (!isLiteLlmProvider(config.llm.provider)) return "";
  const configuredKey = config.llm.apiKeyEnv ? process.env[config.llm.apiKeyEnv] : "";
  return configuredKey || "";
}
