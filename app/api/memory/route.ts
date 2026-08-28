import { NextResponse } from "next/server";
import { getAppConfig } from "@/lib/server/config";
import { addAgentMemory, listAgentMemories } from "@/lib/server/memory";
import type { AgentMemoryItem } from "@/types/backend";
import { getCurrentSession } from "@/lib/server/auth";

export const runtime = "nodejs";

export async function GET() {
  try {
    const session = await getCurrentSession(); if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const memories = await listAgentMemories(session.sub);
    return NextResponse.json({ memories });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not list memory." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getCurrentSession(); if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const body = (await request.json()) as {
      content?: string;
      category?: AgentMemoryItem["category"];
      source?: AgentMemoryItem["source"];
    };
    const config = await getAppConfig();
    const memory = await addAgentMemory(config, {
      ownerUsername: session.sub,
      content: body.content || "",
      category: body.category,
      source: body.source || "user",
    });

    return NextResponse.json({ memory });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not add memory." }, { status: 500 });
  }
}
