import { execFileSync } from "node:child_process";

import type { FullConfig } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

import { stackEnv } from "./stack";
import { USERS } from "./users";

/**
 * Fresh backend for the run: reset the local database (migrations + seed
 * configuration, no data), then create the test accounts through the real
 * Auth admin API, four of them with administrator profiles (one inactive).
 */
export default async function globalSetup(config: FullConfig) {
  const stack = stackEnv();
  if (!stack.url || !stack.anonKey || !stack.serviceKey) {
    throw new Error(
      "Admin E2E needs a backend: run `pnpm supabase:local start` or set the Supabase env vars.",
    );
  }
  if (stack.local && process.env.BSR_E2E_RESET !== "0") {
    // Auth email links point at the server under test.
    execFileSync(process.execPath, ["tools/supabase-local/cli.mjs", "reset"], {
      stdio: "inherit",
      env: {
        ...process.env,
        BSR_SITE_URL: config.projects[0]?.use.baseURL ?? "http://localhost:3200",
      },
    });
  }

  const service = createClient(stack.url, stack.serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  for (const user of Object.values(USERS)) {
    const { data, error } = await service.auth.admin.createUser({
      email: user.email,
      password: user.password,
      email_confirm: true,
    });
    let id = data.user?.id;
    if (error) {
      // Re-run without reset: the user exists already.
      const list = await service.auth.admin.listUsers({ perPage: 1000 });
      id = list.data.users.find((u) => u.email === user.email)?.id;
      if (!id) throw error;
      await service.auth.admin.updateUserById(id, { password: user.password });
    }
    if (user.profile) {
      const { error: profileError } = await service.from("admin_profiles").upsert(
        {
          user_id: id,
          display_name: user.name,
          role: "admin",
          active: user.profile === "active",
        },
        { onConflict: "user_id" },
      );
      if (profileError) throw profileError;
    }
  }
}
