import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { scoreUseCase } from "@/lib/fde/score";
import type { FdeUseCase, FdeUseCaseInput } from "@/types/fde";

const DATA_DIR = path.join(process.cwd(), ".app-data");
const USE_CASES_FILE = path.join(DATA_DIR, "fde-use-cases.json");

export async function listFdeUseCases(): Promise<FdeUseCase[]> {
  try {
    const raw = await readFile(USE_CASES_FILE, "utf8");
    const parsed = JSON.parse(raw) as FdeUseCase[];
    return Array.isArray(parsed) ? parsed.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)) : [];
  } catch {
    const seeded = seedUseCases();
    await saveFdeUseCases(seeded);
    return seeded;
  }
}

export async function getFdeUseCase(id: string): Promise<FdeUseCase | null> {
  const useCases = await listFdeUseCases();
  return useCases.find((item) => item.id === id) || null;
}

export async function createFdeUseCase(input: FdeUseCaseInput): Promise<FdeUseCase> {
  const now = new Date().toISOString();
  const scored = scoreUseCase(input);
  const useCase: FdeUseCase = {
    id: crypto.randomUUID(),
    title: input.title.trim(),
    owner: input.owner?.trim() || "",
    team: input.team?.trim() || "",
    stakeholders: input.stakeholders?.trim() || "",
    stage: input.stage || "intake",
    problem: input.problem?.trim() || "",
    users: input.users?.trim() || "",
    workflow: input.workflow?.trim() || "",
    integrations: input.integrations?.trim() || "",
    dataFlows: input.dataFlows?.trim() || "",
    operationalNotes: input.operationalNotes?.trim() || "",
    impact: clamp(input.impact, 3),
    dataReadiness: clamp(input.dataReadiness, 3),
    risk: clamp(input.risk, 3),
    complexity: clamp(input.complexity, 3),
    latencySensitivity: clamp(input.latencySensitivity, 3),
    needsJudgment: Boolean(input.needsJudgment),
    deterministic: Boolean(input.deterministic),
    recommendedApproach: scored.recommendedApproach,
    approachRationale: scored.approachRationale,
    patternId: input.patternId || "",
    evaluationPlan: input.evaluationPlan?.trim() || "",
    notes: input.notes?.trim() || "",
    createdAt: now,
    updatedAt: now,
  };

  const useCases = await listFdeUseCases();
  useCases.unshift(useCase);
  await saveFdeUseCases(useCases);
  return useCase;
}

export async function updateFdeUseCase(id: string, input: Partial<FdeUseCaseInput>): Promise<FdeUseCase> {
  const useCases = await listFdeUseCases();
  const current = useCases.find((item) => item.id === id);
  if (!current) throw new Error("Use case not found.");

  const mergedInput: FdeUseCaseInput = {
    title: input.title ?? current.title,
    owner: input.owner ?? current.owner,
    team: input.team ?? current.team,
    stakeholders: input.stakeholders ?? current.stakeholders,
    stage: input.stage ?? current.stage,
    problem: input.problem ?? current.problem,
    users: input.users ?? current.users,
    workflow: input.workflow ?? current.workflow,
    integrations: input.integrations ?? current.integrations,
    dataFlows: input.dataFlows ?? current.dataFlows,
    operationalNotes: input.operationalNotes ?? current.operationalNotes,
    impact: input.impact ?? current.impact,
    dataReadiness: input.dataReadiness ?? current.dataReadiness,
    risk: input.risk ?? current.risk,
    complexity: input.complexity ?? current.complexity,
    latencySensitivity: input.latencySensitivity ?? current.latencySensitivity,
    needsJudgment: input.needsJudgment ?? current.needsJudgment,
    deterministic: input.deterministic ?? current.deterministic,
    patternId: input.patternId ?? current.patternId,
    evaluationPlan: input.evaluationPlan ?? current.evaluationPlan,
    notes: input.notes ?? current.notes,
  };
  const scored = scoreUseCase(mergedInput);
  const next: FdeUseCase = {
    ...current,
    ...mergedInput,
    title: mergedInput.title.trim(),
    owner: mergedInput.owner?.trim() || "",
    team: mergedInput.team?.trim() || "",
    stakeholders: mergedInput.stakeholders?.trim() || "",
    problem: mergedInput.problem?.trim() || "",
    users: mergedInput.users?.trim() || "",
    workflow: mergedInput.workflow?.trim() || "",
    integrations: mergedInput.integrations?.trim() || "",
    dataFlows: mergedInput.dataFlows?.trim() || "",
    operationalNotes: mergedInput.operationalNotes?.trim() || "",
    impact: clamp(mergedInput.impact, current.impact),
    dataReadiness: clamp(mergedInput.dataReadiness, current.dataReadiness),
    risk: clamp(mergedInput.risk, current.risk),
    complexity: clamp(mergedInput.complexity, current.complexity),
    latencySensitivity: clamp(mergedInput.latencySensitivity, current.latencySensitivity),
    needsJudgment: Boolean(mergedInput.needsJudgment),
    deterministic: Boolean(mergedInput.deterministic),
    recommendedApproach: scored.recommendedApproach,
    approachRationale: scored.approachRationale,
    patternId: mergedInput.patternId || "",
    evaluationPlan: mergedInput.evaluationPlan?.trim() || "",
    notes: mergedInput.notes?.trim() || "",
    updatedAt: new Date().toISOString(),
  };

  await saveFdeUseCases(useCases.map((item) => (item.id === id ? next : item)));
  return next;
}

export async function deleteFdeUseCase(id: string) {
  const useCases = await listFdeUseCases();
  await saveFdeUseCases(useCases.filter((item) => item.id !== id));
}

async function saveFdeUseCases(useCases: FdeUseCase[]) {
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(USE_CASES_FILE, JSON.stringify(useCases, null, 2));
}

function clamp(value: number | undefined, fallback: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.max(1, Math.min(5, Math.round(value)));
}

function seedUseCases(): FdeUseCase[] {
  const now = new Date().toISOString();
  const rag = scoreUseCase({
    title: "Agentci grounded RAG desk",
    impact: 5,
    dataReadiness: 4,
    risk: 3,
    complexity: 4,
    latencySensitivity: 3,
    needsJudgment: true,
    deterministic: false,
  });
  const ticket = scoreUseCase({
    title: "JDBC pool threshold paging",
    impact: 4,
    dataReadiness: 5,
    risk: 2,
    complexity: 2,
    latencySensitivity: 5,
    needsJudgment: false,
    deterministic: true,
  });

  return [
    {
      id: "seed-rag-desk",
      title: "Agentci grounded RAG desk",
      owner: "Forward deploy",
      team: "CIO technology / WebLogic ops",
      stakeholders: "Service owners, SREs, enterprise AI, security",
      stage: "prototype",
      problem: "WebLogic operators spend hours correlating logs, BEA codes, and runbooks during incidents.",
      users: "WebLogic administrators and on-call engineers",
      workflow: "Upload logs → ask → specialist routing → retrieve/assess/rewrite → grounded RCA.",
      integrations: "Ollama or LiteLLM, ChromaDB, local JSONL telemetry, optional live log ingest",
      dataFlows: "Documents and tails → embeddings → vector search → chat answer → observability events",
      operationalNotes: "Local-first. No secrets in memory. Read-only WLST by default. Auth on desk APIs.",
      impact: 5,
      dataReadiness: 4,
      risk: 3,
      complexity: 4,
      latencySensitivity: 3,
      needsJudgment: true,
      deterministic: false,
      recommendedApproach: rag.recommendedApproach,
      approachRationale: rag.approachRationale,
      patternId: "grounded-rag-desk",
      evaluationPlan: "Offline: BEA/JDBC golden questions. Online: groundedness, hallucination, action safety. Canary new model aliases via LiteLLM.",
      notes: "Seeded example mapped to this repo.",
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "seed-threshold-page",
      title: "JDBC pool threshold paging",
      owner: "Forward deploy",
      team: "Platform ops",
      stakeholders: "SRE, DBA, service owner",
      stage: "intake",
      problem: "Page when pool waiters exceed a known threshold for 5 minutes.",
      users: "On-call",
      workflow: "Metric scrape → threshold → ticket/page → known runbook link.",
      integrations: "Metrics backbone, ServiceNow/ITSM, paging",
      dataFlows: "Runtime MBean or exporter → alert rule → incident",
      operationalNotes: "No model required. Keep LLM out of the paging path.",
      impact: 4,
      dataReadiness: 5,
      risk: 2,
      complexity: 2,
      latencySensitivity: 5,
      needsJudgment: false,
      deterministic: true,
      recommendedApproach: ticket.recommendedApproach,
      approachRationale: ticket.approachRationale,
      patternId: "",
      evaluationPlan: "Alert precision/recall against historical waiter spikes. No LLM eval.",
      notes: "Example of when not to use an agent.",
      createdAt: now,
      updatedAt: now,
    },
  ];
}
