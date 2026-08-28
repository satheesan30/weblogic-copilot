export type DocumentStatus = "Uploaded" | "Indexed" | "Failed";

export type DocumentType = "PDF" | "TXT" | "MD" | "HTML" | "XML" | "properties" | "log";

export interface DocumentItem {
  id: string;
  filename: string;
  type: DocumentType;
  size: string;
  uploadDate: string;
  status: DocumentStatus;
}

export interface Citation {
  id: string;
  documentName: string;
  section: string;
  excerpt: string;
}

import type { AgentTrace } from "@/types/backend";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  citations?: Citation[];
  evidence?: string[];
  nextSteps?: string[];
  risks?: string[];
  confidence?: number;
  agentTrace?: AgentTrace;
  streaming?: boolean;
}

export interface RetrievalSettings {
  topK: number;
  chunkSize: number;
  citationMode: "Strict" | "Balanced" | "Verbose";
}

export interface ModelConfig {
  provider: string;
  endpoint: string;
  model: string;
  temperature: number;
}

export interface VectorStoreConfig {
  provider: string;
  endpoint: string;
  collectionName: string;
  persistencePath: string;
  embeddingModel: string;
  embeddingEndpoint: string;
}
