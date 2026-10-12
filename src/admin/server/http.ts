import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { readConfig } from "./config";
import { toErrorBody } from "./db";
import { RestError } from "./rest";
import {
  cookieOptions,
  readSession,
  SESSION_COOKIE,
  type NewSession,
  type SessionUser,
} from "./session";

export function json(body: unknown, status = 200): NextResponse {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow" },
  });
}

/** Database / validation errors in the shape the panel's services expect. */
export function errorResponse(error: unknown): NextResponse {
  if (error instanceof RestError) {
    return json(
      {
        data: null,
        error: { message: error.message, details: error.details, hint: null, code: error.code },
      },
      error.status,
    );
  }
  return json({ data: null, error: toErrorBody(error) }, 400);
}

export function unauthorized(): NextResponse {
  return json(
    { data: null, error: { name: "AuthApiError", status: 401, message: "Not authenticated" } },
    401,
  );
}

/**
 * Cross-site request guard for state-changing calls (on top of SameSite=Lax):
 * the browser's Origin must be this site. Server-side test clients send neither
 * Origin nor Fetch Metadata and are accepted.
 */
export function isSameSite(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  if (origin) {
    try {
      return new URL(origin).host === request.nextUrl.host;
    } catch {
      return false;
    }
  }
  const site = request.headers.get("sec-fetch-site");
  return !site || site === "same-origin" || site === "none";
}

export async function currentSession(request: NextRequest): Promise<SessionUser | null> {
  if (!readConfig()) return null;
  return readSession(request.cookies.get(SESSION_COOKIE)?.value);
}

/** Public base URL for emailed links. */
export function siteOrigin(request: NextRequest): string {
  return readConfig()?.appUrl ?? request.nextUrl.origin;
}

export function setSessionCookie(
  response: NextResponse,
  session: NewSession,
  request: NextRequest,
) {
  response.cookies.set(
    SESSION_COOKIE,
    session.cookieValue,
    cookieOptions(session.expiresAt, request.nextUrl.protocol === "https:"),
  );
}

export function clearSessionCookie(response: NextResponse, request: NextRequest) {
  response.cookies.set(SESSION_COOKIE, "", {
    ...cookieOptions(new Date(0), request.nextUrl.protocol === "https:"),
    maxAge: 0,
  });
}

// ------------------------------------------------------------------ rate limits

const buckets = new Map<string, { count: number; resetAt: number }>();

/** Best-effort, per-process limiter for sign-in and reset requests. */
export function rateLimited(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    if (buckets.size > 5000) {
      for (const [k, v] of buckets) if (v.resetAt <= now) buckets.delete(k);
    }
    return false;
  }
  bucket.count += 1;
  return bucket.count > max;
}

export function clientKey(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "local"
  );
}
