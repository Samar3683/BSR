import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { readConfig } from "@/server/config";
import { toErrorBody } from "@/server/db";
export { clearLimit, clientKey, isBlocked, rateLimited } from "@/server/limits";
import { isHttps } from "@/server/request";
export { isSameSite } from "@/server/request";
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
    cookieOptions(session.expiresAt, isHttps(request)),
  );
}

export function clearSessionCookie(response: NextResponse, request: NextRequest) {
  response.cookies.set(SESSION_COOKIE, "", {
    ...cookieOptions(new Date(0), isHttps(request)),
    maxAge: 0,
  });
}
