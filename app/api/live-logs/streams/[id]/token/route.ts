import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { authorizeLiveLogRequest } from "@/lib/server/live-logs/auth";
import { rotateLiveStreamToken } from "@/lib/server/live-logs/store";
export const runtime = "nodejs";
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await authorizeLiveLogRequest(request);
  if (!auth || auth.mode !== "session") return NextResponse.json({ error: "Login is required." }, { status: 401 });
  const { id } = await context.params;
  const ingestToken = crypto.randomBytes(32).toString("base64url");
  const hash = crypto.createHash("sha256").update(ingestToken).digest("hex");
  if (!await rotateLiveStreamToken(id, auth.username, hash)) return NextResponse.json({ error: "Stream not found." }, { status: 404 });
  return NextResponse.json({ ingestToken });
}
