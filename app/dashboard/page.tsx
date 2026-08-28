import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Activity,
  AlertTriangle,
  Bot,
  Compass,
  FileUp,
  FolderOpen,
  Gauge,
  Radio,
  Sparkles,
} from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { MetricCard } from "@/components/ai-ops/metric-card";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentSession } from "@/lib/server/auth";
import { getAiOpsSummary } from "@/lib/server/ai-ops";
import { getFdeSummary } from "@/lib/server/fde/summary";
import { listStoredDocuments } from "@/lib/server/storage";
import { listLiveAlerts, listLiveStreams } from "@/lib/server/live-logs/store";

export const dynamic = "force-dynamic";

const quickActions = [
  { href: "/chat", label: "Start investigation", description: "Ask a WebLogic question grounded in your evidence.", icon: Sparkles },
  { href: "/upload", label: "Ingest evidence", description: "Upload logs, configs, or runbooks for indexing.", icon: FileUp },
  { href: "/live-logs", label: "Watch live signals", description: "Push or tail a WebLogic log in real time.", icon: Radio },
  { href: "/fde", label: "Open solution desk", description: "Score a new AI opportunity and design its workflow.", icon: Compass },
];

export default async function DashboardPage() {
  const session = await getCurrentSession();
  if (!session) redirect("/login?redirect=/dashboard");

  const [aiOps, fde, documents, alerts, streams] = await Promise.all([
    getAiOpsSummary(session.sub),
    getFdeSummary(),
    listStoredDocuments(session.sub),
    listLiveAlerts(session.sub, 5),
    listLiveStreams(session.sub),
  ]);

  const recentDocuments = documents.slice(0, 5);
  const activeStreams = streams.filter((stream) => stream.status === "active").length;

  return (
    <AppShell>
      <PageHeader
        actions={
          <Badge variant="success">
            <Activity className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
            {session.sub}
          </Badge>
        }
        description="A single view of evidence health, live signals, and solution-desk pipeline for this workspace."
        eyebrow="Command overview"
        title="Dashboard"
      />

      <div className="grid gap-5 xl:grid-cols-4">
        <MetricCard
          description="Rule-based average across successful chat requests."
          icon={Gauge}
          label="Avg confidence"
          tone={aiOps.evaluation.averageConfidence >= 70 ? "good" : "warning"}
          value={`${aiOps.evaluation.averageConfidence}%`}
        />
        <MetricCard
          description="Indexed documents currently available to retrieval."
          icon={FolderOpen}
          label="Documents indexed"
          tone={aiOps.dataFoundation.indexedDocumentCount ? "good" : "warning"}
          value={aiOps.dataFoundation.indexedDocumentCount}
        />
        <MetricCard
          description="Live log streams currently pushing or tailing."
          icon={Radio}
          label="Active streams"
          tone={activeStreams ? "good" : "default"}
          value={activeStreams}
        />
        <MetricCard
          description="Use cases moving through the forward-deploy pipeline."
          icon={Bot}
          label="FDE pipeline"
          value={fde.pipeline.total}
        />
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FolderOpen className="h-5 w-5 text-forest" aria-hidden="true" />
              Recent evidence
            </CardTitle>
            <CardDescription>The most recently indexed documents in this workspace.</CardDescription>
          </CardHeader>
          <CardContent>
            {recentDocuments.length ? (
              <div className="space-y-2">
                {recentDocuments.map((document) => (
                  <div className="flex items-center justify-between gap-3 border border-line bg-paper-2/40 px-3 py-2.5" key={document.id}>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-ink">{document.filename}</p>
                      <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-ink-soft">{document.type} · {document.uploadDate}</p>
                    </div>
                    <Badge variant={document.status === "Indexed" ? "success" : document.status === "Failed" ? "danger" : "warning"}>
                      {document.status}
                    </Badge>
                  </div>
                ))}
                <Link className="mt-1 inline-block text-sm font-semibold text-forest hover:text-forest-deep" href="/library">
                  View all evidence →
                </Link>
              </div>
            ) : (
              <EmptyState description="Upload a log or runbook to see it appear here." title="No documents yet" />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-forest" aria-hidden="true" />
              Recent alerts
            </CardTitle>
            <CardDescription>Severity-matched lines from active live-log streams.</CardDescription>
          </CardHeader>
          <CardContent>
            {alerts.length ? (
              <div className="space-y-2">
                {alerts.map((alert) => (
                  <div className="border border-line bg-paper-2/40 px-3 py-2.5" key={alert.id}>
                    <div className="flex items-center justify-between gap-3">
                      <p className="truncate text-sm font-semibold text-ink">{alert.title}</p>
                      <Badge variant={alert.severity === "critical" ? "danger" : alert.severity === "warn" ? "warning" : "outline"}>
                        {alert.severity}
                      </Badge>
                    </div>
                    <p className="mt-1 truncate text-xs text-ink-soft">{alert.server} · {alert.env}</p>
                  </div>
                ))}
                <Link className="mt-1 inline-block text-sm font-semibold text-forest hover:text-forest-deep" href="/live-logs">
                  View all signals →
                </Link>
              </div>
            ) : (
              <EmptyState description="Create a live-log stream to start collecting alerts." title="No alerts yet" />
            )}
          </CardContent>
        </Card>
      </div>

      <section className="mt-5">
        <h2 className="mb-3 font-display text-lg font-semibold text-ink">Quick actions</h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {quickActions.map((action) => (
            <Link
              className="desk-panel group flex flex-col gap-3 p-5 transition hover:border-forest/40"
              href={action.href}
              key={action.href}
            >
              <div className="grid h-10 w-10 place-items-center border border-line bg-paper-2 text-forest transition group-hover:border-forest/40 group-hover:bg-forest/10">
                <action.icon className="h-5 w-5" aria-hidden="true" />
              </div>
              <div>
                <p className="font-display text-sm font-semibold text-ink">{action.label}</p>
                <p className="mt-1 text-xs leading-5 text-ink-soft">{action.description}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </AppShell>
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
