import { LiveLogsPanel } from "@/components/live-logs/live-logs-panel";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Radio, ShieldAlert } from "lucide-react";

export default function LiveLogsPage() {
  return (
    <AppShell>
      <PageHeader
        actions={
          <>
            <Badge variant="success">
              <Radio className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
              Live Log Agent
            </Badge>
            <Badge>
              <ShieldAlert className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
              Ingest + triage
            </Badge>
          </>
        }
        description="Push WebLogic logs from any host over HTTP, or tail a local file. Lines are buffered, embedded for RAG, and triaged for BEA/JDBC errors."
        eyebrow="Operations"
        title="Live log injection"
      />
      <LiveLogsPanel />
    </AppShell>
  );
}
