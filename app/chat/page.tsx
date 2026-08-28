import { ChatPanel } from "@/components/chat/chat-panel";
import { DocumentSidebar } from "@/components/chat/document-sidebar";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { MessageSquareText, ShieldCheck } from "lucide-react";

export default function ChatPage() {
  return (
    <AppShell>
      <PageHeader
        actions={
          <>
            <Badge variant="success">
              <ShieldCheck className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
              Specialist agents
            </Badge>
            <Badge>
              <MessageSquareText className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
              JDBC · BEA · WLST · Live · RCA
            </Badge>
          </>
        }
        description="Ask WebLogic questions. The orchestrator routes to JDBC, BEA decoder, WLST checklist, Live Log, or RCA specialists with multi-hop retrieval."
        eyebrow="Agentci desk"
        title="Troubleshooting chat"
      />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <ChatPanel />
        <DocumentSidebar />
      </div>
    </AppShell>
  );
}
