import { execFileSync } from "node:child_process";

import pg from "pg";

import { hashPassword } from "../../src/admin/server/passwords";
import { stackEnv } from "./stack";
import { USERS } from "./users";

/**
 * Fresh backend for the run: reset the local database (migrations + seed
 * configuration, no data), then create the test accounts directly in the auth
 * tables, four of them with administrator profiles (one inactive).
 */
export default async function globalSetup() {
  const stack = stackEnv();
  if (!stack.sessionSecret) {
    throw new Error(
      "Admin E2E needs a backend: run `npm run db:start` (with a .env.local) or set DATABASE_URL and SESSION_SECRET.",
    );
  }
  if (stack.local && process.env.BSR_E2E_RESET !== "0") {
    execFileSync(process.execPath, ["scripts/db/reset.mjs"], {
      stdio: "inherit",
      env: { ...process.env, DATABASE_ADMIN_URL: stack.adminUrl },
    });
  }

  const client = new pg.Client({ connectionString: stack.adminUrl });
  await client.connect();
  try {
    for (const user of Object.values(USERS)) {
      const hash = await hashPassword(user.password);
      const { rows } = await client.query<{ id: string }>(
        `insert into auth.users (email, encrypted_password)
         values ($1, $2)
         on conflict (lower(email)) do update set encrypted_password = excluded.encrypted_password
         returning id`,
        [user.email, hash],
      );
      const id = rows[0]!.id;
      if (user.profile) {
        await client.query(
          `insert into public.admin_profiles (user_id, display_name, role, active)
           values ($1, $2, 'admin', $3)
           on conflict (user_id) do update
             set display_name = excluded.display_name, active = excluded.active`,
          [id, user.name, user.profile === "active"],
        );
      }
    }
  } finally {
    await client.end();
  }
}
