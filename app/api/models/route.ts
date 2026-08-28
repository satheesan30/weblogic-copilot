import { NextResponse } from "next/server";
import { getAppConfig } from "@/lib/server/config";
import { isEmbeddingOnlyModel, listChatModels, listRunningOllamaModels } from "@/lib/server/ollama";

export async function GET() {
  try {
    const config = await getAppConfig();
    if (config.llm.provider.toLowerCase() === "litellm") {
      const models = await listChatModels(config);
      return NextResponse.json({
        defaultModel: config.llm.model,
        provider: config.llm.provider,
        models,
        hiddenEmbeddingModels: 0,
      });
    }

    const runningModels = await listRunningOllamaModels(config);
    const models = runningModels.filter((model) => !isEmbeddingOnlyModel(model.model));
    return NextResponse.json({
      defaultModel: config.llm.model,
      provider: config.llm.provider,
      models,
      hiddenEmbeddingModels: runningModels.length - models.length,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Could not load configured models.",
        defaultModel: "weblogic-local",
        models: [],
      },
      { status: 500 },
    );
  }
}
