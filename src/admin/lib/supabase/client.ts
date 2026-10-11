import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

import { ADMIN_COOKIE_OPTIONS, getSupabaseEnv } from "./env";

let browserClient: SupabaseClient | null = null;

/** The admin panel's browser client (one per tab). RLS guards every query. */
export function getSupabase(): SupabaseClient {
  if (browserClient) return browserClient;
  const env = getSupabaseEnv();
  if (!env) {
    throw new Error(
      "Supabase is not configured (NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY).",
    );
  }
  browserClient = createBrowserClient(env.url, env.anonKey, {
    cookieOptions: {
      ...ADMIN_COOKIE_OPTIONS,
      secure: typeof window !== "undefined" && window.location.protocol === "https:",
    },
  });
  return browserClient;
}
