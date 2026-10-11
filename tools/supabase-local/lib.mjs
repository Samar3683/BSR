// Shared constants and helpers for the Docker-less local Supabase stack.
// Node built-ins only.
import { spawn, spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const TOOLS_DIR = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(TOOLS_DIR, "..", "..");
export const LOCAL_DIR = path.resolve(
  process.env.SUPABASE_LOCAL_DIR || path.join(REPO_ROOT, ".supabase-local"),
);

export const VERSIONS = {
  go: "1.27.2",
  auth: "2.197.0", // same tag the Supabase CLI pins (supabase/gotrue:v2.197.0)
  postgrest: "16.4", // postgrest/postgrest:v16.4
  storage: "1.81.0", // supabase/storage-api:v1.81.0
  deno: "2.9.7",
  node: "24.21.0", // storage-api requires Node >= 24
};

// sha256 of the official archives (Go/Node/Deno publish these; the others are pinned on first fetch).
export const ARTIFACTS = {
  go: {
    url: `https://go.dev/dl/go${VERSIONS.go}.windows-amd64.zip`,
    file: `go${VERSIONS.go}.windows-amd64.zip`,
    sha256: "1314008898bd40df77af4b014f777f08873dbdfbcd3d92308728ee03304fe04f",
  },
  node: {
    url: `https://nodejs.org/dist/v${VERSIONS.node}/node-v${VERSIONS.node}-win-x64.zip`,
    file: `node-v${VERSIONS.node}-win-x64.zip`,
    sha256: "158f7685b44de51f6c0df1d153526cbcd3e1bc739a8dfc607721cef75de9e541",
  },
  deno: {
    url: `https://github.com/denoland/deno/releases/download/v${VERSIONS.deno}/deno-x86_64-pc-windows-msvc.zip`,
    file: `deno-v${VERSIONS.deno}-x86_64-pc-windows-msvc.zip`,
    sha256: "a0c3101b4158d1dfb7d6a78a7bf0f3de80c96bb423c152beec8beb22786f2238",
  },
  postgrest: {
    url: `https://github.com/PostgREST/postgrest/releases/download/v${VERSIONS.postgrest}/postgrest-v${VERSIONS.postgrest}-windows-x86-64.zip`,
    file: `postgrest-v${VERSIONS.postgrest}-windows-x86-64.zip`,
    sha256: "29a5b56e5a09b7168bb552ef14aa7ade40bf0a81dd0687cffa86610187b89d78",
  },
  authSrc: {
    url: `https://codeload.github.com/supabase/auth/tar.gz/refs/tags/v${VERSIONS.auth}`,
    file: `auth-v${VERSIONS.auth}.tar.gz`,
  },
  storageSrc: {
    url: `https://codeload.github.com/supabase/storage/tar.gz/refs/tags/v${VERSIONS.storage}`,
    file: `storage-v${VERSIONS.storage}.tar.gz`,
  },
};

export const PORTS = {
  gateway: 54321, // public API URL (Kong in `supabase start`)
  db: 54322, // Postgres
  smtp: 54325, // SMTP sink (GoTrue mail)
  auth: 54329, // GoTrue
  rest: 54330, // PostgREST
  storage: 54331, // storage-api
  restAdmin: 54332, // PostgREST admin server (/live, /ready)
  storageAdmin: 54333, // storage-api admin port (unused in single-tenant mode, kept off the defaults)
  functionsBase: 54340, // one Deno process per function: 54340, 54341, ...
};

export const API_URL = `http://localhost:${PORTS.gateway}`;
export const DB_URL = `postgresql://postgres@localhost:${PORTS.db}/postgres`;

// Project dir containing supabase/ (like the CLI's --workdir); defaults to the repo root.
const WORKDIR = path.resolve(process.env.SUPABASE_LOCAL_WORKDIR || REPO_ROOT);

export const P = {
  local: LOCAL_DIR,
  pgdata: path.join(LOCAL_DIR, "pgdata"),
  pgLog: path.join(LOCAL_DIR, "postgres.log"),
  downloads: path.join(LOCAL_DIR, "downloads"),
  bin: path.join(LOCAL_DIR, "bin"),
  goRoot: path.join(LOCAL_DIR, "go"),
  goPath: path.join(LOCAL_DIR, "gopath"),
  goCache: path.join(LOCAL_DIR, "gocache"),
  node24: path.join(LOCAL_DIR, "node"),
  src: path.join(LOCAL_DIR, "src"),
  authSrc: path.join(LOCAL_DIR, "src", `auth-${VERSIONS.auth}`),
  storageSrc: path.join(LOCAL_DIR, "storage-src"),
  storageFiles: path.join(LOCAL_DIR, "storage-files"),
  run: path.join(LOCAL_DIR, "run"),
  mail: path.join(LOCAL_DIR, "mail"),
  denoDir: path.join(LOCAL_DIR, "deno-dir"),
  keys: path.join(LOCAL_DIR, "keys.json"),
  functionsState: path.join(LOCAL_DIR, "run", "functions.json"),
  supabaseDir: path.join(WORKDIR, "supabase"),
  migrationsDir: path.join(WORKDIR, "supabase", "migrations"),
  seedFile: path.join(WORKDIR, "supabase", "seed.sql"),
  functionsDir: path.join(WORKDIR, "supabase", "functions"),
  configToml: path.join(WORKDIR, "supabase", "config.toml"),
  templatesDir: path.join(WORKDIR, "supabase", "templates"),
  workdir: WORKDIR,
  bootstrapSql: path.join(TOOLS_DIR, "bootstrap.sql"),
};

export const EXE = {
  auth: path.join(P.bin, "auth.exe"),
  postgrest: path.join(P.bin, "postgrest.exe"),
  deno: path.join(P.bin, "deno.exe"),
  go: path.join(P.goRoot, "bin", "go.exe"),
  node24: path.join(P.node24, "node.exe"),
  npm24: path.join(P.node24, "node_modules", "npm", "bin", "npm-cli.js"),
};

// Postgres client tools: from PATH unless PG_BIN points at a bin directory.
export function pgTool(name) {
  return process.env.PG_BIN ? path.join(process.env.PG_BIN, `${name}.exe`) : name;
}

// ---------------------------------------------------------------- JWT (HS256)

export function signJwt(payload, secret) {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = crypto.createHmac("sha256", secret).update(`${header}.${body}`).digest("base64url");
  return `${header}.${body}.${sig}`;
}

/** Returns the payload of a valid, unexpired HS256 token, otherwise null. */
export function verifyJwt(token, secret) {
  if (typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    const header = JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8"));
    if (header.alg !== "HS256") return null;
    const expected = crypto.createHmac("sha256", secret).update(`${parts[0]}.${parts[1]}`).digest();
    const actual = Buffer.from(parts[2], "base64url");
    if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) return null;
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
    if (typeof payload.exp === "number" && payload.exp < Date.now() / 1000) return null;
    return payload;
  } catch {
    return null;
  }
}

export function generateKeys() {
  const jwtSecret = crypto.randomBytes(48).toString("base64url"); // 64 chars
  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + 10 * 365 * 24 * 3600;
  return {
    jwtSecret,
    anonKey: signJwt({ iss: "supabase", ref: "local", role: "anon", iat, exp }, jwtSecret),
    serviceRoleKey: signJwt(
      { iss: "supabase", ref: "local", role: "service_role", iat, exp },
      jwtSecret,
    ),
    // New-style API keys; the gateway maps them to the JWTs above like Kong does.
    publishableKey: `sb_publishable_${crypto.randomBytes(18).toString("base64url")}`,
    secretKey: `sb_secret_${crypto.randomBytes(18).toString("base64url")}`,
    createdAt: new Date().toISOString(),
  };
}

export function loadKeys() {
  if (!fs.existsSync(P.keys)) {
    throw new Error(`Missing ${P.keys}. Run: node tools/supabase-local/cli.mjs setup`);
  }
  return JSON.parse(fs.readFileSync(P.keys, "utf8"));
}

// ---------------------------------------------------------------- misc helpers

export function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function readJson(file, fallback = null) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return fallback;
  }
}

export function writeJson(file, value) {
  ensureDir(path.dirname(file));
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2));
  fs.renameSync(tmp, file);
}

export function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

export function isPidAlive(pid) {
  if (!pid) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return e.code === "EPERM";
  }
}

/** Image name (e.g. "node.exe") of a running PID, or null. */
export function processImage(pid) {
  const r = spawnSync("tasklist", ["/FI", `PID eq ${pid}`, "/FO", "CSV", "/NH"], {
    encoding: "utf8",
    windowsHide: true,
  });
  const m = /^"([^"]+)","(\d+)"/m.exec(r.stdout || "");
  return m && Number(m[2]) === Number(pid) ? m[1] : null;
}

export function killTree(pid) {
  spawnSync("taskkill", ["/PID", String(pid), "/T", "/F"], { stdio: "ignore", windowsHide: true });
}

export function tcpCheck(port, host = "127.0.0.1", timeoutMs = 1000) {
  return new Promise((resolve) => {
    const sock = net.connect({ port, host });
    const done = (ok) => {
      sock.destroy();
      resolve(ok);
    };
    sock.setTimeout(timeoutMs, () => done(false));
    sock.once("connect", () => done(true));
    sock.once("error", () => done(false));
  });
}

export async function httpCheck(url, { timeoutMs = 2000, headers = {} } = {}) {
  try {
    const res = await fetch(url, { headers, signal: AbortSignal.timeout(timeoutMs) });
    await res.arrayBuffer().catch(() => {});
    return res.status;
  } catch {
    return 0;
  }
}

/** Run a command, inheriting stdio; throws on non-zero exit. */
export function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { stdio: "inherit", windowsHide: true, ...opts });
  if (r.error) throw r.error;
  if (r.status !== 0) {
    throw new Error(`Command failed (${r.status}): ${cmd} ${args.join(" ")}`);
  }
  return r;
}

/** Run a command capturing output (utf8). Never throws on exit code. */
export function capture(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, {
    encoding: "utf8",
    windowsHide: true,
    maxBuffer: 64 * 1024 * 1024,
    ...opts,
  });
  if (r.error) throw r.error;
  return r;
}

/** Spawn a long-running detached process with stdout/stderr appended to logFile. Returns the ChildProcess. */
export function spawnDetached(cmd, args, { cwd, env, logFile }) {
  ensureDir(path.dirname(logFile));
  const fd = fs.openSync(logFile, "a");
  fs.writeSync(fd, `\n===== ${new Date().toISOString()} starting: ${cmd} ${args.join(" ")}\n`);
  const child = spawn(cmd, args, {
    cwd,
    env,
    detached: true,
    windowsHide: true,
    stdio: ["ignore", fd, fd],
  });
  child.unref();
  fs.closeSync(fd);
  return child;
}

// psql helpers --------------------------------------------------------------

export const PG_ENV = { PGCLIENTENCODING: "UTF8", PGCONNECT_TIMEOUT: "5" };

export function psqlArgs(db = "postgres", user = "postgres") {
  return [
    "-X",
    "-h",
    "127.0.0.1",
    "-p",
    String(PORTS.db),
    "-U",
    user,
    "-d",
    db,
    "-v",
    "ON_ERROR_STOP=1",
  ];
}

/** Run a SQL string through psql, returning trimmed unaligned output. Throws with stderr on error. */
export function sql(query, { db = "postgres", user = "postgres", quiet = true } = {}) {
  const args = [...psqlArgs(db, user), "-At", ...(quiet ? ["-q"] : []), "-c", query];
  const r = capture(pgTool("psql"), args, { env: { ...process.env, ...PG_ENV } });
  if (r.status !== 0) throw new Error(`psql failed: ${(r.stderr || r.stdout || "").trim()}`);
  return (r.stdout || "").trim();
}

// ---------------------------------------------------------------- supabase/config.toml (small TOML subset)

function stripTomlComment(line) {
  let quote = null;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (quote) {
      if (c === "\\" && quote === '"') i++;
      else if (c === quote) quote = null;
    } else if (c === '"' || c === "'") quote = c;
    else if (c === "#") return line.slice(0, i);
  }
  return line;
}

function bracketsBalanced(text) {
  let depth = 0;
  let quote = null;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quote) {
      if (c === "\\" && quote === '"') i++;
      else if (c === quote) quote = null;
    } else if (c === '"' || c === "'") quote = c;
    else if (c === "[") depth++;
    else if (c === "]") depth--;
  }
  return depth <= 0;
}

function parseTomlValue(raw) {
  const v = raw.trim();
  if (v === "true" || v === "false") return v === "true";
  if (/^[+-]?\d+(\.\d+)?$/.test(v)) return Number(v);
  if (/^'.*'$/.test(v)) return v.slice(1, -1);
  try {
    return JSON.parse(v.startsWith("[") ? v.replace(/,\s*\]$/, "]") : v);
  } catch {
    return v;
  }
}

/**
 * Reads supabase/config.toml into { "<section.path>": { key: value } }, e.g.
 * cfg["auth.email.template.invite"].subject. Handles the subset the CLI config uses
 * (tables, strings, numbers, booleans, possibly multi-line arrays); returns {} if absent.
 */
export function readSupabaseConfig(configToml = P.configToml) {
  const out = {};
  let text;
  try {
    text = fs.readFileSync(configToml, "utf8");
  } catch {
    return out;
  }
  let section = "";
  let pending = null;
  for (const raw of text.split(/\r?\n/)) {
    const line = stripTomlComment(raw).trim();
    if (pending) {
      pending.buf += ` ${line}`;
      if (bracketsBalanced(pending.buf)) {
        out[section][pending.key] = parseTomlValue(pending.buf);
        pending = null;
      }
      continue;
    }
    if (!line) continue;
    const sec = /^\[([^[\]]+)\]$/.exec(line);
    if (sec) {
      section = sec[1]
        .split(".")
        .map((s) => s.trim().replace(/^"(.*)"$/, "$1"))
        .join(".");
      out[section] = out[section] || {};
      continue;
    }
    const kv = /^("[^"]+"|[A-Za-z0-9_-]+)\s*=\s*(.*)$/.exec(line);
    if (!kv) continue;
    const key = kv[1].replace(/^"(.*)"$/, "$1");
    out[section] = out[section] || {};
    if (kv[2].trim().startsWith("[") && !bracketsBalanced(kv[2])) pending = { key, buf: kv[2] };
    else out[section][key] = parseTomlValue(kv[2]);
  }
  return out;
}

/** [functions.<name>] tables of supabase/config.toml, keyed by function name. */
export function readFunctionsConfig(configToml = P.configToml) {
  const out = {};
  for (const [section, values] of Object.entries(readSupabaseConfig(configToml))) {
    if (section.startsWith("functions.")) out[section.slice("functions.".length)] = values;
  }
  return out;
}
