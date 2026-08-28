import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth-constants";

const protectedPagePrefixes = ["/chat", "/upload", "/library", "/settings", "/ai-ops", "/live-logs", "/fde"];
const protectedApiPrefixes = [
  "/api/chat",
  "/api/upload",
  "/api/documents",
  "/api/health",
  "/api/memory",
  "/api/models",
  "/api/settings",
  "/api/ai-ops",
  "/api/live-logs",
  "/api/fde",
  "/api/evals",
];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isProtectedPage = protectedPagePrefixes.some((prefix) => pathname.startsWith(prefix));
  const isProtectedApi = protectedApiPrefixes.some((prefix) => pathname.startsWith(prefix));
  if (pathname === "/api/live-logs/ingest" && request.method === "POST") return NextResponse.next();

  if (!isProtectedPage && !isProtectedApi) {
    return NextResponse.next();
  }

  const session = request.cookies.get(SESSION_COOKIE)?.value;
  const isValidSession = await verifySessionAtEdge(session);
  if (isValidSession) {
    return NextResponse.next();
  }

  if (isProtectedApi) {
    return NextResponse.json({ error: "Login is required." }, { status: 401 });
  }

  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = "/login";
  loginUrl.searchParams.set("redirect", pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    "/chat/:path*",
    "/upload/:path*",
    "/library/:path*",
    "/settings/:path*",
    "/ai-ops/:path*",
    "/live-logs/:path*",
    "/fde/:path*",
    "/api/:path*",
  ],
};

async function verifySessionAtEdge(value?: string) {
  if (!value) return false;

  const [encodedPayload, signature] = value.split(".");
  if (!encodedPayload || !signature) return false;

  try {
    const expectedSignature = await signAtEdge(encodedPayload);
    if (!timingSafeEqual(signature, expectedSignature)) return false;

    const payload = JSON.parse(base64UrlDecode(encodedPayload)) as { sub?: string; exp?: number };
    return Boolean(payload.sub && payload.exp && payload.exp >= Math.floor(Date.now() / 1000));
  } catch {
    return false;
  }
}

async function signAtEdge(value: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(process.env.WEBLOGIC_COPILOT_AUTH_SECRET || ""),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return base64UrlEncode(new Uint8Array(signature));
}

function base64UrlEncode(bytes: Uint8Array) {
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function base64UrlDecode(value: string) {
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
  const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), "=");
  return atob(padded);
}

function timingSafeEqual(left: string, right: string) {
  if (left.length !== right.length) return false;

  let result = 0;
  for (let index = 0; index < left.length; index += 1) {
    result |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return result === 0;
}
