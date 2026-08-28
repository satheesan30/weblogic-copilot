export type FdeStage = "intake" | "design" | "prototype" | "production" | "parked";
export type DeliveryApproach = "ai-agent" | "automation" | "traditional";

export interface FdeUseCase {
  id: string;
  title: string;
  owner: string;
  team: string;
  stakeholders: string;
  stage: FdeStage;
  problem: string;
  users: string;
  workflow: string;
  integrations: string;
  dataFlows: string;
  operationalNotes: string;
  impact: number;
  dataReadiness: number;
  risk: number;
  complexity: number;
  latencySensitivity: number;
  needsJudgment: boolean;
  deterministic: boolean;
  recommendedApproach: DeliveryApproach;
  approachRationale: string;
  patternId: string;
  evaluationPlan: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface FdeUseCaseInput {
  title: string;
  owner?: string;
  team?: string;
  stakeholders?: string;
  stage?: FdeStage;
  problem?: string;
  users?: string;
  workflow?: string;
  integrations?: string;
  dataFlows?: string;
  operationalNotes?: string;
  impact?: number;
  dataReadiness?: number;
  risk?: number;
  complexity?: number;
  latencySensitivity?: number;
  needsJudgment?: boolean;
  deterministic?: boolean;
  patternId?: string;
  evaluationPlan?: string;
  notes?: string;
}

export interface ArchitecturePattern {
  id: string;
  name: string;
  whenToUse: string;
  whenNotToUse: string;
  workflow: string;
  integrations: string[];
  dataFlow: string;
  operationalNotes: string;
  risks: string[];
}

export interface PlatformOption {
  id: string;
  name: string;
  fit: string;
  cost: "low" | "medium" | "high";
  latency: "low" | "medium" | "high";
  risk: "low" | "medium" | "high";
  notes: string;
}

export interface SloDefinition {
  id: string;
  name: string;
  sli: string;
  target: string;
  category: "reliability" | "quality" | "safety" | "cost" | "latency";
}

export interface SloStatus extends SloDefinition {
  current: string;
  met: boolean;
  detail: string;
}

export interface GuardrailCheck {
  id: string;
  name: string;
  status: "pass" | "watch" | "fail";
  detail: string;
}

export interface FdeSummary {
  pipeline: {
    total: number;
    byStage: Record<FdeStage, number>;
    aiAgent: number;
    automation: number;
    traditional: number;
  };
  useCases: FdeUseCase[];
  patterns: ArchitecturePattern[];
  platforms: PlatformOption[];
  slos: SloStatus[];
  guardrails: GuardrailCheck[];
  telemetry: {
    totalRequests: number;
    errorRate: number;
    averageLatencyMs: number;
    averageGroundedness: number;
    averageHallucinationRisk: number;
    averageActionSafety: number;
    averageConfidence: number;
  };
}
