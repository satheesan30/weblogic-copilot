import { NextResponse } from "next/server";
import { authorizeLiveLogRequest } from "@/lib/server/live-logs/auth";
import { getLiveStream } from "@/lib/server/live-logs/store";
import { isLiveTailRunning, startLiveTail, stopLiveTail } from "@/lib/server/live-logs/tail";

export const runtime = "nodejs";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await authorizeLiveLogRequest(request);
  if (!auth || auth.mode !== "session") {
    return NextResponse.json({ error: "Login or ingest token is required." }, { status: 401 });
  }

  const { id } = await context.params;
  const stream = await getLiveStream(id, auth.username);
  if (!stream) {
    return NextResponse.json({ error: "Stream not found." }, { status: 404 });
  }

  try {
    const body = (await request.json().catch(() => ({}))) as { action?: "start" | "stop" };
    const action = body.action === "stop" ? "stop" : "start";
    if (action === "stop") {
      await stopLiveTail(id);
      return NextResponse.json({ stream: await getLiveStream(id, auth.username), tailRunning: false });
    }

    const updated = await startLiveTail(id);
    return NextResponse.json({ stream: updated, tailRunning: isLiveTailRunning(id) });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not control live tail." },
      { status: 400 },
    );
  }
}
