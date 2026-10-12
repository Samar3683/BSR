#!/usr/bin/env node
// Local PostgreSQL for development and tests: a private cluster in .postgres-local/
// (trust authentication on localhost only), plus a tiny SMTP sink that captures the
// emails the app sends. Requires the PostgreSQL tools on PATH (or PG_BIN).
//
//   node tools/postgres-local/cli.mjs setup     create the cluster (once)
//   node tools/postgres-local/cli.mjs start     start PostgreSQL and the mail sink
//   node tools/postgres-local/cli.mjs status
//   node tools/postgres-local/cli.mjs stop
//   node tools/postgres-local/cli.mjs reset     drop and recreate the database, then migrate
//   node tools/postgres-local/cli.mjs env       print the .env.local lines
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  ADMIN_URL,
  APP_ROLE,
  APP_URL,
  DB_NAME,
  LOCAL_DIR,
  MAIL_DIR,
  MAINTENANCE_URL,
  PGDATA,
  PG_LOG,
  PORTS,
  REPO_ROOT,
  RUN_DIR,
  capture,
  ensureDir,
  pgTool,
  run,
  sleep,
  spawnDetached,
  tcpCheck,
} from "./lib.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SMTP_PID = path.join(RUN_DIR, "smtp.pid");

const log = (message) => console.log(`[postgres-local] ${message}`);

function pgRunning() {
  return capture(pgTool("pg_ctl"), ["status", "-D", PGDATA]).status === 0;
}

function setup() {
  ensureDir(LOCAL_DIR);
  if (fs.existsSync(path.join(PGDATA, "PG_VERSION"))) {
    log("cluster already exists");
  } else {
    log(`initializing cluster in ${PGDATA}`);
    run(pgTool("initdb"), ["-D", PGDATA, "-U", "postgres", "-A", "trust", "-E", "UTF8", "--locale=C"]);
    fs.appendFileSync(
      path.join(PGDATA, "postgresql.conf"),
      `\nport = ${PORTS.db}\nlisten_addresses = 'localhost'\nmax_connections = 100\n`,
    );
  }
}

/** A stable local session secret, kept in .postgres-local/ (gitignored). */
function sessionSecret() {
  const file = path.join(LOCAL_DIR, "session-secret");
  ensureDir(LOCAL_DIR);
  if (!fs.existsSync(file)) fs.writeFileSync(file, crypto.randomBytes(48).toString("base64url"));
  return fs.readFileSync(file, "utf8").trim();
}

function envLines() {
  return [
    `DATABASE_URL=${APP_URL}`,
    `DATABASE_ADMIN_URL=${ADMIN_URL}`,
    `SESSION_SECRET=${sessionSecret()}`,
    "APP_URL=http://localhost:3000",
    `SMTP_URL=smtp://127.0.0.1:${PORTS.smtp}`,
    "MAIL_FROM=BSR Trasporti <no-reply@bsr.test>",
  ];
}

function writeEnvFile() {
  const file = path.join(REPO_ROOT, ".env.local");
  if (fs.existsSync(file)) {
    log(".env.local exists; run `env` to see the values for local development");
    return;
  }
  fs.writeFileSync(file, `${envLines().join("\n")}\n`);
  log("wrote .env.local");
}

function psql(url, query) {
  const r = capture(pgTool("psql"), ["-X", "-At", "-v", "ON_ERROR_STOP=1", url, "-c", query]);
  if (r.status !== 0) throw new Error(`psql failed: ${(r.stderr || r.stdout).trim()}`);
  return r.stdout.trim();
}

/** Creates the application database and its limited login role when missing. */
function ensureDatabase() {
  const exists = psql(MAINTENANCE_URL, `select 1 from pg_database where datname = '${DB_NAME}'`);
  if (!exists) {
    log(`creating database ${DB_NAME}`);
    psql(MAINTENANCE_URL, `create database ${DB_NAME}`);
  }
  const role = psql(MAINTENANCE_URL, `select 1 from pg_roles where rolname = '${APP_ROLE}'`);
  if (!role) psql(MAINTENANCE_URL, `create role ${APP_ROLE} login noinherit`);
}

async function start() {
  setup();
  writeEnvFile();
  if (!pgRunning()) {
    log("starting PostgreSQL");
    ensureDir(RUN_DIR);
    const fd = fs.openSync(path.join(RUN_DIR, "pg_ctl.log"), "a");
    try {
      run(pgTool("pg_ctl"), ["-D", PGDATA, "-l", PG_LOG, "-w", "-t", "60", "start"], {
        stdio: ["ignore", fd, fd],
      });
    } finally {
      fs.closeSync(fd);
    }
  }
  for (let i = 0; i < 60 && !(await tcpCheck(PORTS.db)); i++) await sleep(500);
  if (!(await tcpCheck(PORTS.db))) throw new Error(`PostgreSQL did not start (see ${PG_LOG})`);

  if (!(await tcpCheck(PORTS.smtp))) {
    ensureDir(MAIL_DIR);
    const child = spawnDetached(process.execPath, [path.join(HERE, "smtp-sink.mjs")], {
      env: process.env,
      logFile: path.join(RUN_DIR, "smtp.log"),
    });
    fs.writeFileSync(SMTP_PID, String(child.pid));
    for (let i = 0; i < 20 && !(await tcpCheck(PORTS.smtp)); i++) await sleep(250);
  }
  ensureDatabase();
  log(`ready: ${ADMIN_URL}`);
}

function stop() {
  try {
    const pid = Number(fs.readFileSync(SMTP_PID, "utf8"));
    if (pid) process.kill(pid);
  } catch {
    // not running
  }
  if (pgRunning()) {
    log("stopping PostgreSQL");
    run(pgTool("pg_ctl"), ["-D", PGDATA, "-m", "fast", "-w", "-t", "60", "stop"]);
  }
}

async function status() {
  const db = pgRunning() && (await tcpCheck(PORTS.db));
  const smtp = await tcpCheck(PORTS.smtp);
  console.log(`postgres  :${PORTS.db}  ${db ? "running" : "stopped"}`);
  console.log(`mail sink :${PORTS.smtp}  ${smtp ? "running" : "stopped"}`);
  process.exitCode = db ? 0 : 1;
}

async function reset() {
  await start();
  log(`dropping and recreating ${DB_NAME}`);
  psql(MAINTENANCE_URL, `drop database if exists ${DB_NAME} with (force)`);
  psql(MAINTENANCE_URL, `create database ${DB_NAME}`);
  run(process.execPath, [path.join(REPO_ROOT, "scripts", "db", "migrate.mjs")], {
    env: { ...process.env, DATABASE_ADMIN_URL: ADMIN_URL, DATABASE_URL: APP_URL },
  });
}

const command = process.argv[2];
const commands = {
  setup: async () => setup(),
  start,
  stop: async () => stop(),
  status,
  reset,
  env: async () => console.log(envLines().join("\n")),
};

if (!commands[command]) {
  console.error(`Usage: node tools/postgres-local/cli.mjs <${Object.keys(commands).join("|")}>`);
  process.exit(2);
}
commands[command]().catch((error) => {
  console.error(`[postgres-local] ${error.message}`);
  process.exit(1);
});
