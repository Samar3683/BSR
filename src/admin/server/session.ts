import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

import { requireConfig } from "@/server/config";
import { db } from "@/server/db";

/**
 * Login sessions.
 *
 * The cookie holds `token.expiry.signature`: an opaque random token, its expiry
 * and an HMAC over both. The signature lets the proxy reject forged or expired
 * cookies without a database round trip; only a SHA-256 hash of the token is
 * stored, and every page and API call checks that the session row still
 * exists (sign-out and password changes revoke it immediately).
 */

export const SESSION_COOKIE = "bsr-admin-session";
export const SESSION_COOKIE_PATH = "/admin";
export const SESSION_DAYS = 7;
/** A session opened by an emailed link may only set a password, and only briefly. */
export const LINK_SESSION_MINUTES = 30;
/** How often a session's last_seen_at is refreshed. */
const SEEN_INTERVAL_MS = 5 * 60_000;

export type SessionVia = "password" | "link";

function sign(value: string, secret: string): string {
  return createHmac("sha256", secret).update(value).digest("base64url");
}

/** What the database stores of a token (bytea). */
export function sha256(token: string): Uint8Array<ArrayBuffer> {
  return new Uint8Array(createHash("sha256").update(token).digest());
}

export function encodeCookie(token: string, expiresAt: Date, secret: string): string {
  const exp = String(Math.floor(expiresAt.getTime() / 1000));
  return `${token}.${exp}.${sign(`${token}.${exp}`, secret)}`;
}

/** Verifies signature and expiry only (no database). Returns the token or null. */
export function decodeCookie(
  value: string | undefined | null,
  secret: string,
  now = Date.now(),
): { token: string; expiresAt: number } | null {
  const parts = (value ?? "").split(".");
  if (parts.length !== 3) return null;
  const [token, exp, signature] = parts as [string, string, string];
  const expected = Buffer.from(sign(`${token}.${exp}`, secret));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
  const expiresAt = Number(exp) * 1000;
  if (!Number.isFinite(expiresAt) || expiresAt <= now) return null;
  return { token, expiresAt };
}

export interface SessionUser {
  sessionId: string;
  userId: string;
  email: string | null;
  via: SessionVia;
}

export interface NewSession {
  cookieValue: string;
  expiresAt: Date;
}

export async function createSession(
  userId: string,
  via: SessionVia,
  userAgent?: string | null,
): Promise<NewSession> {
  const { sessionSecret } = requireConfig();
  const token = randomBytes(32).toString("base64url");
  const lifetimeMs = via === "link" ? LINK_SESSION_MINUTES * 60_000 : SESSION_DAYS * 24 * 3_600_000;
  const expiresAt = new Date(Date.now() + lifetimeMs);
  await db().sessions.create({
    data: {
      user_id: userId,
      token_hash: sha256(token),
      via,
      expires_at: expiresAt,
      user_agent: userAgent?.slice(0, 300) ?? null,
    },
    select: { id: true },
  });
  return { cookieValue: encodeCookie(token, expiresAt, sessionSecret), expiresAt };
}

/** The signed-in user behind a cookie value, or null. */
export async function readSession(
  cookieValue: string | undefined | null,
): Promise<SessionUser | null> {
  const config = requireConfig();
  const decoded = decodeCookie(cookieValue, config.sessionSecret);
  if (!decoded) return null;
  const row = await db().sessions.findUnique({
    where: { token_hash: sha256(decoded.token), expires_at: { gt: new Date() } },
    select: {
      id: true,
      user_id: true,
      via: true,
      last_seen_at: true,
      users: { select: { email: true } },
    },
  });
  if (!row) return null;
  if (row.last_seen_at.getTime() < Date.now() - SEEN_INTERVAL_MS) {
    await db().sessions.updateMany({ where: { id: row.id }, data: { last_seen_at: new Date() } });
  }
  return {
    sessionId: row.id,
    userId: row.user_id,
    email: row.users.email,
    via: row.via as SessionVia,
  };
}

export async function revokeSession(cookieValue: string | undefined | null): Promise<void> {
  const decoded = decodeCookie(cookieValue, requireConfig().sessionSecret, 0);
  // Expired cookies still carry a token worth deleting.
  const token = decoded?.token ?? (cookieValue ?? "").split(".")[0];
  if (!token) return;
  await db().sessions.deleteMany({ where: { token_hash: sha256(token) } });
}

/** Signs a user out everywhere except (optionally) one session. */
export async function revokeUserSessions(userId: string, exceptSessionId?: string): Promise<void> {
  await db().sessions.deleteMany({
    where: { user_id: userId, ...(exceptSessionId ? { NOT: { id: exceptSessionId } } : {}) },
  });
}

export function cookieOptions(expires: Date, secure: boolean) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure,
    path: SESSION_COOKIE_PATH,
    expires,
  };
}
