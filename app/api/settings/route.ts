import { NextResponse } from "next/server";
import { z } from "zod";
import { getAppConfig, saveSettingsOverrides } from "@/lib/server/config";
import { getCurrentSession } from "@/lib/server/auth";

export async function GET() {
  const config = await getAppConfig();
  return NextResponse.json({
    llm: {
      provider: config.llm.provider,
      model: config.llm.model,
      modelOptions: config.llm.modelOptions,
      temperature: config.llm.temperature,
    },
    retrieval: config.retrieval,
    vectorStore: {
      provider: config.vectorStore.provider,
      collectionName: config.vectorStore.collectionName,
      persistencePath: config.vectorStore.persistencePath,
      embeddingModel: config.vectorStore.embeddingModel,
    },
    memory: config.memory,
  });
}

const settingsUpdateSchema = z.object({
  retrieval: z
    .object({
      topK: z.number().int().min(1).max(20).optional(),
      chunkSize: z.number().int().min(200).max(4000).optional(),
      citationMode: z.enum(["Strict", "Balanced", "Verbose"]).optional(),
    })
    .optional(),
  llm: z
    .object({
      temperature: z.number().min(0).max(2).optional(),
    })
    .optional(),
  memory: z
    .object({
      enabled: z.boolean().optional(),
      topK: z.number().int().min(1).max(20).optional(),
    })
    .optional(),
});

export async function POST(request: Request) {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = settingsUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid settings payload.", details: parsed.error.flatten() }, { status: 400 });
  }

  const config = await saveSettingsOverrides(parsed.data);
  return NextResponse.json({
    llm: { temperature: config.llm.temperature },
    retrieval: config.retrieval,
    memory: config.memory,
  });
}
