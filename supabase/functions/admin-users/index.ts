// Supabase Edge Function (Deno): invite an administrator. See handler.ts.
import { createClient } from "npm:@supabase/supabase-js@2.117.3";

import { handleAdminUsers, type CallerClient, type ServiceClient } from "./handler.ts";

const url = Deno.env.get("SUPABASE_URL");
const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const siteUrl = Deno.env.get("ADMIN_SITE_URL");

const noSession = { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false };

Deno.serve((req) =>
  handleAdminUsers(req, {
    env: { url, anonKey, serviceKey, siteUrl },
    callerClient: (token) =>
      createClient(url!, anonKey!, {
        global: { headers: { Authorization: `Bearer ${token}` } },
        auth: noSession,
      }) as unknown as CallerClient,
    serviceClient: () =>
      createClient(url!, serviceKey!, { auth: noSession }) as unknown as ServiceClient,
  }),
);
