import { redirect } from "next/navigation";
import { MetricCard, ScoreBar } from "@/components/ai-ops/metric-card";
import { TelemetryChart } from "@/components/ai-ops/telemetry-chart";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getAiOpsSummary } from "@/lib/server/ai-ops";
import { getCurrentSession } from "@/lib/server/auth";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Database,
  Gauge,
  GitBranch,
  Lock,
  Route,
  ShieldCheck,
} from "lucide-react";

export const dynamic = "force-dynamic";

export default async function AiOpsPage() {
  const session = await getCurrentSession();
  if (!session) redirect("/login?redirect=/ai-ops");

  const summary = await getAiOpsSummary(session.sub);
  const latestEvaluation = summary.evaluation.latest;

  return (
    <AppShell>
      <PageHeader
        actions={
          <>
            <Badge>
              <Activity className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
              Local telemetry
            </Badge>
            <Badge variant="success">
              <ShieldCheck className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
              Read-only
            </Badge>
          </>
        }
        description="Track answer quality, chat requests, retrieval health, data readiness, agentic orchestration, and governance signals."
        eyebrow="AI operations"
        title="Evaluation and observability"
      />

      <section className="desk-panel mb-5 overflow-hidden">
        <div className="grid gap-4 p-5 lg:grid-cols-[1.2fr_0.8fr] lg:items-end">
          <div>
            <p className="mono-label">Signal path</p>
            <h2 className="mt-2 max-w-2xl font-display text-2xl font-semibold tracking-tight text-ink">
              Question → evidence → answer quality
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-soft">
              Local dashboard for chat events, retrieval health, data readiness, governance signals, and deterministic
              evaluation.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 border-t border-line pt-4 lg:border-t-0 lg:border-l lg:pl-5 lg:pt-0">
            <InfoTile label="Mode" value={summary.orchestration.latestMode} />
            <InfoTile label="Latency" value={`${summary.orchestration.latestLatencyMs} ms`} />
          </div>
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-4">
        <MetricCard
          description="Average score from successful chat requests with deterministic local evaluation."
          icon={Gauge}
          label="Avg confidence"
          tone={summary.evaluation.averageConfidence >= 70 ? "good" : "warning"}
          value={`${summary.evaluation.averageConfidence}%`}
        />
        <MetricCard
          description="Total chat API calls captured in local JSONL telemetry."
          icon={Activity}
          label="Requests"
          value={summary.observability.totalRequests}
        />
        <MetricCard
          description="Failure ratio across captured chat requests."
          icon={AlertTriangle}
          label="Error rate"
          tone={summary.observability.errorRate ? "danger" : "good"}
          value={`${summary.observability.errorRate}%`}
        />
        <MetricCard
          description="Indexed document chunks available to the retrieval layer."
          icon={Database}
          label="Indexed chunks"
          tone={summary.dataFoundation.totalChunks ? "good" : "warning"}
          value={summary.dataFoundation.totalChunks}
        />
      </div>

      <Card className="mt-5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-forest" aria-hidden="true" />
            Latency and confidence trend
          </CardTitle>
          <CardDescription>Recent chat requests, most recent on the right.</CardDescription>
        </CardHeader>
        <CardContent>
          <TelemetryChart timeline={summary.observability.timeline} />
        </CardContent>
      </Card>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-forest" aria-hidden="true" />
              Evaluation
            </CardTitle>
            <CardDescription>Rule-based answer quality metrics. No additional model call is used for scoring.</CardDescription>
          </CardHeader>
          <CardContent>
            {latestEvaluation ? (
              <div className="grid gap-4 md:grid-cols-2">
                <ScoreBar label="Confidence" value={latestEvaluation.confidence} />
                <ScoreBar label="Groundedness" value={latestEvaluation.groundedness} />
                <ScoreBar label="Citation coverage" value={latestEvaluation.citationCoverage} />
                <ScoreBar label="Evidence sufficiency" value={latestEvaluation.evidenceSufficiency} />
                <ScoreBar label="Hallucination risk" value={latestEvaluation.hallucinationRisk} inverse />
                <ScoreBar label="Action safety" value={latestEvaluation.actionSafety} />
              </div>
            ) : (
              <EmptyState title="No evaluation events yet" description="Send a chat message to create the first local evaluation record." />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-forest" aria-hidden="true" />
              Observability
            </CardTitle>
            <CardDescription>Request volume, latency, errors, and model usage from local telemetry.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <InfoTile label="Success" value={summary.observability.successfulRequests} />
              <InfoTile label="Failed" value={summary.observability.failedRequests} />
              <InfoTile label="Avg latency" value={`${summary.observability.averageLatencyMs} ms`} />
              <InfoTile label="Latest status" value={summary.orchestration.latestStatus} />
            </div>
            <div className="border border-line bg-paper-2/60 p-4">
              <p className="text-sm font-semibold text-ink">Model usage</p>
              <div className="mt-3 space-y-2">
                {summary.observability.modelUsage.length ? (
                  summary.observability.modelUsage.map((item) => <InfoRow key={item.model} label={item.model} value={item.count} />)
                ) : (
                  <p className="text-sm text-ink-soft">No model calls captured yet.</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5 text-forest" aria-hidden="true" />
              Data foundation
            </CardTitle>
            <CardDescription>Documents, chunks, memory, and vector configuration that support retrieval.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <InfoRow label="Documents" value={summary.dataFoundation.documentCount} />
            <InfoRow label="Indexed documents" value={summary.dataFoundation.indexedDocumentCount} />
            <InfoRow label="Failed documents" value={summary.dataFoundation.failedDocumentCount} />
            <InfoRow label="Agent memory items" value={summary.dataFoundation.memoryCount} />
            <InfoRow label="Vector store" value={summary.dataFoundation.vectorStoreProvider} />
            <InfoRow label="Collection" value={summary.dataFoundation.vectorCollection} />
            <InfoRow label="Embedding model" value={summary.dataFoundation.embeddingModel} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <GitBranch className="h-5 w-5 text-forest" aria-hidden="true" />
              Orchestration
            </CardTitle>
            <CardDescription>Latest agent loop mode and routing behavior.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <InfoRow label="Latest mode" value={summary.orchestration.latestMode} />
            <InfoRow label="Agent steps" value={summary.orchestration.latestStepCount} />
            <InfoRow label="Latest latency" value={`${summary.orchestration.latestLatencyMs} ms`} />
            <InfoRow label="Latest status" value={summary.orchestration.latestStatus} />
            <div className="border border-line bg-paper-2/70 p-4 text-sm leading-6 text-ink-soft">
              <Route className="mb-2 h-5 w-5 text-forest" aria-hidden="true" />
              General questions skip retrieval. Operational WebLogic questions enter agentic RAG mode: retrieve, assess,
              optionally rewrite the query, then generate.
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5 text-forest" aria-hidden="true" />
              Governance
            </CardTitle>
            <CardDescription>Current local POC safety and control signals.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <InfoRow label="Page auth" value={summary.governance.authProtected ? "Protected" : "Open"} />
            <InfoRow label="API auth" value={summary.governance.apiProtected ? "Protected" : "Open"} />
            <InfoRow label="Telemetry" value={summary.governance.localTelemetry ? "Local JSONL" : "Disabled"} />
            <InfoRow label="Citation mode" value={summary.governance.citationMode} />
            <div className="border border-line bg-paper-2/50 p-4">
              <p className="text-sm font-semibold text-ink">Prompt guardrails</p>
              <ul className="mt-3 space-y-2 text-sm leading-6 text-ink-soft">
                {summary.governance.promptGuardrails.map((guardrail) => (
                  <li className="flex gap-2" key={guardrail}>
                    <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-forest" aria-hidden="true" />
                    <span>{guardrail}</span>
                  </li>
                ))}
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-5">
        <CardHeader>
          <CardTitle>Latest telemetry events</CardTitle>
          <CardDescription>Most recent chat requests recorded by the local backend.</CardDescription>
        </CardHeader>
        <CardContent>
          {summary.observability.latestEvents.length ? (
            <div className="overflow-hidden border border-line">
              <div className="grid grid-cols-[1fr_auto_auto] gap-3 border-b border-line bg-paper-2/70 px-4 py-3 font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-ink-soft md:grid-cols-[1fr_120px_120px_110px]">
                <span>Question</span>
                <span>Mode</span>
                <span>Latency</span>
                <span className="hidden md:block">Status</span>
              </div>
              {summary.observability.latestEvents.map((event) => (
                <div
                  className="grid grid-cols-[1fr_auto_auto] gap-3 border-b border-line px-4 py-3 text-sm last:border-0 md:grid-cols-[1fr_120px_120px_110px]"
                  key={event.id}
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium text-ink">{event.questionPreview}</p>
                    <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.12em] text-ink-soft">
                      {new Date(event.timestamp).toLocaleString()}
                    </p>
                  </div>
                  <span className="font-semibold text-ink-soft">{event.mode}</span>
                  <span className="font-semibold text-ink-soft">{event.latencyMs} ms</span>
                  <span className="hidden md:block">
                    <Badge variant={event.status === "success" ? "success" : "danger"}>{event.status}</Badge>
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              title="No telemetry yet"
              description="Use the chat page once, then return here to see request metrics and evaluation scores."
            />
          )}
        </CardContent>
      </Card>
    </AppShell>
  );
}

function InfoTile({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="border border-line bg-paper-2/50 p-4">
      <p className="mono-label">{label}</p>
      <p className="mt-2 truncate font-display text-lg font-semibold text-ink">{value}</p>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-center justify-between gap-4 border border-line bg-paper-2/40 px-3 py-2 text-sm">
      <span className="text-ink-soft">{label}</span>
      <span className="truncate text-right font-semibold text-ink">{value}</span>
    </div>
  );
}

function EmptyState({ description, title }: { description: string; title: string }) {
  return (
    <div className="border border-dashed border-line bg-paper-2/50 p-6 text-center">
      <p className="font-display font-semibold text-ink">{title}</p>
      <p className="mt-2 text-sm leading-6 text-ink-soft">{description}</p>
    </div>
  );
}
