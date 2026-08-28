import { NextRequest, NextResponse } from "next/server";
import { createSession, localAuthCredentials, SESSION_COOKIE, sessionCookieOptions } from "@/lib/server/auth";

export const runtime = "nodejs";

const MAX_FAILED_ATTEMPTS = 5;
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const failedAttempts = new Map<string, { count: number; resetAt: number }>();

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const username = String(formData.get("username") || "").trim();
  const password = String(formData.get("password") || "");
  const redirectPath = safeRedirectPath(String(formData.get("redirect") || "/dashboard"));
  const clientId = clientIdentifier(request);

  if (isRateLimited(clientId)) {
    const failedUrl = new URL("/login", request.url);
    failedUrl.searchParams.set("error", "rate-limit");
    failedUrl.searchParams.set("redirect", redirectPath);
    return NextResponse.redirect(failedUrl, { status: 303 });
  }

  const credentials = localAuthCredentials();

  if (username !== credentials.username || password !== credentials.password) {
    recordFailedAttempt(clientId);
    const failedUrl = new URL("/login", request.url);
    failedUrl.searchParams.set("error", "invalid");
    failedUrl.searchParams.set("redirect", redirectPath);
    return NextResponse.redirect(failedUrl, { status: 303 });
  }

  failedAttempts.delete(clientId);
  const response = NextResponse.redirect(new URL(redirectPath, request.url), { status: 303 });
  response.cookies.set(SESSION_COOKIE, createSession(username), sessionCookieOptions());
  return response;
}

function safeRedirectPath(value: string) {
  if (!value.startsWith("/") || value.startsWith("//")) {
    return "/dashboard";
  }
  return value;
}

function clientIdentifier(request: NextRequest) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "local";
}

function isRateLimited(clientId: string) {
  const entry = failedAttempts.get(clientId);
  if (!entry) return false;
  if (Date.now() > entry.resetAt) {
    failedAttempts.delete(clientId);
    return false;
  }
  return entry.count >= MAX_FAILED_ATTEMPTS;
}

function recordFailedAttempt(clientId: string) {
  const now = Date.now();
  const current = failedAttempts.get(clientId);
  if (!current || now > current.resetAt) {
    failedAttempts.set(clientId, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return;
  }
  failedAttempts.set(clientId, { count: current.count + 1, resetAt: current.resetAt });
}
