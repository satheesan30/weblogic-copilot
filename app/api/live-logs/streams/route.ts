import { NextResponse } from "next/server";
import { authorizeLiveLogRequest } from "@/lib/server/live-logs/auth";
import { createLiveStream } from "@/lib/server/live-logs/agent";
import { getLiveLogsSnapshot } from "@/lib/server/live-logs/store";
import { isLiveTailRunning } from "@/lib/server/live-logs/tail";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = await authorizeLiveLogRequest(request);
  if (!auth) {
    return NextResponse.json({ error: "Login or ingest token is required." }, { status: 401 });
  }

  if (auth.mode !== "session") return NextResponse.json({ error: "Login is required." }, { status: 401 });
  const snapshot = await getLiveLogsSnapshot(auth.username);
  return NextResponse.json({
    streams: snapshot.streams.map((stream) => ({
      ...stream,
      tailRunning: isLiveTailRunning(stream.id),
    })),
    alerts: snapshot.alerts,
  });
}

export async function POST(request: Request) {
  const auth = await authorizeLiveLogRequest(request);
  if (!auth || auth.mode !== "session") {
    return NextResponse.json({ error: "Login or ingest token is required." }, { status: 401 });
  }

  try {
    const body = (await request.json()) as {
      env?: string;
      server?: string;
      source?: "http" | "file";
      filePath?: string;
    };
    const created = await createLiveStream({
      ownerUsername: auth.username,
      env: body.env || "",
      server: body.server || "",
      source: body.source === "file" ? "file" : "http",
      filePath: body.filePath,
    });
    return NextResponse.json({ stream: created.stream, ingestToken: created.ingestToken });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not create live log stream." },
      { status: 400 },
    );
  }
}
