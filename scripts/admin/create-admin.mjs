#!/usr/bin/env node
/**
 * Bootstrap or manage BSR administrators from a trusted machine.
 *
 *   node scripts/admin/create-admin.mjs --email ops@example.com --name "Mario Rossi" --password '…'
 *   node scripts/admin/create-admin.mjs --email ops@example.com --name "Mario Rossi" --invite
 *   node scripts/admin/create-admin.mjs --email ops@example.com --deactivate
 *   node scripts/admin/create-admin.mjs --email ops@example.com --activate
 *
 * Needs NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY,
 * read from the environment or from .env.local. The service-role key bypasses
 * RLS: run this only on a trusted machine, never in a browser or CI log.
 * After the first administrator exists, invite others from Settings → Administrators.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseArgs } from "node:util";

import { createClient } from "@supabase/supabase-js";

function loadEnvFile(path) {
  try {
    for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
      const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
      if (match && !(match[1] in process.env))
        process.env[match[1]] = match[2].replace(/^["']|["']$/g, "");
    }
  } catch {
    // no file
  }
}

loadEnvFile(resolve(process.cwd(), ".env.local"));

const { values } = parseArgs({
  options: {
    email: { type: "string" },
    name: { type: "string" },
    password: { type: "string" },
    invite: { type: "boolean", default: false },
    activate: { type: "boolean", default: false },
    deactivate: { type: "boolean", default: false },
    "site-url": { type: "string" },
  },
});

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}
const email = values.email?.trim().toLowerCase();
if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  console.error("Pass --email with a valid address.");
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function findUser(address) {
  for (let page = 1; page < 100; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const user = data.users.find((u) => u.email?.toLowerCase() === address);
    if (user) return user;
    if (data.users.length < 200) return null;
  }
  return null;
}

async function main() {
  if (values.activate || values.deactivate) {
    const user = await findUser(email);
    if (!user) throw new Error(`No user with email ${email}`);
    const { error } = await supabase
      .from("admin_profiles")
      .update({ active: Boolean(values.activate) })
      .eq("user_id", user.id);
    if (error) throw error;
    console.log(`${email} is now ${values.activate ? "active" : "inactive"}.`);
    return;
  }

  const name = values.name?.trim();
  if (!name) throw new Error("Pass --name with the administrator's name.");
  if (!values.invite && (!values.password || values.password.length < 10)) {
    throw new Error("Pass --password (10+ characters, upper/lowercase and a digit) or --invite.");
  }

  let user = await findUser(email);
  if (!user) {
    if (values.invite) {
      const siteUrl = (values["site-url"] || process.env.ADMIN_SITE_URL || "").replace(/\/+$/, "");
      const { data, error } = await supabase.auth.admin.inviteUserByEmail(email, {
        data: { display_name: name },
        redirectTo: siteUrl
          ? `${siteUrl}/admin/auth/confirm?next=/admin/reset-password`
          : undefined,
      });
      if (error) throw error;
      user = data.user;
      console.log(`Invitation sent to ${email}.`);
    } else {
      const { data, error } = await supabase.auth.admin.createUser({
        email,
        password: values.password,
        email_confirm: true,
        user_metadata: { display_name: name },
      });
      if (error) throw error;
      user = data.user;
      console.log(`Created Auth user ${email}.`);
    }
  } else if (values.password) {
    const { error } = await supabase.auth.admin.updateUserById(user.id, {
      password: values.password,
    });
    if (error) throw error;
    console.log(`Updated the password of ${email}.`);
  }

  const { error } = await supabase
    .from("admin_profiles")
    .upsert(
      { user_id: user.id, display_name: name, role: "admin", active: true },
      { onConflict: "user_id" },
    );
  if (error) throw error;
  console.log(`${email} is an active administrator.`);
}

main().catch((error) => {
  console.error(error.message ?? error);
  process.exit(1);
});
