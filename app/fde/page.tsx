import { redirect } from "next/navigation";
import { FdeDesk } from "@/components/fde/fde-desk";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { getFdeSummary } from "@/lib/server/fde/summary";
import { getCurrentSession } from "@/lib/server/auth";
import { Compass, ShieldCheck } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function FdePage() {
  const session = await getCurrentSession();
  if (!session) redirect("/login?redirect=/fde");

  const summary = await getFdeSummary();

  return (
    <AppShell>
      <PageHeader
        actions={
          <>
            <Badge>
              <Compass className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
              Solution architecture
            </Badge>
            <Badge variant="success">
              <ShieldCheck className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
              Local governance
            </Badge>
          </>
        }
        description="Intake AI opportunities, decide agent vs automation, design workflows and data flows, enroll SLOs, and produce stakeholder handoffs — the Forward Deploy Engineer desk."
        eyebrow="Forward deploy"
        title="FDE solution desk"
      />
      <FdeDesk initial={summary} />
    </AppShell>
  );
}
