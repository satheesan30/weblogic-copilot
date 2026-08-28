import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { AppConfig } from "@/types/backend";

const CONFIG_CANDIDATES = [
  path.join(process.cwd(), "agentci.toml"),
  path.join(process.cwd(), "weblogic-copilot.toml"),
];

const DATA_DIR = path.join(process.cwd(), ".app-data");
const OVERRIDES_PATH = path.join(DATA_DIR, "settings-overrides.json");

export interface SettingsOverrides {
  retrieval?: Partial<Pick<AppConfig["retrieval"], "topK" | "chunkSize" | "citationMode">>;
  llm?: Partial<Pick<AppConfig["llm"], "temperature">>;
  memory?: Partial<Pick<AppConfig["memory"], "enabled" | "topK">>;
}

const fallbackConfig: AppConfig = {
  llm: {
    provider: "litellm",
    endpoint: "http://localhost:4000/v1/chat/completions",
    model: "weblogic-local",
    modelOptions: ["weblogic-local", "weblogic-mistral", "weblogic-fast", "weblogic-enterprise"],
    apiKeyEnv: "LITELLM_MASTER_KEY",
    temperature: 0.2,
  },
  retrieval: {
    topK: 6,
    chunkSize: 900,
    citationMode: "Balanced",
  },
  vectorStore: {
    provider: "ChromaDB",
    endpoint: "http://localhost:8000",
    collectionName: "weblogic-knowledge-base",
    persistencePath: "./chroma-data",
    embeddingModel: "nomic-embed-text",
    embeddingEndpoint: "http://localhost:11434/api/embed",
  },
  memory: {
    enabled: true,
    provider: "ChromaDB",
    collectionName: "weblogic-agent-memory",
    topK: 4,
  },
};

export async function getAppConfig(): Promise<AppConfig> {
  const base = await loadBaseConfig();
  const overrides = await getSettingsOverrides();
  return applyOverrides(base, overrides);
}

async function loadBaseConfig(): Promise<AppConfig> {
  for (const configPath of CONFIG_CANDIDATES) {
    try {
      await access(configPath);
      const raw = await readFile(configPath, "utf8");
      return parseToml(raw);
    } catch {
      // Try next candidate.
    }
  }
  return fallbackConfig;
}

export async function getSettingsOverrides(): Promise<SettingsOverrides> {
  try {
    const raw = await readFile(OVERRIDES_PATH, "utf8");
    return JSON.parse(raw) as SettingsOverrides;
  } catch {
    return {};
  }
}

export async function saveSettingsOverrides(overrides: SettingsOverrides): Promise<AppConfig> {
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(OVERRIDES_PATH, JSON.stringify(overrides, null, 2), "utf8");
  const base = await loadBaseConfig();
  return applyOverrides(base, overrides);
}

function applyOverrides(base: AppConfig, overrides: SettingsOverrides): AppConfig {
  return {
    ...base,
    llm: { ...base.llm, ...overrides.llm },
    retrieval: { ...base.retrieval, ...overrides.retrieval },
    memory: { ...base.memory, ...overrides.memory },
  };
}

function parseToml(raw: string): AppConfig {
  const data: Record<string, Record<string, string | number | boolean>> = {};
  let section = "";

  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const sectionMatch = trimmed.match(/^\[([^\]]+)\]$/);
    if (sectionMatch) {
      section = sectionMatch[1];
      data[section] = data[section] || {};
      continue;
    }

    const keyValueMatch = trimmed.match(/^([^=]+)=\s*(.+)$/);
    if (!keyValueMatch || !section) continue;

    const key = keyValueMatch[1].trim();
    const rawValue = keyValueMatch[2].trim();
    data[section][key] = parseValue(rawValue);
  }

  return {
    llm: {
      provider: stringValue(data.llm?.provider, fallbackConfig.llm.provider),
      endpoint: stringValue(data.llm?.endpoint, fallbackConfig.llm.endpoint),
      model: stringValue(data.llm?.model, fallbackConfig.llm.model),
      modelOptions: listValue(data.llm?.modelOptions, fallbackConfig.llm.modelOptions),
      apiKeyEnv: stringValue(data.llm?.apiKeyEnv, fallbackConfig.llm.apiKeyEnv),
      temperature: numberValue(data.llm?.temperature, fallbackConfig.llm.temperature),
    },
    retrieval: {
      topK: numberValue(data.retrieval?.topK, fallbackConfig.retrieval.topK),
      chunkSize: numberValue(data.retrieval?.chunkSize, fallbackConfig.retrieval.chunkSize),
      citationMode: citationModeValue(data.retrieval?.citationMode, fallbackConfig.retrieval.citationMode),
    },
    vectorStore: {
      provider: stringValue(data.vectorStore?.provider, fallbackConfig.vectorStore.provider),
      endpoint: stringValue(data.vectorStore?.endpoint, fallbackConfig.vectorStore.endpoint),
      collectionName: stringValue(data.vectorStore?.collectionName, fallbackConfig.vectorStore.collectionName),
      persistencePath: stringValue(data.vectorStore?.persistencePath, fallbackConfig.vectorStore.persistencePath),
      embeddingModel: stringValue(data.vectorStore?.embeddingModel, fallbackConfig.vectorStore.embeddingModel),
      embeddingEndpoint: stringValue(data.vectorStore?.embeddingEndpoint, fallbackConfig.vectorStore.embeddingEndpoint),
    },
    memory: {
      enabled: booleanValue(data.memory?.enabled, fallbackConfig.memory.enabled),
      provider: stringValue(data.memory?.provider, fallbackConfig.memory.provider),
      collectionName: stringValue(data.memory?.collectionName, fallbackConfig.memory.collectionName),
      topK: numberValue(data.memory?.topK, fallbackConfig.memory.topK),
    },
  };
}

function parseValue(value: string) {
  if (value.startsWith('"') && value.endsWith('"')) return value.slice(1, -1);
  if (value === "true") return true;
  if (value === "false") return false;
  const number = Number(value);
  return Number.isFinite(number) ? number : value;
}

function stringValue(value: unknown, fallback: string) {
  return typeof value === "string" ? value : fallback;
}

function numberValue(value: unknown, fallback: number) {
  return typeof value === "number" ? value : fallback;
}

function booleanValue(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback;
}

function listValue(value: unknown, fallback: string[]) {
  if (typeof value !== "string") return fallback;
  const items = value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  return items.length ? items : fallback;
}

function citationModeValue(value: unknown, fallback: AppConfig["retrieval"]["citationMode"]) {
  return value === "Strict" || value === "Balanced" || value === "Verbose" ? value : fallback;
}
