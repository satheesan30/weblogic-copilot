import { NextResponse } from "next/server";
import { authorizeLiveLogRequest } from "@/lib/server/live-logs/auth";
import { clearLiveStreamBuffer, flushLiveStream } from "@/lib/server/live-logs/agent";
import { deleteLiveStream, getLiveStream, upsertLiveStream } from "@/lib/server/live-logs/store";
import { stopLiveTail } from "@/lib/server/live-logs/tail";
import { getAppConfig } from "@/lib/server/config";
import { deleteChunksByDocumentId } from "@/lib/server/vector-store";

export const runtime = "nodejs";

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
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
    await flushLiveStream(id);
  } catch {
    // Best-effort flush before delete.
  }
  await stopLiveTail(id);
  clearLiveStreamBuffer(id);
  await deleteChunksByDocumentId(await getAppConfig(), stream.documentId);
  await deleteLiveStream(id, auth.username);
  return NextResponse.json({ ok: true });
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await authorizeLiveLogRequest(request);
  if (!auth || auth.mode !== "session") {
    return NextResponse.json({ error: "Login or ingest token is required." }, { status: 401 });
  }

  const { id } = await context.params;
  const stream = await getLiveStream(id, auth.username);
  if (!stream) {
    return NextResponse.json({ error: "Stream not found." }, { status: 404 });
  }

  const body = (await request.json().catch(() => ({}))) as { status?: "active" | "stopped" };
  if (body.status === "stopped") {
    await stopLiveTail(id);
    stream.status = "stopped";
  } else if (body.status === "active") {
    stream.status = "active";
    stream.error = undefined;
  }
  await upsertLiveStream(stream);
  return NextResponse.json({ stream });
}
