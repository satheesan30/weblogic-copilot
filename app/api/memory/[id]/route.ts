import { NextResponse } from "next/server";
import { getAppConfig } from "@/lib/server/config";
import { deleteAgentMemory } from "@/lib/server/memory";
import { getCurrentSession } from "@/lib/server/auth";

export const runtime = "nodejs";

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getCurrentSession(); if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { id } = await params;
    const config = await getAppConfig();
    if (!await deleteAgentMemory(config, id, session.sub)) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not delete memory." }, { status: 500 });
  }
}
