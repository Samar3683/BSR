#!/usr/bin/env node
// Drops and recreates the database of DATABASE_ADMIN_URL, then applies every
// migration (prisma migrate deploy): a fresh schema with the configuration seed
// and no data. For development and tests; it refuses other hosts unless
// BSR_ALLOW_DB_RESET=1 is set.
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";

import pg from "pg";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]", "db"]);

try {
  process.loadEnvFile(".env.local");
} catch {
  // No file: use the environment.
}

const url = process.env.DATABASE_ADMIN_URL || "postgresql://postgres@localhost:54320/bsr";
const target = new URL(url);
const database = decodeURIComponent(target.pathname.slice(1));
if (!database) {
  console.error("[db:reset] DATABASE_ADMIN_URL names no database.");
  process.exit(2);
}
if (!LOCAL_HOSTS.has(target.hostname) && process.env.BSR_ALLOW_DB_RESET !== "1") {
  console.error(
    `[db:reset] refusing to drop "${database}" on ${target.hostname}; set BSR_ALLOW_DB_RESET=1 if that is really intended.`,
  );
  process.exit(2);
}

const maintenance = new URL(url);
maintenance.pathname = "/postgres";
const client = new pg.Client({ connectionString: maintenance.toString() });
await client.connect();
try {
  console.log(`[db:reset] dropping and recreating ${database}`);
  await client.query(`drop database if exists "${database.replaceAll('"', '""')}" with (force)`);
  await client.query(`create database "${database.replaceAll('"', '""')}"`);
} finally {
  await client.end();
}

const prisma = createRequire(import.meta.url).resolve("prisma/build/index.js");
const result = spawnSync(process.execPath, [prisma, "migrate", "deploy"], {
  stdio: "inherit",
  env: { ...process.env, DATABASE_ADMIN_URL: url },
});
process.exit(result.status ?? 1);
