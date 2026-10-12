import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

import { requireConfig } from "@/server/config";
import { withApp } from "@/server/db";

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

export type SessionVia = "password" | "link";

function sign(value: string, secret: string): string {
  return createHmac("sha256", secret).update(value).digest("base64url");
}

export function sha256(token: string): Buffer {
  return createHash("sha256").update(token).digest();
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
  await withApp((client) =>
    client.query(
      `insert into auth.sessions (user_id, token_hash, via, expires_at, user_agent)
       values ($1, $2, $3, $4, $5)`,
      [userId, sha256(token), via, expiresAt, userAgent?.slice(0, 300) ?? null],
    ),
  );
  return { cookieValue: encodeCookie(token, expiresAt, sessionSecret), expiresAt };
}

/** The signed-in user behind a cookie value, or null. */
export async function readSession(
  cookieValue: string | undefined | null,
): Promise<SessionUser | null> {
  const config = requireConfig();
  const decoded = decodeCookie(cookieValue, config.sessionSecret);
  if (!decoded) return null;
  return withApp(async (client) => {
    const { rows } = await client.query<{
      id: string;
      user_id: string;
      email: string | null;
      via: SessionVia;
      stale: boolean;
    }>(
      `select s.id, s.user_id, u.email, s.via,
              s.last_seen_at < now() - interval '5 minutes' as stale
         from auth.sessions s
         join auth.users u on u.id = s.user_id
        where s.token_hash = $1 and s.expires_at > now()`,
      [sha256(decoded.token)],
    );
    const row = rows[0];
    if (!row) return null;
    if (row.stale) {
      await client.query("update auth.sessions set last_seen_at = now() where id = $1", [row.id]);
    }
    return { sessionId: row.id, userId: row.user_id, email: row.email, via: row.via };
  });
}

export async function revokeSession(cookieValue: string | undefined | null): Promise<void> {
  const decoded = decodeCookie(cookieValue, requireConfig().sessionSecret, 0);
  // Expired cookies still carry a token worth deleting.
  const token = decoded?.token ?? (cookieValue ?? "").split(".")[0];
  if (!token) return;
  await withApp((client) =>
    client.query("delete from auth.sessions where token_hash = $1", [sha256(token)]),
  );
}

/** Signs a user out everywhere except (optionally) one session. */
export async function revokeUserSessions(userId: string, exceptSessionId?: string): Promise<void> {
  await withApp((client) =>
    client.query("delete from auth.sessions where user_id = $1 and id is distinct from $2", [
      userId,
      exceptSessionId ?? null,
    ]),
  );
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
