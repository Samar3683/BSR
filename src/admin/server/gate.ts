import { cookies } from "next/headers";

import { isBackendConfigured } from "./config";
import { withIdentity } from "./db";
import { readSession, SESSION_COOKIE, type SessionUser } from "./session";

export interface CurrentAdmin {
  id: string;
  user_id: string;
  display_name: string;
  role: string;
  active: boolean;
  email: string | null;
}

export type AdminGate =
  | { state: "unconfigured" }
  | { state: "signed-out" }
  | { state: "no-access"; email: string | null }
  | { state: "inactive"; admin: CurrentAdmin }
  | { state: "ok"; admin: CurrentAdmin; session: SessionUser };

/** The signed-in user of this request (server components and route handlers). */
export async function getSessionUser(): Promise<SessionUser | null> {
  if (!isBackendConfigured()) return null;
  const store = await cookies();
  return readSession(store.get(SESSION_COOKIE)?.value);
}

/**
 * Server-side gate for the panel: a valid session of a user with an active
 * administrator profile. The database enforces the same rule through row-level
 * security on every query, so this is a user-experience boundary as well.
 */
export async function resolveAdminGate(): Promise<AdminGate> {
  if (!isBackendConfigured()) return { state: "unconfigured" };
  const session = await getSessionUser();
  if (!session) return { state: "signed-out" };
  const admin = await withIdentity({ userId: session.userId, email: session.email }, async (c) => {
    const { rows } = await c.query<CurrentAdmin>("select * from public.current_admin()");
    return rows[0] ?? null;
  });
  if (!admin) return { state: "no-access", email: session.email };
  if (!admin.active || admin.role !== "admin") return { state: "inactive", admin };
  return { state: "ok", admin, session };
}
