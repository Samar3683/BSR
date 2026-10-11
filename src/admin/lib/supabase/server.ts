import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

import { ADMIN_COOKIE_OPTIONS, getSupabaseEnv } from "./env";

/**
 * Supabase client for Server Components and Route Handlers, bound to the
 * request's admin session cookie. Returns null when Supabase is not
 * configured. Server Components cannot write cookies; token refreshes are
 * persisted by the proxy (src/proxy.ts) before rendering.
 */
export async function createSupabaseServerClient(): Promise<SupabaseClient | null> {
  const env = getSupabaseEnv();
  if (!env) return null;
  const store = await cookies();
  return createServerClient(env.url, env.anonKey, {
    cookieOptions: { ...ADMIN_COOKIE_OPTIONS, secure: process.env.NODE_ENV === "production" },
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          for (const { name, value, options } of list) store.set(name, value, options);
        } catch {
          // Called from a Server Component: the proxy already refreshed the session.
        }
      },
    },
  });
}

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
  | { state: "ok"; admin: CurrentAdmin };

/**
 * Server-side gate for the panel: a verified Supabase Auth user (validated
 * with the Auth server, not just the cookie) with an active admin profile.
 * The database enforces the same rule through RLS on every query.
 */
export async function resolveAdminGate(): Promise<AdminGate> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { state: "unconfigured" };
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) return { state: "signed-out" };
  const { data, error } = await supabase.rpc("current_admin");
  const admin = (Array.isArray(data) ? data[0] : null) as CurrentAdmin | null;
  if (error || !admin) return { state: "no-access", email: userData.user.email ?? null };
  if (!admin.active || admin.role !== "admin") return { state: "inactive", admin };
  return { state: "ok", admin };
}
