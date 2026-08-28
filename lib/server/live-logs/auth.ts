import { cookies } from "next/headers";
import { SESSION_COOKIE, verifySession } from "@/lib/server/auth";
import crypto from "node:crypto";
import { getLiveStream } from "@/lib/server/live-logs/store";

export async function authorizeLiveLogRequest(request?: Request) {
  void request;
  const cookieStore = await cookies();
  const session = verifySession(cookieStore.get(SESSION_COOKIE)?.value);
  if (session) {
    return { mode: "session" as const, username: session.sub };
  }

  return null;
}

export async function authorizeStreamIngest(request: Request, streamId: string) {
  const sessionAuth = await authorizeLiveLogRequest(request);
  const stream = await getLiveStream(streamId, sessionAuth?.mode === "session" ? sessionAuth.username : undefined);
  if (sessionAuth?.mode === "session" && stream) return stream;
  const bearer = (request.headers.get("authorization") || "").match(/^Bearer\s+(.+)$/i)?.[1]?.trim() || "";
  const unscoped = await getLiveStream(streamId);
  if (!unscoped || !bearer || !unscoped.ingestTokenHash) return null;
  const hash = crypto.createHash("sha256").update(bearer).digest("hex");
  return safeEqual(hash, unscoped.ingestTokenHash) ? unscoped : null;
}

function safeEqual(left: string, right: string) {
  if (left.length !== right.length) return false;
  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1) {
    mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return mismatch === 0;
}
