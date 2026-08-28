import type { Citation, DocumentItem } from "@/types";

export interface AppConfig {
  llm: {
    provider: string;
    endpoint: string;
    model: string;
    modelOptions: string[];
    apiKeyEnv: string;
    temperature: number;
  };
  retrieval: {
    topK: number;
    chunkSize: number;
    citationMode: "Strict" | "Balanced" | "Verbose";
  };
  vectorStore: {
    provider: string;
    endpoint: string;
    collectionName: string;
    persistencePath: string;
    embeddingModel: string;
    embeddingEndpoint: string;
  };
  memory: {
    enabled: boolean;
    provider: string;
    collectionName: string;
    topK: number;
  };
}

export interface StoredDocument extends DocumentItem {
  ownerUsername: string;
  lineCount: number;
  chunkCount: number;
  createdAt: string;
  expiresAt: string;
}

export interface RetrievedChunk {
  id: string;
  documentName: string;
  section: string;
  text: string;
  distance?: number;
}

export interface AgentMemoryItem {
  id: string;
  ownerUsername: string;
  content: string;
  category: "preference" | "environment" | "incident" | "note";
  source: "user" | "assistant" | "system";
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
}

export interface RetrievedMemory {
  id: string;
  content: string;
  category: AgentMemoryItem["category"];
  source: AgentMemoryItem["source"];
  distance?: number;
}

export interface ChatRequestMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface ChatApiRequest {
  message: string;
  model?: string;
  history?: ChatRequestMessage[];
  conversationId?: string;
  stream?: boolean;
}

export interface ChatApiResponse {
  answer: string;
  directAnswer: string;
  evidence: string[];
  nextSteps: string[];
  risks: string[];
  citations: Citation[];
  confidence?: number;
  agentTrace?: AgentTrace;
  conversationId?: string;
  graph?: { enabled: boolean; fallback: boolean; specialist?: string; nodes?: string[]; failure?: string };
}

export interface ChatModelOption {
  name: string;
  model: string;
  size?: number;
  expiresAt?: string;
}

export interface AgentStep {
  name: string;
  status: "complete" | "warning" | "error";
  detail: string;
}

export interface AgentTrace {
  mode: "general" | "rag" | "agentic_rag";
  specialist?: "fmw" | "bea" | "wlst" | "rca" | "live" | "fde" | "general";
  specialistLabel?: string;
  maxSteps: number;
  elapsedMs: number;
  steps: AgentStep[];
}

export interface EvaluationMetrics {
  confidence: number;
  groundedness: number;
  citationCoverage: number;
  evidenceSufficiency: number;
  hallucinationRisk: number;
  actionSafety: number;
}

export interface ObservabilityEvent {
  id: string;
  ownerUsername: string;
  timestamp: string;
  questionPreview: string;
  mode: AgentTrace["mode"] | "unknown";
  model: string;
  status: "success" | "error";
  latencyMs: number;
  retrievalCount: number;
  agentStepCount: number;
  confidence?: number;
  evaluation?: EvaluationMetrics;
  error?: string;
  expiresAt: string;
  graph?: { enabled: boolean; fallback: boolean; specialist?: string; nodes?: string[]; failure?: string };
}

export interface AiOpsSummary {
  evaluation: {
    latest?: EvaluationMetrics;
    averageConfidence: number;
    averageGroundedness: number;
    averageHallucinationRisk: number;
  };
  observability: {
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    errorRate: number;
    averageLatencyMs: number;
    latestEvents: ObservabilityEvent[];
    modelUsage: Array<{ model: string; count: number }>;
    timeline: Array<{ timestamp: string; latencyMs: number; confidence: number | null; status: ObservabilityEvent["status"] }>;
  };
  dataFoundation: {
    documentCount: number;
    indexedDocumentCount: number;
    failedDocumentCount: number;
    totalChunks: number;
    memoryCount: number;
    vectorStoreProvider: string;
    vectorCollection: string;
    embeddingModel: string;
  };
  orchestration: {
    latestMode: AgentTrace["mode"] | "unknown";
    latestStepCount: number;
    latestLatencyMs: number;
    latestStatus: "success" | "error" | "none";
  };
  governance: {
    authProtected: boolean;
    apiProtected: boolean;
    localTelemetry: boolean;
    citationMode: AppConfig["retrieval"]["citationMode"];
    promptGuardrails: string[];
  };
}
