import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
export const LOCAL_DIR = path.join(REPO_ROOT, ".postgres-local");

export const PORTS = { db: 54320, smtp: 54325 };
export const DB_NAME = "bsr";
export const APP_ROLE = "bsr_app";

export const PGDATA = path.join(LOCAL_DIR, "pgdata");
export const PG_LOG = path.join(LOCAL_DIR, "postgres.log");
export const MAIL_DIR = path.join(LOCAL_DIR, "mail");
export const RUN_DIR = path.join(LOCAL_DIR, "run");

/** Connection strings for local development. Trust authentication on localhost only. */
export const ADMIN_URL = `postgresql://postgres@localhost:${PORTS.db}/${DB_NAME}`;
export const APP_URL = `postgresql://${APP_ROLE}@localhost:${PORTS.db}/${DB_NAME}`;
export const MAINTENANCE_URL = `postgresql://postgres@localhost:${PORTS.db}/postgres`;

/** Postgres tools come from PATH unless PG_BIN points at a bin directory. */
export function pgTool(name) {
  const exe = process.platform === "win32" ? `${name}.exe` : name;
  return process.env.PG_BIN ? path.join(process.env.PG_BIN, exe) : name;
}

export function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function capture(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { encoding: "utf8", windowsHide: true, ...opts });
  if (r.error) throw r.error;
  return r;
}

export function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { stdio: "inherit", windowsHide: true, ...opts });
  if (r.error) throw r.error;
  if (r.status !== 0) throw new Error(`Command failed (${r.status}): ${cmd} ${args.join(" ")}`);
  return r;
}

export function spawnDetached(cmd, args, { env, logFile }) {
  ensureDir(path.dirname(logFile));
  const fd = fs.openSync(logFile, "a");
  const child = spawn(cmd, args, {
    env,
    detached: true,
    windowsHide: true,
    stdio: ["ignore", fd, fd],
  });
  child.unref();
  fs.closeSync(fd);
  return child;
}

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function tcpCheck(port, host = "127.0.0.1", timeoutMs = 800) {
  return new Promise((resolve) => {
    const socket = net.connect({ port, host });
    const done = (ok) => {
      socket.destroy();
      resolve(ok);
    };
    socket.setTimeout(timeoutMs, () => done(false));
    socket.once("connect", () => done(true));
    socket.once("error", () => done(false));
  });
}
