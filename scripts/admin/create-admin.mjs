#!/usr/bin/env node
/**
 * Bootstrap or manage BSR administrators from a trusted machine.
 *
 *   node scripts/admin/create-admin.mjs --email ops@example.com --name "Mario Rossi" --password '…'
 *   node scripts/admin/create-admin.mjs --email ops@example.com --name "Mario Rossi" --invite
 *   node scripts/admin/create-admin.mjs --email ops@example.com --deactivate
 *   node scripts/admin/create-admin.mjs --email ops@example.com --activate
 *
 * Needs DATABASE_ADMIN_URL (or DATABASE_URL), read from the environment or
 * from .env.local, and writes straight to PostgreSQL: run it only on a trusted
 * machine. With --invite (needs SMTP_URL, SESSION_SECRET is not used) the person
 * gets a one-time link by email instead of a password you chose.
 * After the first administrator exists, invite others from Settings → Administrators.
 */
import { createHash, randomBytes, scrypt } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseArgs } from "node:util";

import nodemailer from "nodemailer";
import pg from "pg";

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

const url = process.env.DATABASE_ADMIN_URL || process.env.DATABASE_URL;
if (!url) {
  console.error("Set DATABASE_ADMIN_URL (or DATABASE_URL) to the PostgreSQL connection string.");
  process.exit(1);
}
const email = values.email?.trim().toLowerCase();
if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  console.error("Pass --email with a valid address.");
  process.exit(1);
}

/** Same format as the app: scrypt$N$r$p$salt$hash (base64url). */
function hashPassword(password) {
  const salt = randomBytes(16);
  const cost = { N: 16384, r: 8, p: 1 };
  return new Promise((resolveHash, reject) => {
    scrypt(password.normalize("NFKC"), salt, 64, cost, (error, key) => {
      if (error) reject(error);
      else
        resolveHash(
          `scrypt$${cost.N}$${cost.r}$${cost.p}$${salt.toString("base64url")}$${key.toString("base64url")}`,
        );
    });
  });
}

function passwordProblem(password) {
  if (password.length < 10) return "Use at least 10 characters";
  if (!/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/\d/.test(password))
    return "Use upper- and lowercase letters and at least one digit";
  return null;
}

const client = new pg.Client({ connectionString: url });

async function findUser(address) {
  const { rows } = await client.query("select id from auth.users where lower(email) = $1", [
    address,
  ]);
  return rows[0] ?? null;
}

async function sendInvite(userId) {
  const smtp = process.env.SMTP_URL;
  const site = (values["site-url"] || process.env.APP_URL || "").replace(/\/+$/, "");
  if (!smtp || !site) {
    throw new Error("--invite needs SMTP_URL and APP_URL (or --site-url).");
  }
  const token = randomBytes(32).toString("base64url");
  await client.query("delete from auth.one_time_tokens where user_id = $1 and kind = 'invite'", [
    userId,
  ]);
  await client.query(
    `insert into auth.one_time_tokens (user_id, kind, token_hash, expires_at)
     values ($1, 'invite', $2, now() + interval '7 days')`,
    [userId, createHash("sha256").update(token).digest()],
  );
  const link = `${site}/admin/auth/confirm?token_hash=${token}&type=invite&next=/admin/reset-password`;
  await nodemailer.createTransport(smtp).sendMail({
    from: process.env.MAIL_FROM || "BSR Trasporti <no-reply@localhost>",
    to: email,
    subject: "Your BSR Trasporti admin access",
    text: `You have been invited to the BSR Trasporti operations panel.\n\nChoose your password: ${link}\n\nThe link works once and expires in 7 days.`,
  });
}

async function main() {
  await client.connect();
  if (values.activate || values.deactivate) {
    const user = await findUser(email);
    if (!user) throw new Error(`No user with email ${email}`);
    const result = await client.query("update public.admin_profiles set active = $2 where user_id = $1", [
      user.id,
      Boolean(values.activate),
    ]);
    if (!result.rowCount) throw new Error(`${email} has no administrator profile`);
    console.log(`${email} is now ${values.activate ? "active" : "inactive"}.`);
    return;
  }

  const name = values.name?.trim();
  if (!name) throw new Error("Pass --name for a new administrator.");
  if (!values.invite) {
    if (!values.password) throw new Error("Pass --password, or use --invite.");
    const problem = passwordProblem(values.password);
    if (problem) throw new Error(problem);
  }

  let user = await findUser(email);
  const hash = values.invite ? null : await hashPassword(values.password);
  if (!user) {
    const { rows } = await client.query(
      "insert into auth.users (email, encrypted_password) values ($1, $2) returning id",
      [email, hash],
    );
    user = rows[0];
  } else if (hash) {
    await client.query("update auth.users set encrypted_password = $2, updated_at = now() where id = $1", [
      user.id,
      hash,
    ]);
  }
  await client.query(
    `insert into public.admin_profiles (user_id, display_name, role, active)
     values ($1, $2, 'admin', true)
     on conflict (user_id) do update set display_name = excluded.display_name, active = true`,
    [user.id, name],
  );
  if (values.invite) {
    await sendInvite(user.id);
    console.log(`Invitation sent to ${email}.`);
  } else {
    console.log(`Administrator ${email} is ready; sign in at /admin/login.`);
  }
}

main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(() => client.end());
