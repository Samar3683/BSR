import type { CookieOptionsWithName } from "@supabase/ssr";

/**
 * Browser-safe Supabase settings. Only the project URL and the public
 * (anon / publishable) key ever reach the client; the service-role key is
 * read exclusively by server-side tooling and Edge Functions.
 *
 * `process.env.NEXT_PUBLIC_*` must be read with direct property access so
 * Next.js can inline the values at build time.
 */
export interface SupabaseEnv {
  url: string;
  anonKey: string;
}

export function getSupabaseEnv(): SupabaseEnv | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;
  return { url: url.replace(/\/+$/, ""), anonKey };
}

/**
 * The admin session cookie is scoped to /admin: public pages never receive
 * it, and nothing outside the admin area can read it.
 */
export const ADMIN_COOKIE_OPTIONS: CookieOptionsWithName = {
  name: "bsr-admin-auth",
  path: "/admin",
  sameSite: "lax",
};
