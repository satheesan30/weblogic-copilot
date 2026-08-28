/**
 * Argus client for TypeScript / Node.
 *
 * Zero dependencies — uses global `fetch` (Node 18+). Copy this single file
 * into your project (e.g. `lib/server/argus.ts`) and import from it; there is
 * nothing to install and no build step.
 *
 *   const argus = new Argus({ url: "http://localhost:8080", project: "weblogic-copilot" });
 *
 *   const trace = argus.trace({ name: "chat", userId, input: question });
 *   const span = trace.span({ name: "generate", type: "llm", model });
 *   const payload = await callModel();
 *   span.fromOpenAI(payload).end({ output: text });
 *   await trace.end({ output: text });
 *
 * Sending is fire-and-forget by default: `trace.end()` resolves as soon as the
 * request is queued, and transport failures are logged rather than thrown.
 * Observability must not take down the application it observes.
 */

export type SpanType =
  | "llm"
  | "tool"
  | "retrieval"
  | "chain"
  | "agent"
  | "guardrail"
  | "embedding";

export type Status = "ok" | "error" | "timeout" | "blocked";

export interface Usage {
  prompt_tokens: number;
  completion_tokens: number;
  cached_tokens: number;
  reasoning_tokens: number;
  total_tokens: number;
}

export interface SpanOptions {
  name: string;
  type?: SpanType;
  provider?: string;
  model?: string;
  input?: unknown;
  parentId?: string;
  metadata?: Record<string, unknown>;
}

export interface TraceOptions {
  name: string;
  id?: string;
  project?: string;
  environment?: string;
  release?: string;
  userId?: string;
  sessionId?: string;
  input?: unknown;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

export interface Finding {
  detector: string;
  category: string;
  severity: "low" | "medium" | "high" | "critical";
  score: number;
  evidence: string;
  action: string;
}

export interface ScanResult {
  surface: string;
  findings: Finding[];
  risk_score: number;
  recommended_action: "allow" | "block";
}

export interface IngestResult {
  trace_id: string;
  spans: number;
  total_tokens: number;
  cost_usd: number;
  unpriced_models: string[];
  risk_score: number;
  findings: number;
  recommended_action: "allow" | "block";
  blocking_findings: { detector: string; severity: string; evidence: string }[];
  evals: Record<string, { score: number; passed: boolean }>;
  warnings: string[];
}

export interface ArgusOptions {
  url?: string;
  apiKey?: string;
  project?: string;
  environment?: string;
  release?: string;
  /** Await delivery instead of firing and forgetting. Useful in tests and in
   *  serverless runtimes that freeze the process after the response. */
  await_?: boolean;
  timeoutMs?: number;
  onError?: (error: unknown) => void;
}

function uid(prefix: string): string {
  const rand =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().replace(/-/g, "")
      : Math.random().toString(16).slice(2).padEnd(24, "0");
  return `${prefix}_${rand.slice(0, 24)}`;
}

const emptyUsage = (): Usage => ({
  prompt_tokens: 0,
  completion_tokens: 0,
  cached_tokens: 0,
  reasoning_tokens: 0,
  total_tokens: 0,
});

export class Span {
  readonly id = uid("span");
  readonly startTime = new Date();
  endTime: Date | null = null;
  status: Status = "ok";
  error: string | null = null;
  output: unknown = null;
  costUsd: number | null = null;
  usage: Usage = emptyUsage();

  readonly traceId: string;
  readonly options: SpanOptions;

  // Written out longhand rather than as constructor parameter properties: those
  // need a real TS compiler and fail under Node's strip-only type stripping.
  constructor(traceId: string, options: SpanOptions) {
    this.traceId = traceId;
    this.options = options;
  }

  setUsage(promptTokens = 0, completionTokens = 0, cachedTokens = 0): this {
    this.usage = {
      prompt_tokens: promptTokens,
      completion_tokens: completionTokens,
      cached_tokens: cachedTokens,
      reasoning_tokens: 0,
      total_tokens: promptTokens + completionTokens,
    };
    return this;
  }

  /**
   * Read usage off an OpenAI-compatible response body — which is what LiteLLM,
   * vLLM, Ollama's OpenAI shim, Together, Groq and Azure OpenAI all return.
   * Handles the `prompt_tokens_details.cached_tokens` field where present, so
   * cache reads are priced at their own rate.
   */
  fromOpenAI(payload: unknown): this {
    const body = payload as {
      model?: string;
      usage?: {
        prompt_tokens?: number;
        completion_tokens?: number;
        total_tokens?: number;
        prompt_tokens_details?: { cached_tokens?: number };
        completion_tokens_details?: { reasoning_tokens?: number };
      };
    };
    if (body?.model && !this.options.model) this.options.model = body.model;
    const u = body?.usage;
    if (u) {
      this.usage = {
        prompt_tokens: u.prompt_tokens ?? 0,
        completion_tokens: u.completion_tokens ?? 0,
        cached_tokens: u.prompt_tokens_details?.cached_tokens ?? 0,
        reasoning_tokens: u.completion_tokens_details?.reasoning_tokens ?? 0,
        total_tokens: u.total_tokens ?? (u.prompt_tokens ?? 0) + (u.completion_tokens ?? 0),
      };
    }
    return this;
  }

  /** Read usage off an Anthropic SDK response. */
  fromAnthropic(response: unknown): this {
    const r = response as {
      model?: string;
      stop_reason?: string;
      usage?: {
        input_tokens?: number;
        output_tokens?: number;
        cache_read_input_tokens?: number;
      };
    };
    if (r?.model && !this.options.model) this.options.model = r.model;
    this.options.provider ??= "anthropic";
    if (r?.usage) {
      this.setUsage(
        r.usage.input_tokens ?? 0,
        r.usage.output_tokens ?? 0,
        r.usage.cache_read_input_tokens ?? 0,
      );
    }
    if (r?.stop_reason === "refusal") this.status = "blocked";
    return this;
  }

  fail(error: unknown): this {
    this.status = "error";
    this.error = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
    return this;
  }

  end(fields: { output?: unknown; status?: Status } = {}): this {
    if (fields.output !== undefined) this.output = fields.output;
    if (fields.status) this.status = fields.status;
    this.endTime = new Date();
    return this;
  }

  toJSON(): Record<string, unknown> {
    return {
      id: this.id,
      trace_id: this.traceId,
      parent_id: this.options.parentId ?? null,
      name: this.options.name,
      type: this.options.type ?? "llm",
      provider: this.options.provider ?? null,
      model: this.options.model ?? null,
      start_time: this.startTime.toISOString(),
      end_time: (this.endTime ?? new Date()).toISOString(),
      input: this.options.input ?? null,
      output: this.output,
      usage: this.usage,
      cost_usd: this.costUsd,
      status: this.status,
      error: this.error,
      metadata: this.options.metadata ?? {},
    };
  }
}

export class Trace {
  readonly id: string;
  readonly startTime = new Date();
  endTime: Date | null = null;
  status: Status = "ok";
  error: string | null = null;
  output: unknown = null;
  readonly spans: Span[] = [];

  private readonly client: Argus;
  readonly options: TraceOptions;

  constructor(client: Argus, options: TraceOptions) {
    this.client = client;
    this.options = options;
    this.id = options.id ?? uid("trace");
  }

  span(options: SpanOptions): Span {
    const s = new Span(this.id, options);
    this.spans.push(s);
    return s;
  }

  fail(error: unknown): this {
    this.status = "error";
    this.error = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
    return this;
  }

  /** Finish the trace and send it. Returns the collector's verdict when the
   *  client is in awaiting mode, otherwise null. */
  async end(fields: { output?: unknown; status?: Status } = {}): Promise<IngestResult | null> {
    if (fields.output !== undefined) this.output = fields.output;
    if (fields.status) this.status = fields.status;
    this.endTime = new Date();
    for (const s of this.spans) if (!s.endTime) s.end();
    return this.client.send(this.toJSON());
  }

  toJSON(): Record<string, unknown> {
    return {
      id: this.id,
      project: this.options.project ?? this.client.project,
      name: this.options.name,
      environment: this.options.environment ?? this.client.environment,
      release: this.options.release ?? this.client.release ?? null,
      user_id: this.options.userId ?? null,
      session_id: this.options.sessionId ?? null,
      input: this.options.input ?? null,
      output: this.output,
      tags: this.options.tags ?? [],
      metadata: this.options.metadata ?? {},
      start_time: this.startTime.toISOString(),
      end_time: (this.endTime ?? new Date()).toISOString(),
      status: this.status,
      error: this.error,
      spans: this.spans.map((s) => s.toJSON()),
    };
  }
}

export class Argus {
  readonly url: string;
  readonly project: string;
  readonly environment: string;
  readonly release?: string;
  private readonly apiKey?: string;
  private readonly awaitDelivery: boolean;
  private readonly timeoutMs: number;
  private readonly onError: (error: unknown) => void;
  private readonly inFlight = new Set<Promise<unknown>>();

  constructor(options: ArgusOptions = {}) {
    this.url = (options.url ?? process.env.ARGUS_URL ?? "http://localhost:8080").replace(/\/$/, "");
    this.project = options.project ?? "default";
    this.environment = options.environment ?? process.env.NODE_ENV ?? "production";
    this.release = options.release;
    this.apiKey = options.apiKey ?? process.env.ARGUS_API_KEY;
    this.awaitDelivery = options.await_ ?? false;
    this.timeoutMs = options.timeoutMs ?? 5000;
    this.onError =
      options.onError ??
      ((e) => console.warn("[argus] dropped telemetry:", e instanceof Error ? e.message : e));
  }

  private headers(): Record<string, string> {
    const h: Record<string, string> = { "Content-Type": "application/json" };
    if (this.apiKey) h["X-Argus-Key"] = this.apiKey;
    return h;
  }

  private async post<T>(path: string, body: unknown): Promise<T> {
    const response = await fetch(`${this.url}${path}`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    if (!response.ok) {
      throw new Error(`argus ${path} failed: ${response.status} ${await response.text()}`);
    }
    return (await response.json()) as T;
  }

  trace(options: TraceOptions): Trace {
    return new Trace(this, options);
  }

  /** Run `fn` inside a trace, recording failures and always sending. */
  async withTrace<T>(options: TraceOptions, fn: (trace: Trace) => Promise<T>): Promise<T> {
    const trace = this.trace(options);
    try {
      const result = await fn(trace);
      await trace.end();
      return result;
    } catch (error) {
      trace.fail(error);
      await trace.end();
      throw error;
    }
  }

  async send(payload: Record<string, unknown>): Promise<IngestResult | null> {
    if (this.awaitDelivery) {
      try {
        return await this.post<IngestResult>("/v1/traces", payload);
      } catch (error) {
        this.onError(error);
        return null;
      }
    }
    const task = this.post<IngestResult>("/v1/traces", payload).catch(this.onError);
    this.inFlight.add(task);
    void task.finally(() => this.inFlight.delete(task));
    return null;
  }

  /**
   * Synchronous safety check — no model call, sub-millisecond.
   * Throws on transport failure even in fire-and-forget mode: a guardrail that
   * silently fails open is worse than no guardrail. Decide explicitly at the
   * call site whether to fail open or closed.
   */
  async scan(text: unknown, surface: "input" | "output" = "input"): Promise<ScanResult> {
    return this.post<ScanResult>("/v1/security/scan", { text, surface });
  }

  /** Await every queued send. Call before a serverless handler returns. */
  async flush(): Promise<void> {
    await Promise.allSettled([...this.inFlight]);
  }
}

export default Argus;
