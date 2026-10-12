import type { NextRequest } from "next/server";

import { AuthFailure, changePassword, login, requestPasswordReset } from "@/admin/server/auth";
import { isBackendConfigured } from "@/server/config";
import {
  clearSessionCookie,
  clientKey,
  currentSession,
  clearLimit,
  isBlocked,
  isSameSite,
  json,
  rateLimited,
  setSessionCookie,
  siteOrigin,
} from "@/admin/server/http";
import { revokeSession, SESSION_COOKIE } from "@/admin/server/session";

type Context = { params: Promise<{ action: string }> };

function failure(error: unknown) {
  if (error instanceof AuthFailure) {
    return json(
      { error: { message: error.message, field_errors: error.fieldErrors ?? null } },
      error.status,
    );
  }
  return json({ error: { message: "Something went wrong. Try again." } }, 500);
}

async function body(request: NextRequest): Promise<Record<string, unknown>> {
  try {
    const value = (await request.json()) as unknown;
    return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

/** Who is signed in (used by the panel to notice a session that ended elsewhere). */
export async function GET(request: NextRequest, context: Context) {
  const { action } = await context.params;
  if (action !== "session") return json({ error: { message: "Not found" } }, 404);
  const session = await currentSession(request);
  if (!session) return json({ user: null }, 401);
  return json({ user: { id: session.userId, email: session.email } });
}

export async function POST(request: NextRequest, context: Context) {
  const { action } = await context.params;
  if (!isBackendConfigured())
    return json({ error: { message: "The backend is not configured" } }, 503);
  if (!isSameSite(request)) return json({ error: { message: "Forbidden" } }, 403);
  const userAgent = request.headers.get("user-agent");

  try {
    switch (action) {
      case "login": {
        const data = await body(request);
        const email = typeof data.email === "string" ? data.email.trim().toLowerCase() : "";
        // Only failed attempts count: brute force is limited, normal use is not.
        const ipKey = `login:ip:${clientKey(request)}`;
        const emailKey = `login:email:${email}`;
        if (isBlocked(ipKey, 40) || isBlocked(emailKey, 10)) {
          return json(
            { error: { message: "Too many attempts. Wait a few minutes and try again." } },
            429,
          );
        }
        let session;
        try {
          session = await login(data.email, data.password, userAgent);
        } catch (error) {
          rateLimited(ipKey, 40, 10 * 60_000);
          rateLimited(emailKey, 10, 10 * 60_000);
          throw error;
        }
        clearLimit(emailKey);
        const response = json({ ok: true });
        setSessionCookie(response, session, request);
        return response;
      }
      case "logout": {
        await revokeSession(request.cookies.get(SESSION_COOKIE)?.value);
        const response = json({ ok: true });
        clearSessionCookie(response, request);
        return response;
      }
      case "forgot": {
        const data = await body(request);
        if (rateLimited(`forgot:ip:${clientKey(request)}`, 10, 60 * 60_000)) {
          return json({ error: { message: "Too many requests. Try again later." } }, 429);
        }
        try {
          await requestPasswordReset(data.email, siteOrigin(request));
        } catch (error) {
          // Not shown to the visitor (it would reveal which addresses exist), but logged.
          console.error("password reset email failed:", (error as Error).message);
        }
        return json({ ok: true });
      }
      case "password": {
        const session = await currentSession(request);
        if (!session) return json({ error: { message: "Not authenticated" } }, 401);
        const data = await body(request);
        const next = await changePassword(session, data.current, data.password, userAgent);
        const response = json({ ok: true });
        setSessionCookie(response, next, request);
        return response;
      }
      default:
        return json({ error: { message: "Not found" } }, 404);
    }
  } catch (error) {
    return failure(error);
  }
}
