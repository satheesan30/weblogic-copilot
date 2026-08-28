"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { MetricCard } from "@/components/ai-ops/metric-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PipelineCharts } from "@/components/fde/pipeline-charts";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { DELIVERY_GATES, deliveryGaps } from "@/lib/fde/score";
import type { DeliveryApproach, FdeStage, FdeSummary, FdeUseCase, FdeUseCaseInput } from "@/types/fde";
import {
  ClipboardList,
  Download,
  GitBranch,
  Layers,
  Scale,
  ShieldCheck,
  Sparkles,
  Trash2,
} from "lucide-react";

const STAGES: FdeStage[] = ["intake", "design", "prototype", "production", "parked"];

const emptyDraft: FdeUseCaseInput = {
  title: "",
  owner: "",
  team: "",
  stakeholders: "",
  stage: "intake",
  problem: "",
  users: "",
  workflow: "",
  integrations: "",
  dataFlows: "",
  operationalNotes: "",
  impact: 3,
  dataReadiness: 3,
  risk: 3,
  complexity: 3,
  latencySensitivity: 3,
  needsJudgment: true,
  deterministic: false,
  patternId: "",
  evaluationPlan: "",
  notes: "",
};

export function FdeDesk({ initial }: { initial: FdeSummary }) {
  const [summary, setSummary] = useState(initial);
  const [selectedId, setSelectedId] = useState(initial.useCases[0]?.id || "");
  const [draft, setDraft] = useState<FdeUseCaseInput>(emptyDraft);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [handoff, setHandoff] = useState("");
  const [pendingDeleteId, setPendingDeleteId] = useState("");

  const selected = summary.useCases.find((item) => item.id === selectedId) || summary.useCases[0] || null;
  const gaps = selected ? deliveryGaps(selected) : [];

  async function refresh() {
    const response = await fetch("/api/fde/summary", { cache: "no-store" });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Could not refresh FDE desk.");
    setSummary(payload as FdeSummary);
  }

  async function createUseCase() {
    if (!draft.title.trim()) {
      setError("Title is required.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/fde/use-cases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Could not create use case.");
      setDraft(emptyDraft);
      await refresh();
      setSelectedId(payload.useCase.id);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not create use case.");
    } finally {
      setSaving(false);
    }
  }

  async function patchUseCase(id: string, patch: Partial<FdeUseCaseInput>) {
    setSaving(true);
    setError("");
    try {
      const response = await fetch(`/api/fde/use-cases/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Could not update use case.");
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not update use case.");
    } finally {
      setSaving(false);
    }
  }

  async function removeUseCase(id: string) {
    setSaving(true);
    setError("");
    try {
      const response = await fetch(`/api/fde/use-cases/${id}`, { method: "DELETE" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Could not delete use case.");
      await refresh();
      setHandoff("");
      toast.success("Use case deleted");
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Could not delete use case.";
      setError(message);
      toast.error("Delete failed", { description: message });
    } finally {
      setSaving(false);
      setPendingDeleteId("");
    }
  }

  async function loadHandoff(id: string) {
    setError("");
    try {
      const response = await fetch(`/api/fde/use-cases/${id}/handoff`);
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Could not build handoff.");
      setHandoff(payload.markdown);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not build handoff.");
    }
  }

  function downloadHandoff() {
    if (!handoff || !selected) return;
    const blob = new Blob([handoff], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${selected.title.replace(/[^\w.-]+/g, "-").toLowerCase()}-handoff.md`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-5 xl:grid-cols-4">
        <MetricCard
          description="Use cases from intake through production."
          icon={ClipboardList}
          label="Pipeline"
          value={summary.pipeline.total}
        />
        <MetricCard
          description="Chat requests captured for SLIs."
          icon={GitBranch}
          label="Inferences"
          value={summary.telemetry.totalRequests}
        />
        <MetricCard
          description="Average groundedness from local eval."
          icon={Scale}
          label="Groundedness"
          tone={summary.telemetry.averageGroundedness >= 70 ? "good" : "warning"}
          value={summary.telemetry.averageGroundedness || "—"}
        />
        <MetricCard
          description="Guardrail checks currently failing."
          icon={ShieldCheck}
          label="Guardrail fails"
          tone={summary.guardrails.some((item) => item.status === "fail") ? "danger" : "good"}
          value={summary.guardrails.filter((item) => item.status === "fail").length}
        />
      </div>

      <PipelineCharts pipeline={summary.pipeline} />

      <div className="flex flex-wrap gap-2">
        <Badge>Error rate {summary.telemetry.errorRate}%</Badge>
        <Badge variant="outline">{summary.telemetry.averageLatencyMs} ms avg</Badge>
      </div>

      {error ? <p className="border border-danger/25 bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p> : null}

      <div className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-forest" aria-hidden="true" />
              Opportunity intake
            </CardTitle>
            <CardDescription>
              Score whether this should be an agent, simpler automation, or traditional engineering.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Field label="Title">
              <Input onChange={(event) => setDraft({ ...draft, title: event.target.value })} value={draft.title} />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Owner">
                <Input onChange={(event) => setDraft({ ...draft, owner: event.target.value })} value={draft.owner} />
              </Field>
              <Field label="Team">
                <Input onChange={(event) => setDraft({ ...draft, team: event.target.value })} value={draft.team} />
              </Field>
            </div>
            <Field label="Stakeholders">
              <Input
                onChange={(event) => setDraft({ ...draft, stakeholders: event.target.value })}
                placeholder="Product, DS, SRE, security..."
                value={draft.stakeholders}
              />
            </Field>
            <Field label="Problem">
              <Textarea onChange={(event) => setDraft({ ...draft, problem: event.target.value })} value={draft.problem} />
            </Field>
            <Field label="Users">
              <Input onChange={(event) => setDraft({ ...draft, users: event.target.value })} value={draft.users} />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <ScoreField
                label="Impact"
                onChange={(value) => setDraft({ ...draft, impact: value })}
                value={draft.impact || 3}
              />
              <ScoreField
                label="Data readiness"
                onChange={(value) => setDraft({ ...draft, dataReadiness: value })}
                value={draft.dataReadiness || 3}
              />
              <ScoreField label="Risk" onChange={(value) => setDraft({ ...draft, risk: value })} value={draft.risk || 3} />
              <ScoreField
                label="Complexity"
                onChange={(value) => setDraft({ ...draft, complexity: value })}
                value={draft.complexity || 3}
              />
              <ScoreField
                label="Latency sensitivity"
                onChange={(value) => setDraft({ ...draft, latencySensitivity: value })}
                value={draft.latencySensitivity || 3}
              />
              <Field label="Stage">
                <Select
                  onChange={(event) => setDraft({ ...draft, stage: event.target.value as FdeStage })}
                  value={draft.stage}
                >
                  {STAGES.map((stage) => (
                    <option key={stage} value={stage}>
                      {stage}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <label className="flex items-center gap-2 text-sm text-ink">
              <input
                checked={Boolean(draft.needsJudgment)}
                onChange={(event) => setDraft({ ...draft, needsJudgment: event.target.checked })}
                type="checkbox"
              />
              Needs open-ended judgment
            </label>
            <label className="flex items-center gap-2 text-sm text-ink">
              <input
                checked={Boolean(draft.deterministic)}
                onChange={(event) => setDraft({ ...draft, deterministic: event.target.checked })}
                type="checkbox"
              />
              Deterministic / rule-based
            </label>
            <Button disabled={saving} onClick={createUseCase} type="button">
              Score and add use case
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Pipeline</CardTitle>
            <CardDescription>Select a use case to design, enroll SLOs, and generate a stakeholder pack.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {summary.useCases.map((item) => (
              <button
                className="w-full border border-line bg-paper-2/40 px-3 py-3 text-left transition hover:border-forest data-[active=true]:border-forest data-[active=true]:bg-mist/40"
                data-active={item.id === selected?.id ? "true" : "false"}
                key={item.id}
                onClick={() => {
                  setSelectedId(item.id);
                  setHandoff("");
                }}
                type="button"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-ink">{item.title}</p>
                    <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.12em] text-ink-soft">
                      {item.stage} · {item.recommendedApproach}
                    </p>
                  </div>
                  <ApproachBadge approach={item.recommendedApproach} />
                </div>
              </button>
            ))}
          </CardContent>
        </Card>
      </div>

      {selected ? (
        <ArchitectureEditor
          gaps={gaps}
          onDelete={() => setPendingDeleteId(selected.id)}
          onHandoff={() => loadHandoff(selected.id)}
          onPatch={(patch) => patchUseCase(selected.id, patch)}
          patterns={summary.patterns}
          saving={saving}
          useCase={selected}
        />
      ) : null}

      {handoff ? (
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <CardTitle>Stakeholder handoff</CardTitle>
                <CardDescription>Share this pack with engineering, product, and leadership. No secrets.</CardDescription>
              </div>
              <Button onClick={downloadHandoff} type="button" variant="outline">
                <Download className="h-4 w-4" aria-hidden="true" />
                Download markdown
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <pre className="overflow-x-auto whitespace-pre-wrap border border-line bg-paper-2/60 p-4 text-sm leading-6 text-ink">
              {handoff}
            </pre>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Layers className="h-5 w-5 text-forest" aria-hidden="true" />
              Reference patterns
            </CardTitle>
            <CardDescription>Reusable designs for RAG desks, specialist routing, eval loops, HITL, and model gateways.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {summary.patterns.map((pattern) => (
              <div className="border border-line bg-paper-2/40 p-4" key={pattern.id}>
                <p className="font-semibold text-ink">{pattern.name}</p>
                <p className="mt-1 text-sm leading-6 text-ink-soft">{pattern.whenToUse}</p>
                <p className="mt-2 text-sm text-ink">
                  <span className="font-semibold">Avoid when: </span>
                  {pattern.whenNotToUse}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Platform strategy</CardTitle>
            <CardDescription>Fit, cost, latency, and risk across local, gateway, cloud, and no-LLM options.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {summary.platforms.map((platform) => (
              <div className="border border-line bg-paper-2/40 p-4" key={platform.id}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold text-ink">{platform.name}</p>
                  <div className="flex gap-1">
                    <Badge variant="outline">cost {platform.cost}</Badge>
                    <Badge variant="outline">latency {platform.latency}</Badge>
                    <Badge variant={platform.risk === "high" ? "danger" : platform.risk === "medium" ? "warning" : "success"}>
                      risk {platform.risk}
                    </Badge>
                  </div>
                </div>
                <p className="mt-2 text-sm leading-6 text-ink-soft">{platform.fit}</p>
                <p className="mt-1 text-sm text-ink">{platform.notes}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>SLOs / SLIs</CardTitle>
            <CardDescription>Enrolled from live chat telemetry. Pair with AI Ops for traces.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {summary.slos.map((slo) => (
              <div className="flex items-start justify-between gap-3 border border-line bg-paper-2/40 px-3 py-3" key={slo.id}>
                <div>
                  <p className="font-semibold text-ink">{slo.name}</p>
                  <p className="mt-1 text-sm text-ink-soft">{slo.sli}</p>
                  <p className="mt-1 font-mono text-[11px] text-ink-soft">
                    target {slo.target} · current {slo.current}
                  </p>
                </div>
                <Badge variant={slo.met ? "success" : "danger"}>{slo.met ? "met" : "breach"}</Badge>
              </div>
            ))}
            <p className="pt-2 text-sm text-ink-soft">
              Full request traces live on the{" "}
              <Link className="font-semibold text-forest underline-offset-2 hover:underline" href="/ai-ops">
                AI Ops
              </Link>{" "}
              desk.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Guardrails and governance</CardTitle>
            <CardDescription>Auth, eval enrollment, failure patterns, hallucination, and privacy posture.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {summary.guardrails.map((check) => (
              <div className="flex items-start justify-between gap-3 border border-line bg-paper-2/40 px-3 py-3" key={check.id}>
                <div>
                  <p className="font-semibold text-ink">{check.name}</p>
                  <p className="mt-1 text-sm text-ink-soft">{check.detail}</p>
                </div>
                <Badge variant={check.status === "pass" ? "success" : check.status === "watch" ? "warning" : "danger"}>
                  {check.status}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Dialog onOpenChange={(open) => !open && setPendingDeleteId("")} open={Boolean(pendingDeleteId)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete use case</DialogTitle>
            <DialogDescription>
              This removes{" "}
              <span className="font-semibold text-ink">
                {summary.useCases.find((item) => item.id === pendingDeleteId)?.title || "this use case"}
              </span>{" "}
              from the solution desk. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setPendingDeleteId("")} type="button" variant="outline">
              Cancel
            </Button>
            <Button disabled={saving} onClick={() => removeUseCase(pendingDeleteId)} type="button">
              {saving ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ArchitectureEditor({
  gaps,
  onDelete,
  onHandoff,
  onPatch,
  patterns,
  saving,
  useCase,
}: {
  gaps: string[];
  onDelete: () => void;
  onHandoff: () => void;
  onPatch: (patch: Partial<FdeUseCaseInput>) => void;
  patterns: FdeSummary["patterns"];
  saving: boolean;
  useCase: FdeUseCase;
}) {
  const [form, setForm] = useState({
    workflow: useCase.workflow,
    integrations: useCase.integrations,
    dataFlows: useCase.dataFlows,
    operationalNotes: useCase.operationalNotes,
    evaluationPlan: useCase.evaluationPlan,
    notes: useCase.notes,
    patternId: useCase.patternId,
    stage: useCase.stage,
    stakeholders: useCase.stakeholders,
  });

  const formKey = `${useCase.id}:${useCase.updatedAt}`;

  return (
    <Card key={formKey}>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>{useCase.title}</CardTitle>
            <CardDescription>
              {useCase.approachRationale} Owner {useCase.owner || "unassigned"} · {useCase.team || "no team"}.
            </CardDescription>
          </div>
          <ApproachBadge approach={useCase.recommendedApproach} />
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Stage">
            <Select onChange={(event) => setForm({ ...form, stage: event.target.value as FdeStage })} value={form.stage}>
              {STAGES.map((stage) => (
                <option key={stage} value={stage}>
                  {stage}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Reference pattern">
            <Select onChange={(event) => setForm({ ...form, patternId: event.target.value })} value={form.patternId}>
              <option value="">None</option>
              {patterns.map((pattern) => (
                <option key={pattern.id} value={pattern.id}>
                  {pattern.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label="Stakeholders">
          <Input onChange={(event) => setForm({ ...form, stakeholders: event.target.value })} value={form.stakeholders} />
        </Field>
        <Field label="Workflow">
          <Textarea onChange={(event) => setForm({ ...form, workflow: event.target.value })} value={form.workflow} />
        </Field>
        <Field label="Integrations">
          <Textarea onChange={(event) => setForm({ ...form, integrations: event.target.value })} value={form.integrations} />
        </Field>
        <Field label="Data flows">
          <Textarea onChange={(event) => setForm({ ...form, dataFlows: event.target.value })} value={form.dataFlows} />
        </Field>
        <Field label="Operational / compliance notes">
          <Textarea
            onChange={(event) => setForm({ ...form, operationalNotes: event.target.value })}
            value={form.operationalNotes}
          />
        </Field>
        <Field label="Evaluation plan (offline, online, canary, A/B)">
          <Textarea
            onChange={(event) => setForm({ ...form, evaluationPlan: event.target.value })}
            value={form.evaluationPlan}
          />
        </Field>
        <Field label="Notes">
          <Textarea onChange={(event) => setForm({ ...form, notes: event.target.value })} value={form.notes} />
        </Field>
        {gaps.length ? (
          <div className="border border-copper/30 bg-copper/10 p-4 text-sm leading-6 text-copper-deep">
            <p className="font-semibold">Delivery gaps</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {gaps.map((gap) => (
                <li key={gap}>{gap}</li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="border border-forest/25 bg-forest/10 px-3 py-2 text-sm text-forest-deep">
            Architecture and eval fields look complete enough for a stakeholder review.
          </p>
        )}
        <div className="border border-line bg-paper-2/50 p-4">
          <p className="text-sm font-semibold text-ink">Prototype to production gates</p>
          <ul className="mt-3 space-y-2 text-sm text-ink-soft">
            {DELIVERY_GATES.map((gate) => (
              <li className="flex justify-between gap-3" key={gate.id}>
                <span>{gate.label}</span>
                <span className="font-mono text-[10px] uppercase tracking-[0.12em]">{gate.stage}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            disabled={saving}
            onClick={() => onPatch(form)}
            type="button"
          >
            Save architecture
          </Button>
          <Button disabled={saving} onClick={onHandoff} type="button" variant="secondary">
            Generate handoff
          </Button>
          <Button disabled={saving} onClick={onDelete} type="button" variant="outline">
            <Trash2 className="h-4 w-4" aria-hidden="true" />
            Delete
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function ApproachBadge({ approach }: { approach: DeliveryApproach }) {
  const variant = approach === "ai-agent" ? "default" : approach === "automation" ? "success" : "outline";
  return <Badge variant={variant}>{approach.replace("-", " ")}</Badge>;
}

function Field({ children, label }: { children: ReactNode; label: string }) {
  return (
    <label className="grid gap-1.5 text-sm font-semibold text-ink">
      {label}
      {children}
    </label>
  );
}

function ScoreField({ label, onChange, value }: { label: string; onChange: (value: number) => void; value: number }) {
  return (
    <Field label={`${label} (${value}/5)`}>
      <input
        className="w-full accent-[color:var(--forest)]"
        max={5}
        min={1}
        onChange={(event) => onChange(Number(event.target.value))}
        type="range"
        value={value}
      />
    </Field>
  );
}
