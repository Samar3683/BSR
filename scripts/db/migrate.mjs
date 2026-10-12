#!/usr/bin/env node
// Applies db/bootstrap.sql and every pending db/migrations/*.sql, in order, each in
// its own transaction, recording them in db_admin.schema_migrations.
//
//   DATABASE_ADMIN_URL   a role that may create schemas, roles and extensions
//                        (falls back to DATABASE_URL)
//   DATABASE_APP_ROLE    the application's login role (default: bsr_app); it may
//                        switch into the request roles but owns nothing
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import pg from "pg";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const DB_DIR = path.join(ROOT, "db");

function loadEnvFile() {
  const file = path.join(ROOT, ".env.local");
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

export async function migrate({ url, appRole = "bsr_app", log = console.log }) {
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    await client.query("create schema if not exists db_admin");
    await client.query(`
      create table if not exists db_admin.schema_migrations (
        name text primary key,
        applied_at timestamptz not null default now()
      )`);
    await client.query("revoke all on schema db_admin from public");

    // The database defaults the migrations were written for (UTC, extensions on the path).
    const {
      rows: [{ db }],
    } = await client.query("select current_database() as db");
    await client.query(`alter database "${db}" set timezone = 'UTC'`);
    await client.query(`alter database "${db}" set search_path = "$user", public, extensions`);
    // The new defaults apply to new sessions; use them here too.
    await client.query(`set search_path = "$user", public, extensions`);

    await client.query(fs.readFileSync(path.join(DB_DIR, "bootstrap.sql"), "utf8"));

    const applied = new Set(
      (await client.query("select name from db_admin.schema_migrations")).rows.map((r) => r.name),
    );
    const files = fs
      .readdirSync(path.join(DB_DIR, "migrations"))
      .filter((f) => f.endsWith(".sql"))
      .sort();
    let count = 0;
    for (const file of files) {
      if (applied.has(file)) continue;
      log(`applying ${file}`);
      await client.query("begin");
      try {
        await client.query(fs.readFileSync(path.join(DB_DIR, "migrations", file), "utf8"));
        await client.query("insert into db_admin.schema_migrations (name) values ($1)", [file]);
        await client.query("commit");
        count++;
      } catch (error) {
        await client.query("rollback");
        throw new Error(`${file}: ${error.message}`);
      }
    }

    const roleExists =
      (await client.query("select 1 from pg_roles where rolname = $1", [appRole])).rowCount > 0;
    if (roleExists) {
      // The app role switches into the request roles (SET ROLE) and manages the
      // auth tables; it does not inherit table privileges and has no DDL rights.
      await client.query(`alter role "${appRole}" noinherit`);
      await client.query(`grant anon, authenticated, service_role to "${appRole}"`);
      await client.query(`grant usage on schema public, auth, storage to "${appRole}"`);
      await client.query(
        `grant select, insert, update, delete on auth.users, auth.sessions, auth.one_time_tokens to "${appRole}"`,
      );
      // Password-reset requests are only sent to people with an active administrator profile.
      await client.query(
        `grant execute on function auth.active_admin_user_id(text) to "${appRole}"`,
      );
      // Public-site intake: the only way the web server writes visitor submissions.
      await client.query(`grant usage on schema intake to "${appRole}"`);
      await client.query(
        `grant execute on function intake.submit_quote_request(jsonb), intake.record_contact_event(text, text) to "${appRole}"`,
      );
    } else {
      log(`note: role ${appRole} does not exist yet; create it and run this again to grant access`);
    }
    log(count ? `applied ${count} migration(s)` : "database is up to date");
  } finally {
    await client.end();
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  loadEnvFile();
  const url = process.env.DATABASE_ADMIN_URL || process.env.DATABASE_URL;
  if (!url) {
    console.error("Set DATABASE_ADMIN_URL (or DATABASE_URL) to the PostgreSQL connection string.");
    process.exit(2);
  }
  migrate({ url, appRole: process.env.DATABASE_APP_ROLE || "bsr_app" }).catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
