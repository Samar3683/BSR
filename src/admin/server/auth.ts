import { randomBytes } from "node:crypto";

import { passwordProblem } from "../lib/password-policy";
import { withApp, withIdentity } from "./db";
import { inviteMail, recoveryMail, sendMail } from "./mail";
import { hashPassword, verifyPassword } from "./passwords";
import {
  createSession,
  revokeUserSessions,
  sha256,
  type NewSession,
  type SessionUser,
} from "./session";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export class AuthFailure extends Error {
  constructor(
    message: string,
    readonly status = 400,
    readonly fieldErrors?: Record<string, string>,
  ) {
    super(message);
  }
}

export const normalizeEmail = (value: unknown) =>
  typeof value === "string" ? value.trim().toLowerCase() : "";

/** Email + password sign-in. The error never says which of the two was wrong. */
export async function login(
  emailInput: unknown,
  password: unknown,
  userAgent: string | null,
): Promise<NewSession> {
  const email = normalizeEmail(emailInput);
  const generic = new AuthFailure("The email or password is not correct.", 401);
  if (!EMAIL.test(email) || typeof password !== "string" || !password || password.length > 200) {
    throw generic;
  }
  const user = await withApp(async (client) => {
    const { rows } = await client.query<{ id: string; encrypted_password: string | null }>(
      "select id, encrypted_password from auth.users where lower(email) = $1",
      [email],
    );
    return rows[0] ?? null;
  });
  const ok = await verifyPassword(user?.encrypted_password ?? null, password);
  if (!user || !ok) throw generic;
  await withApp((client) =>
    client.query("update auth.users set last_sign_in_at = now() where id = $1", [user.id]),
  );
  return createSession(user.id, "password", userAgent);
}

// ------------------------------------------------------------ one-time links

type TokenKind = "recovery" | "invite";

async function issueToken(userId: string, kind: TokenKind): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  const hours = kind === "invite" ? 24 * 7 : 1;
  await withApp(async (client) => {
    // One live link per kind and user.
    await client.query("delete from auth.one_time_tokens where user_id = $1 and kind = $2", [
      userId,
      kind,
    ]);
    await client.query(
      `insert into auth.one_time_tokens (user_id, kind, token_hash, expires_at)
       values ($1, $2, $3, now() + make_interval(hours => $4))`,
      [userId, kind, sha256(token), hours],
    );
  });
  return token;
}

function confirmLink(origin: string, token: string, kind: TokenKind): string {
  const url = new URL("/admin/auth/confirm", origin);
  url.searchParams.set("token_hash", token);
  url.searchParams.set("type", kind);
  url.searchParams.set("next", "/admin/reset-password");
  return url.toString();
}

/** Consumes an emailed link and opens a short session that may only set a password. */
export async function consumeToken(
  token: string,
  kind: TokenKind,
  userAgent: string | null,
): Promise<NewSession | null> {
  const userId = await withApp(async (client) => {
    const { rows } = await client.query<{ user_id: string }>(
      `update auth.one_time_tokens
          set used_at = now()
        where token_hash = $1 and kind = $2 and used_at is null and expires_at > now()
        returning user_id`,
      [sha256(token), kind],
    );
    return rows[0]?.user_id ?? null;
  });
  return userId ? createSession(userId, "link", userAgent) : null;
}

/**
 * Password reset request. Always succeeds from the caller's point of view, so
 * the form cannot be used to find out which emails are administrators.
 */
export async function requestPasswordReset(emailInput: unknown, origin: string): Promise<void> {
  const email = normalizeEmail(emailInput);
  if (!EMAIL.test(email)) return;
  const userId = await withApp(async (client) => {
    const { rows } = await client.query<{ id: string }>(
      `select u.id
         from auth.users u
         join public.admin_profiles p on p.user_id = u.id and p.active
        where lower(u.email) = $1`,
      [email],
    );
    return rows[0]?.id ?? null;
  });
  if (!userId) return;
  const token = await issueToken(userId, "recovery");
  await sendMail(recoveryMail(email, confirmLink(origin, token, "recovery")));
}

// ---------------------------------------------------------------- password

/**
 * Sets a new password for the signed-in user. A normal session must prove the
 * current password; a session opened by an emailed link may not need to. All
 * other sessions are signed out and a fresh full session is returned.
 */
export async function changePassword(
  session: SessionUser,
  current: unknown,
  password: unknown,
  userAgent: string | null,
): Promise<NewSession> {
  if (typeof password !== "string") throw new AuthFailure("Enter a new password", 422);
  const problem = passwordProblem(password);
  if (problem) throw new AuthFailure(problem, 422, { password: problem });

  if (session.via === "password") {
    const stored = await withApp(async (client) => {
      const { rows } = await client.query<{ encrypted_password: string | null }>(
        "select encrypted_password from auth.users where id = $1",
        [session.userId],
      );
      return rows[0]?.encrypted_password ?? null;
    });
    const valid = typeof current === "string" && (await verifyPassword(stored, current));
    if (!valid) {
      throw new AuthFailure("The current password is not correct", 403, {
        current: "The current password is not correct",
      });
    }
    if (current === password) {
      throw new AuthFailure("Choose a password different from the current one", 422, {
        password: "Choose a password different from the current one",
      });
    }
  }

  const hash = await hashPassword(password);
  await withApp((client) =>
    client.query(
      "update auth.users set encrypted_password = $2, updated_at = now() where id = $1",
      [session.userId, hash],
    ),
  );
  await revokeUserSessions(session.userId);
  return createSession(session.userId, "password", userAgent);
}

// ------------------------------------------------------------------ invite

export interface InviteResult {
  profile: unknown;
}

/**
 * Invites a new administrator. Only an active administrator may do this; the
 * profile is created with the caller's identity so the audit log records who
 * invited whom.
 */
export async function inviteAdmin(
  caller: SessionUser,
  emailInput: unknown,
  displayNameInput: unknown,
  origin: string,
): Promise<InviteResult> {
  const isAdmin = await withIdentity({ userId: caller.userId, email: caller.email }, async (c) => {
    const { rows } = await c.query<{ active: boolean; role: string }>(
      "select active, role from public.current_admin()",
    );
    return Boolean(rows[0]?.active && rows[0].role === "admin");
  });
  if (!isAdmin) throw new AuthFailure("Not authorized", 403);

  const email = normalizeEmail(emailInput);
  const displayName = typeof displayNameInput === "string" ? displayNameInput.trim() : "";
  const fieldErrors: Record<string, string> = {};
  if (!EMAIL.test(email) || email.length > 254) fieldErrors.email = "Enter a valid email address";
  if (!displayName || displayName.length > 120)
    fieldErrors.display_name = "Enter a name (120 characters max)";
  if (Object.keys(fieldErrors).length) {
    throw new AuthFailure("Some fields need attention", 422, fieldErrors);
  }

  const created = await withApp(async (client) => {
    const { rows } = await client.query<{ id: string }>(
      `insert into auth.users (email, raw_user_meta_data)
       values ($1, jsonb_build_object('display_name', $2::text))
       on conflict do nothing
       returning id`,
      [email, displayName],
    );
    return rows[0]?.id ?? null;
  });
  if (!created) {
    throw new AuthFailure("A user with this email already exists", 409, {
      email: "A user with this email already exists",
    });
  }

  let profile: unknown;
  try {
    profile = await withIdentity({ userId: caller.userId, email: caller.email }, async (c) => {
      const { rows } = await c.query("select public.create_admin_profile($1, $2) as profile", [
        created,
        displayName,
      ]);
      return rows[0]?.profile;
    });
  } catch (error) {
    // Do not leave a login without the profile it was invited for.
    await withApp((client) => client.query("delete from auth.users where id = $1", [created]));
    throw new AuthFailure(
      (error as Error).message || "The administrator profile could not be created",
      400,
    );
  }

  const token = await issueToken(created, "invite");
  try {
    await sendMail(inviteMail(email, confirmLink(origin, token, "invite")));
  } catch {
    throw new AuthFailure("The invitation could not be sent", 502);
  }
  return { profile };
}
