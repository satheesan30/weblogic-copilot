import { NextResponse } from "next/server";
import { authorizeStreamIngest } from "@/lib/server/live-logs/auth";
import { injectLogBatch } from "@/lib/server/live-logs/agent";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      streamId?: string;
      lines?: string[];
      text?: string;
      filename?: string;
      flush?: boolean;
    };

    if (!body.streamId) {
      return NextResponse.json({ error: "streamId is required." }, { status: 400 });
    }
    if (!await authorizeStreamIngest(request, body.streamId)) return NextResponse.json({ error: "Valid stream ingest token is required." }, { status: 401 });

    const result = await injectLogBatch({
      streamId: body.streamId,
      lines: body.lines,
      text: body.text,
      filename: body.filename,
      forceFlush: Boolean(body.flush),
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Live log ingest failed." },
      { status: 400 },
    );
  }
}
