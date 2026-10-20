import { randomBytes } from "node:crypto";

import { passwordProblem } from "../lib/password-policy";
import { db, withIdentity } from "@/server/db";
import { inviteMail, recoveryMail, sendMail } from "@/server/mail";
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
  // lower(email) matches the unique index users_email_lower_key.
  const [user] = await db().$queryRaw<{ id: string; encrypted_password: string | null }[]>`
    select id, encrypted_password from auth.users where lower(email) = ${email}`;
  const ok = await verifyPassword(user?.encrypted_password ?? null, password);
  if (!user || !ok) throw generic;
  await db().users.update({
    where: { id: user.id },
    data: { last_sign_in_at: new Date() },
    select: { id: true },
  });
  return createSession(user.id, "password", userAgent);
}

// ------------------------------------------------------------ one-time links

type TokenKind = "recovery" | "invite";

async function issueToken(userId: string, kind: TokenKind): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  const hours = kind === "invite" ? 24 * 7 : 1;
  // One live link per kind and user.
  await db().$transaction([
    db().one_time_tokens.deleteMany({ where: { user_id: userId, kind } }),
    db().one_time_tokens.create({
      data: {
        user_id: userId,
        kind,
        token_hash: sha256(token),
        expires_at: new Date(Date.now() + hours * 3_600_000),
      },
      select: { id: true },
    }),
  ]);
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
  // One statement (update … returning): a link can only be used once.
  const [used] = await db().one_time_tokens.updateManyAndReturn({
    where: { token_hash: sha256(token), kind, used_at: null, expires_at: { gt: new Date() } },
    data: { used_at: new Date() },
    select: { user_id: true },
  });
  const userId = used?.user_id ?? null;
  return userId ? createSession(userId, "link", userAgent) : null;
}

/**
 * Password reset request. Always succeeds from the caller's point of view, so
 * the form cannot be used to find out which emails are administrators.
 */
export async function requestPasswordReset(emailInput: unknown, origin: string): Promise<void> {
  const email = normalizeEmail(emailInput);
  if (!EMAIL.test(email)) return;
  const [row] = await db().$queryRaw<{ id: string | null }[]>`
    select auth.active_admin_user_id(${email}) as id`;
  const userId = row?.id ?? null;
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
    const user = await db().users.findUnique({
      where: { id: session.userId },
      select: { encrypted_password: true },
    });
    const stored = user?.encrypted_password ?? null;
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
  await db().users.update({
    where: { id: session.userId },
    data: { encrypted_password: hash, updated_at: new Date() },
    select: { id: true },
  });
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
  const isAdmin = await withIdentity({ userId: caller.userId, email: caller.email }, async (tx) => {
    const rows = await tx.$queryRaw<{ active: boolean; role: string }[]>`
      select active, role from public.current_admin()`;
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

  // insert … on conflict do nothing returning id: nothing comes back for a taken email.
  const [inserted] = await db().users.createManyAndReturn({
    data: [{ email, raw_user_meta_data: { display_name: displayName } }],
    skipDuplicates: true,
    select: { id: true },
  });
  const created = inserted?.id ?? null;
  if (!created) {
    throw new AuthFailure("A user with this email already exists", 409, {
      email: "A user with this email already exists",
    });
  }

  let profile: unknown;
  try {
    profile = await withIdentity({ userId: caller.userId, email: caller.email }, async (tx) => {
      const rows = await tx.$queryRaw<{ profile: unknown }[]>`
        select to_json(public.create_admin_profile(${created}::uuid, ${displayName})) as profile`;
      return rows[0]?.profile;
    });
  } catch (error) {
    // Do not leave a login without the profile it was invited for.
    await db().users.deleteMany({ where: { id: created } });
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
