import type { LucideIcon } from "lucide-react";
import { AlertTriangle, CheckCircle2, FileText, ListChecks, Workflow } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { ChatMessage } from "@/types";

export function ChatMessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[760px] bg-forest px-4 py-3 text-sm leading-6 text-white">
          <p>{message.content}</p>
          <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.12em] text-white/70">{message.timestamp}</p>
        </div>
      </div>
    );
  }

  const hasStructuredContext = Boolean(
    message.evidence?.length || message.nextSteps?.length || message.risks?.length,
  );

  return (
    <Card className="max-w-[900px]">
      <CardContent className="space-y-4 p-5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={message.streaming ? "warning" : "success"}>
            {message.streaming ? "Generating..." : "Assistant answer"}
          </Badge>
          {message.agentTrace?.specialistLabel ? <Badge variant="outline">{message.agentTrace.specialistLabel}</Badge> : null}
          {message.agentTrace ? (
            <Badge>
              {message.agentTrace.mode === "agentic_rag" || message.agentTrace.mode === "rag"
                ? "Agentic RAG loop"
                : "Agent general"}
            </Badge>
          ) : null}
          {typeof message.confidence === "number" ? (
            <Badge variant="outline">Confidence {message.confidence}%</Badge>
          ) : null}
          <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-soft">{message.timestamp}</span>
        </div>

        {hasStructuredContext ? (
          <AnswerSection icon={CheckCircle2} title="Direct answer">
            {message.content}
          </AnswerSection>
        ) : (
          <p className="whitespace-pre-wrap text-sm leading-6 text-ink-soft">
            {message.content}
            {message.streaming ? <span className="ml-0.5 inline-block h-4 w-1.5 animate-pulse bg-forest align-middle" /> : null}
          </p>
        )}

        {message.evidence?.length ? <AnswerList icon={FileText} items={message.evidence} title="Retrieved evidence" /> : null}
        {message.nextSteps?.length ? (
          <AnswerList icon={ListChecks} items={message.nextSteps} title="Recommended next steps" />
        ) : null}
        {message.risks?.length ? <AnswerList icon={AlertTriangle} items={message.risks} title="Risks or assumptions" /> : null}

        {message.agentTrace?.steps.length ? (
          <section className="border border-line bg-paper-2/70 p-4">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-ink">
              <Workflow className="h-4 w-4 text-forest" aria-hidden="true" />
              Agent loop
              <span className="font-mono text-[10px] font-medium uppercase tracking-[0.12em] text-ink-soft">
                ({message.agentTrace.elapsedMs} ms)
              </span>
            </div>
            <ol className="grid gap-2 text-sm leading-6">
              {message.agentTrace.steps.map((step, index) => (
                <li className="border border-line bg-paper px-3 py-2" key={`${step.name}-${index}`}>
                  <span className="font-semibold text-ink">{step.name}</span>
                  <span className="ml-2 border border-line bg-paper-2 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.1em] text-ink-soft">
                    {step.status}
                  </span>
                  <p className="mt-1 text-ink-soft">{step.detail}</p>
                </li>
              ))}
            </ol>
          </section>
        ) : null}
      </CardContent>
    </Card>
  );
}

function AnswerSection({ children, icon: Icon, title }: { children: string; icon: LucideIcon; title: string }) {
  return (
    <section>
      <div className="mb-1.5 flex items-center gap-2 text-sm font-semibold text-ink">
        <Icon className="h-4 w-4 text-forest" aria-hidden="true" />
        {title}
      </div>
      <p className="whitespace-pre-wrap text-sm leading-6 text-ink-soft">{children}</p>
    </section>
  );
}

function AnswerList({ icon: Icon, items, title }: { icon: LucideIcon; items: string[]; title: string }) {
  return (
    <section>
      <div className="mb-1.5 flex items-center gap-2 text-sm font-semibold text-ink">
        <Icon className="h-4 w-4 text-forest" aria-hidden="true" />
        {title}
      </div>
      <ul className="grid gap-2 text-sm leading-6 text-ink-soft">
        {items.map((item, index) => (
          <li className="border border-line bg-paper-2/60 px-3 py-2" key={`${title}-${index}`}>
            {item}
          </li>
        ))}
      </ul>
    </section>
  );
}
