#!/usr/bin/env node
// Docker-less, Supabase-compatible local stack for Windows (see README.md).
//
//   node tools/supabase-local/cli.mjs <setup|start|stop|restart|status|migrate|reset|env>
//
// Node built-ins only. Runtime artifacts live in .supabase-local/ (gitignored).
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

import {
  API_URL,
  ARTIFACTS,
  DB_URL,
  EXE,
  P,
  PG_ENV,
  PORTS,
  TOOLS_DIR,
  VERSIONS,
  capture,
  ensureDir,
  generateKeys,
  httpCheck,
  isPidAlive,
  killTree,
  loadKeys,
  pgTool,
  processImage,
  psqlArgs,
  readJson,
  readSupabaseConfig,
  run,
  sleep,
  spawnDetached,
  sql,
  tcpCheck,
  writeJson,
} from "./lib.mjs";

const SYSTEM_TAR = path.join(process.env.SystemRoot || "C:\\Windows", "System32", "tar.exe");
const AUTH_PATCH_ID = "win-no-reuseport-v1";
const STORAGE_PATCH_ID = "win-xattr-ads-v1";

// Roles that bootstrap.sql owns; `reset` drops every other non-system role (migrations recreate theirs).
const BOOTSTRAP_ROLES = [
  "postgres",
  "supabase_admin",
  "anon",
  "authenticated",
  "service_role",
  "authenticator",
  "supabase_auth_admin",
  "supabase_storage_admin",
  "supabase_functions_admin",
  "supabase_replication_admin",
  "supabase_read_only_user",
  "dashboard_user",
  "supabase_privileged_role",
];

function log(msg) {
  console.log(`[supabase-local] ${msg}`);
}

function withPath(env, ...dirs) {
  const out = { ...env };
  const key = Object.keys(out).find((k) => k.toUpperCase() === "PATH") || "PATH";
  out[key] = [...dirs, out[key] || ""].join(path.delimiter);
  return out;
}

function tail(file, lines = 30) {
  try {
    return fs.readFileSync(file, "utf8").split(/\r?\n/).slice(-lines).join("\n");
  } catch {
    return "(no log)";
  }
}

// =============================================================== setup

function sha256File(file) {
  return new Promise((resolve, reject) => {
    const h = crypto.createHash("sha256");
    fs.createReadStream(file)
      .on("data", (d) => h.update(d))
      .on("error", reject)
      .on("end", () => resolve(h.digest("hex")));
  });
}

async function download(art) {
  ensureDir(P.downloads);
  const dest = path.join(P.downloads, art.file);
  if (!fs.existsSync(dest)) {
    log(`downloading ${art.url}`);
    const res = await fetch(art.url, { redirect: "follow" });
    if (!res.ok || !res.body) throw new Error(`download failed: ${res.status} ${art.url}`);
    const tmp = `${dest}.part`;
    await pipeline(Readable.fromWeb(res.body), fs.createWriteStream(tmp));
    fs.renameSync(tmp, dest);
  }
  const hash = await sha256File(dest);
  if (art.sha256 && hash !== art.sha256) {
    fs.rmSync(dest, { force: true });
    throw new Error(
      `checksum mismatch for ${art.file}: got ${hash}, expected ${art.sha256} (file deleted, re-run setup)`,
    );
  }
  return dest;
}

function extract(archive, destDir) {
  ensureDir(destDir);
  // Windows' bsdtar handles both .zip and .tar.gz.
  run(SYSTEM_TAR, ["-xf", archive, "-C", destDir]);
}

function stampOk(file, value) {
  try {
    return fs.readFileSync(file, "utf8").trim() === value;
  } catch {
    return false;
  }
}

function findFile(dir, name) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isFile() && entry.name.toLowerCase() === name.toLowerCase()) return full;
    if (entry.isDirectory()) {
      const found = findFile(full, name);
      if (found) return found;
    }
  }
  return null;
}

async function setupBinaryFromZip(art, exeName, stampValue) {
  const dest = path.join(P.bin, exeName);
  const stampFile = dest.replace(/\.exe$/, ".stamp");
  if (fs.existsSync(dest) && stampOk(stampFile, stampValue)) {
    log(`${exeName} ${stampValue} present`);
    return;
  }
  const zip = await download(art);
  const tmp = path.join(P.downloads, `extract-${exeName}-${process.pid}`);
  fs.rmSync(tmp, { recursive: true, force: true });
  extract(zip, tmp);
  const found = findFile(tmp, exeName);
  if (!found) throw new Error(`${exeName} not found in ${art.file}`);
  fs.copyFileSync(found, dest);
  fs.rmSync(tmp, { recursive: true, force: true });
  fs.writeFileSync(stampFile, `${stampValue}\n`);
  log(`installed ${dest}`);
}

async function setupGo() {
  const versionFile = path.join(P.goRoot, "VERSION");
  if (
    fs.existsSync(EXE.go) &&
    fs.readFileSync(versionFile, "utf8").startsWith(`go${VERSIONS.go}`)
  ) {
    log(`Go ${VERSIONS.go} present`);
    return;
  }
  const zip = await download(ARTIFACTS.go);
  fs.rmSync(P.goRoot, { recursive: true, force: true });
  log("extracting Go toolchain");
  extract(zip, P.local); // archive root is go/
}

function goEnv() {
  return withPath(
    {
      ...process.env,
      GOROOT: P.goRoot,
      GOPATH: P.goPath,
      GOCACHE: P.goCache,
      GOMODCACHE: path.join(P.goPath, "pkg", "mod"),
      GOTOOLCHAIN: "local",
      CGO_ENABLED: "0",
      GOOS: "windows",
      GOARCH: "amd64",
    },
    path.join(P.goRoot, "bin"),
  );
}

// Local patch: cmd/serve_cmd.go sets SO_REUSEPORT through golang.org/x/sys/unix, which does
// not compile for GOOS=windows (and the option does not exist there). Listen without it.
function patchAuthSource() {
  const file = path.join(P.authSrc, "cmd", "serve_cmd.go");
  let src = fs.readFileSync(file, "utf8");
  if (src.includes("supabase-local:")) return;
  src = src.replace(/\r?\n\s*"golang\.org\/x\/sys\/unix"\r?\n/, "\n");
  src = src.replace(
    /serr = unix\.SetsockoptInt\(int\(fd\), unix\.SOL_SOCKET, unix\.SO_REUSEPORT, 1\)[^\r\n]*/,
    "_ = fd // supabase-local: SO_REUSEPORT is unix-only; plain listen on Windows",
  );
  if (src.includes("unix.SO_REUSEPORT") || src.includes('"golang.org/x/sys/unix"')) {
    throw new Error("auth Windows patch did not apply cleanly (upstream file changed?)");
  }
  fs.writeFileSync(file, src);
  log("patched auth cmd/serve_cmd.go (SO_REUSEPORT removed for Windows)");
}

async function setupAuth() {
  const stampFile = path.join(P.bin, "auth.stamp");
  const stamp = `${VERSIONS.auth}+${AUTH_PATCH_ID}`;
  if (
    fs.existsSync(EXE.auth) &&
    stampOk(stampFile, stamp) &&
    fs.existsSync(path.join(P.authSrc, "migrations"))
  ) {
    log(`auth.exe ${stamp} present`);
    return;
  }
  await setupGo();
  if (!fs.existsSync(path.join(P.authSrc, "go.mod"))) {
    const tgz = await download(ARTIFACTS.authSrc);
    extract(tgz, P.src); // archive root is auth-<version>/
  }
  patchAuthSource();
  log("building GoTrue (supabase/auth) with CGO_ENABLED=0 — first build downloads Go modules");
  run(
    EXE.go,
    [
      "build",
      "-buildvcs=false",
      "-trimpath",
      "-ldflags",
      `-X github.com/supabase/auth/internal/utilities.Version=${VERSIONS.auth}`,
      "-o",
      EXE.auth,
      ".",
    ],
    { cwd: P.authSrc, env: goEnv() },
  );
  fs.writeFileSync(stampFile, `${stamp}\n`);
  log(`built ${EXE.auth}`);
}

async function setupNode24() {
  if (fs.existsSync(EXE.node24)) {
    const v = capture(EXE.node24, ["--version"]).stdout.trim();
    if (v === `v${VERSIONS.node}`) {
      log(`Node ${v} (for storage-api) present`);
      return;
    }
  }
  const zip = await download(ARTIFACTS.node);
  const tmp = path.join(P.local, `node-extract-${process.pid}`);
  fs.rmSync(tmp, { recursive: true, force: true });
  fs.rmSync(P.node24, { recursive: true, force: true });
  log("extracting Node.js 24 (storage-api requires >= 24)");
  extract(zip, tmp);
  fs.renameSync(path.join(tmp, `node-v${VERSIONS.node}-win-x64`), P.node24);
  fs.rmSync(tmp, { recursive: true, force: true });
}

// Local patch: storage-api's file backend stores object metadata in xattrs via the native
// `fs-xattr` package (os: !win32). Drop the dependency and point file.ts at an NTFS
// alternate-data-stream shim with the same three functions (patches/storage-xattr-ads.ts).
function patchStorageSource() {
  const pkgFile = path.join(P.storageSrc, "package.json");
  const pkg = JSON.parse(fs.readFileSync(pkgFile, "utf8"));
  if (pkg.dependencies?.["fs-xattr"]) {
    delete pkg.dependencies["fs-xattr"];
    fs.writeFileSync(pkgFile, `${JSON.stringify(pkg, null, 2)}\n`);
  }
  const lockFile = path.join(P.storageSrc, "package-lock.json");
  const lock = JSON.parse(fs.readFileSync(lockFile, "utf8"));
  delete lock.packages["node_modules/fs-xattr"];
  if (lock.packages[""]?.dependencies) delete lock.packages[""].dependencies["fs-xattr"];
  fs.writeFileSync(lockFile, `${JSON.stringify(lock, null, 2)}\n`);

  const fileTs = path.join(P.storageSrc, "src", "storage", "backend", "file.ts");
  let src = fs.readFileSync(fileTs, "utf8");
  if (!src.includes("from './xattr-ads'")) {
    const patched = src.replace(
      "import * as xattr from 'fs-xattr'",
      "import * as xattr from './xattr-ads'",
    );
    if (patched === src)
      throw new Error("storage Windows patch did not apply (file.ts changed upstream?)");
    src = patched;
    fs.writeFileSync(fileTs, src);
  }
  fs.copyFileSync(
    path.join(TOOLS_DIR, "patches", "storage-xattr-ads.ts"),
    path.join(P.storageSrc, "src", "storage", "backend", "xattr-ads.ts"),
  );
  log("patched storage-api: fs-xattr -> NTFS alternate data streams");
}

async function setupStorage() {
  const stampFile = path.join(P.storageSrc, ".supabase-local-build");
  const stamp = `${VERSIONS.storage}+${STORAGE_PATCH_ID}`;
  if (
    stampOk(stampFile, stamp) &&
    fs.existsSync(path.join(P.storageSrc, "dist", "start", "server.js"))
  ) {
    log(`storage-api ${stamp} built`);
    return;
  }
  await setupNode24();
  const tgz = await download(ARTIFACTS.storageSrc);
  const tmp = path.join(P.src, `storage-extract-${process.pid}`);
  fs.rmSync(tmp, { recursive: true, force: true });
  fs.rmSync(P.storageSrc, { recursive: true, force: true });
  extract(tgz, tmp);
  fs.renameSync(path.join(tmp, `storage-${VERSIONS.storage}`), P.storageSrc);
  fs.rmSync(tmp, { recursive: true, force: true });
  patchStorageSource();

  const env = withPath({ ...process.env, NODE_ENV: "development" }, P.node24);
  log("npm ci (storage-api) — install scripts skipped; no native addons are needed with the shim");
  run(
    EXE.node24,
    [EXE.npm24, "ci", "--ignore-scripts", "--no-audit", "--no-fund", "--loglevel=error"],
    {
      cwd: P.storageSrc,
      env,
    },
  );
  log("building storage-api (esbuild + resolve-tspaths)");
  run(EXE.node24, ["build.js"], { cwd: P.storageSrc, env });
  const tspaths = readJson(
    path.join(P.storageSrc, "node_modules", "resolve-tspaths", "package.json"),
  );
  const tspathsBin = typeof tspaths.bin === "string" ? tspaths.bin : Object.values(tspaths.bin)[0];
  run(EXE.node24, [path.join(P.storageSrc, "node_modules", "resolve-tspaths", tspathsBin)], {
    cwd: P.storageSrc,
    env,
  });
  fs.writeFileSync(stampFile, `${stamp}\n`);
  log("storage-api built");
}

function ensureKeys() {
  if (fs.existsSync(P.keys)) {
    log("keys.json present");
    return loadKeys();
  }
  const keys = generateKeys();
  writeJson(P.keys, keys);
  log(`generated JWT secret + anon/service_role keys -> ${P.keys}`);
  return keys;
}

async function cmdSetup() {
  for (const d of [P.local, P.downloads, P.bin, P.src, P.run, P.mail, P.storageFiles, P.denoDir])
    ensureDir(d);
  const keys = ensureKeys();
  await setupBinaryFromZip(ARTIFACTS.postgrest, "postgrest.exe", VERSIONS.postgrest);
  await setupBinaryFromZip(ARTIFACTS.deno, "deno.exe", VERSIONS.deno);
  await setupAuth();
  await setupStorage();
  await ensurePostgres();
  applyBootstrap(keys);
  log("setup complete. Next: node tools/supabase-local/cli.mjs start");
}

// =============================================================== postgres

function pgRunning() {
  return capture(pgTool("pg_ctl"), ["status", "-D", P.pgdata]).status === 0;
}

async function ensurePostgres() {
  if (!fs.existsSync(path.join(P.pgdata, "PG_VERSION"))) {
    log(`initializing Postgres cluster in ${P.pgdata}`);
    run(pgTool("initdb"), [
      "-D",
      P.pgdata,
      "-U",
      "postgres",
      "-A",
      "trust",
      "-E",
      "UTF8",
      "--locale=C",
    ]);
    fs.appendFileSync(
      path.join(P.pgdata, "postgresql.conf"),
      `\nport = ${PORTS.db}\nlisten_addresses = 'localhost'\nmax_connections = 100\n`,
    );
  }
  if (!pgRunning()) {
    log("starting Postgres");
    ensureDir(P.run);
    const fd = fs.openSync(path.join(P.run, "pg_ctl.log"), "a");
    try {
      run(pgTool("pg_ctl"), ["-D", P.pgdata, "-l", P.pgLog, "-w", "-t", "60", "start"], {
        stdio: ["ignore", fd, fd],
      });
    } finally {
      fs.closeSync(fd);
    }
  }
  for (let i = 0; i < 60; i++) {
    if (await tcpCheck(PORTS.db)) return;
    await sleep(500);
  }
  throw new Error(`Postgres is not accepting connections on ${PORTS.db} (see ${P.pgLog})`);
}

function stopPostgres() {
  if (!pgRunning()) return;
  log("stopping Postgres");
  const r = capture(pgTool("pg_ctl"), ["-D", P.pgdata, "-m", "fast", "-w", "-t", "60", "stop"], {
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (r.status !== 0) throw new Error(`pg_ctl stop failed: ${r.stderr}`);
}

function applyBootstrap(keys, db = "postgres") {
  const r = capture(
    pgTool("psql"),
    [
      ...psqlArgs(db),
      "-q",
      "-v",
      `jwt_secret=${keys.jwtSecret}`,
      "-v",
      "jwt_exp=3600",
      "-f",
      P.bootstrapSql,
    ],
    { env: { ...process.env, ...PG_ENV } },
  );
  if (r.status !== 0) throw new Error(`bootstrap.sql failed:\n${r.stderr || r.stdout}`);
  log("bootstrap.sql applied");
}

// =============================================================== services

// GoTrue site URL (and ADMIN_SITE_URL for functions). Read at start/restart/reset time.
const SITE_URL = (
  process.env.BSR_SITE_URL ||
  process.env.SUPABASE_LOCAL_SITE_URL ||
  "http://localhost:3100"
).replace(/\/+$/, "");
const PASSWORD_REQUIREMENTS = {
  letters_digits: "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ:0123456789",
  lower_upper_letters_digits: "abcdefghijklmnopqrstuvwxyz:ABCDEFGHIJKLMNOPQRSTUVWXYZ:0123456789",
  lower_upper_letters_digits_symbols:
    "abcdefghijklmnopqrstuvwxyz:ABCDEFGHIJKLMNOPQRSTUVWXYZ:0123456789:!@#$%^&*()_+-=[]{};'\\\\:\"|<>?,./`~",
};

function redirectUrls(config) {
  if (process.env.SUPABASE_LOCAL_REDIRECT_URLS) return process.env.SUPABASE_LOCAL_REDIRECT_URLS;
  const urls = [
    `${SITE_URL}/**`,
    "http://localhost:3100/**",
    "http://localhost:3000/**",
    "http://127.0.0.1:3100/**",
    "http://127.0.0.1:3000/**",
    ...(config.auth?.additional_redirect_urls || []),
  ];
  return [...new Set(urls)].join(",");
}

/**
 * Mirrors what `supabase start` derives from supabase/config.toml for GoTrue: email templates
 * (served by the gateway at /__templates/<file>) + subjects, password policy, signup/anonymous
 * flags, JWT expiry, refresh-token and email-confirmation settings. Rate limits stay generous
 * for E2E runs, and the email provider stays enabled (see the warning in cmdStart).
 */
function authConfigEnv(config) {
  const env = {};
  const auth = config.auth || {};
  const email = config["auth.email"] || {};
  for (const [section, tpl] of Object.entries(config)) {
    const m = /^auth\.email\.(template|notification)\.([A-Za-z0-9_]+)$/.exec(section);
    if (!m) continue;
    const id = (m[1] === "notification" ? `${m[2]}_notification` : m[2]).toUpperCase();
    if (m[1] === "notification") {
      if (tpl.enabled !== true) continue;
      env[`GOTRUE_MAILER_NOTIFICATIONS_${m[2].toUpperCase()}_ENABLED`] = "true";
    }
    if (typeof tpl.subject === "string") env[`GOTRUE_MAILER_SUBJECTS_${id}`] = tpl.subject;
    if (typeof tpl.content_path === "string" && tpl.content_path) {
      const file = path.resolve(P.workdir, tpl.content_path);
      if (path.dirname(file) !== P.templatesDir || !fs.existsSync(file)) {
        log(
          `warning: ${section}.content_path must be a file directly in supabase/templates — skipped (${file})`,
        );
        continue;
      }
      env[`GOTRUE_MAILER_TEMPLATES_${id}`] =
        `http://127.0.0.1:${PORTS.gateway}/__templates/${encodeURIComponent(path.basename(file))}`;
    }
  }
  if (auth.jwt_expiry) env.GOTRUE_JWT_EXP = String(auth.jwt_expiry);
  if (auth.enable_signup === true) env.GOTRUE_DISABLE_SIGNUP = "false";
  if (typeof auth.enable_anonymous_sign_ins === "boolean") {
    env.GOTRUE_EXTERNAL_ANONYMOUS_USERS_ENABLED = String(auth.enable_anonymous_sign_ins);
  }
  if (typeof auth.enable_refresh_token_rotation === "boolean") {
    env.GOTRUE_SECURITY_REFRESH_TOKEN_ROTATION_ENABLED = String(auth.enable_refresh_token_rotation);
  }
  if (auth.refresh_token_reuse_interval !== undefined) {
    env.GOTRUE_SECURITY_REFRESH_TOKEN_REUSE_INTERVAL = String(auth.refresh_token_reuse_interval);
  }
  if (auth.minimum_password_length)
    env.GOTRUE_PASSWORD_MIN_LENGTH = String(auth.minimum_password_length);
  if (auth.password_requirements !== undefined) {
    env.GOTRUE_PASSWORD_REQUIRED_CHARACTERS =
      PASSWORD_REQUIREMENTS[auth.password_requirements] ?? "";
  }
  if (typeof email.enable_confirmations === "boolean")
    env.GOTRUE_MAILER_AUTOCONFIRM = String(!email.enable_confirmations);
  if (typeof email.double_confirm_changes === "boolean") {
    env.GOTRUE_MAILER_SECURE_EMAIL_CHANGE_ENABLED = String(email.double_confirm_changes);
  }
  if (typeof email.secure_password_change === "boolean") {
    env.GOTRUE_SECURITY_UPDATE_PASSWORD_REQUIRE_REAUTHENTICATION = String(
      email.secure_password_change,
    );
  }
  return env;
}

function authEnv(keys) {
  const external = `${API_URL}/auth/v1`;
  const verify = `${external}/verify`;
  const config = readSupabaseConfig();
  return {
    ...process.env,
    API_EXTERNAL_URL: external,
    GOTRUE_API_HOST: "127.0.0.1",
    GOTRUE_API_PORT: String(PORTS.auth),
    PORT: String(PORTS.auth),
    GOTRUE_DB_DRIVER: "postgres",
    GOTRUE_DB_DATABASE_URL: `postgres://supabase_auth_admin@127.0.0.1:${PORTS.db}/postgres?sslmode=disable`,
    GOTRUE_DB_NAMESPACE: "auth",
    GOTRUE_DB_MIGRATIONS_PATH: path.join(P.authSrc, "migrations"),
    GOTRUE_SITE_URL: SITE_URL,
    GOTRUE_URI_ALLOW_LIST: redirectUrls(config),
    GOTRUE_DISABLE_SIGNUP: "true", // no public registration; create users via the admin API
    GOTRUE_JWT_ADMIN_ROLES: "service_role",
    GOTRUE_JWT_AUD: "authenticated",
    GOTRUE_JWT_DEFAULT_GROUP_NAME: "authenticated",
    GOTRUE_JWT_EXP: "3600",
    GOTRUE_JWT_SECRET: keys.jwtSecret,
    GOTRUE_JWT_ISSUER: external,
    GOTRUE_EXTERNAL_EMAIL_ENABLED: "true",
    GOTRUE_EXTERNAL_PHONE_ENABLED: "false",
    GOTRUE_EXTERNAL_ANONYMOUS_USERS_ENABLED: "false",
    GOTRUE_MAILER_AUTOCONFIRM: "true",
    GOTRUE_MAILER_SECURE_EMAIL_CHANGE_ENABLED: "true",
    GOTRUE_MAILER_OTP_LENGTH: "6",
    GOTRUE_MAILER_OTP_EXP: "3600",
    GOTRUE_MAILER_URLPATHS_INVITE: verify,
    GOTRUE_MAILER_URLPATHS_CONFIRMATION: verify,
    GOTRUE_MAILER_URLPATHS_RECOVERY: verify,
    GOTRUE_MAILER_URLPATHS_EMAIL_CHANGE: verify,
    GOTRUE_SMTP_HOST: "127.0.0.1",
    GOTRUE_SMTP_PORT: String(PORTS.smtp),
    GOTRUE_SMTP_ADMIN_EMAIL: "admin@email.com",
    GOTRUE_SMTP_SENDER_NAME: "Admin",
    GOTRUE_SMTP_MAX_FREQUENCY: "1s",
    GOTRUE_PASSWORD_MIN_LENGTH: "6",
    GOTRUE_SECURITY_REFRESH_TOKEN_ROTATION_ENABLED: "true",
    GOTRUE_SECURITY_REFRESH_TOKEN_REUSE_INTERVAL: "10",
    GOTRUE_SECURITY_MANUAL_LINKING_ENABLED: "false",
    GOTRUE_SECURITY_UPDATE_PASSWORD_REQUIRE_REAUTHENTICATION: "false",
    GOTRUE_MFA_TOTP_ENROLL_ENABLED: "true",
    GOTRUE_MFA_TOTP_VERIFY_ENABLED: "true",
    GOTRUE_MFA_MAX_ENROLLED_FACTORS: "10",
    // Generous limits so E2E suites never trip them.
    GOTRUE_RATE_LIMIT_EMAIL_SENT: "360000",
    GOTRUE_RATE_LIMIT_SMS_SENT: "360000",
    GOTRUE_RATE_LIMIT_VERIFY: "100000",
    GOTRUE_RATE_LIMIT_TOKEN_REFRESH: "100000",
    GOTRUE_RATE_LIMIT_SSO: "100000",
    GOTRUE_RATE_LIMIT_ANONYMOUS_USERS: "100000",
    GOTRUE_RATE_LIMIT_OTP: "100000",
    GOTRUE_RATE_LIMIT_WEB3: "100000",
    GOTRUE_RATE_LIMIT_PASSKEY: "100000",
    // Templates are fetched from the gateway; re-fetch quickly so template edits show up.
    GOTRUE_MAILER_TEMPLATE_RELOADING_ENABLED: "true",
    GOTRUE_MAILER_TEMPLATE_MAX_AGE: "10s",
    GOTRUE_MAILER_TEMPLATE_RETRY_INTERVAL: "2s",
    GOTRUE_LOG_LEVEL: "info",
    ...authConfigEnv(config),
  };
}

function storageEnv(keys) {
  const base = { ...process.env };
  // Like the official image: NODE_ENV unset (=production would force https:// TUS upload URLs).
  for (const k of Object.keys(base)) if (k.toUpperCase() === "NODE_ENV") delete base[k];
  return withPath(
    {
      ...base,
      SERVER_HOST: "127.0.0.1",
      SERVER_PORT: String(PORTS.storage),
      SERVER_ADMIN_PORT: String(PORTS.storageAdmin),
      ANON_KEY: keys.anonKey,
      SERVICE_KEY: keys.serviceRoleKey,
      AUTH_JWT_SECRET: keys.jwtSecret,
      AUTH_JWT_ALGORITHM: "HS256",
      PGRST_JWT_SECRET: keys.jwtSecret,
      POSTGREST_URL: `http://127.0.0.1:${PORTS.rest}`,
      DATABASE_URL: `postgres://supabase_storage_admin@127.0.0.1:${PORTS.db}/postgres`,
      DB_INSTALL_ROLES: "false",
      STORAGE_BACKEND: "file",
      FILE_STORAGE_BACKEND_PATH: P.storageFiles,
      FILE_SIZE_LIMIT: "52428800",
      UPLOAD_FILE_SIZE_LIMIT: "52428800",
      UPLOAD_FILE_SIZE_LIMIT_STANDARD: "52428800",
      SIGNED_UPLOAD_URL_EXPIRATION_TIME: "7200",
      TENANT_ID: "stub",
      REGION: "local",
      STORAGE_S3_REGION: "local",
      GLOBAL_S3_BUCKET: "stub",
      STORAGE_S3_BUCKET: "stub",
      ENABLE_IMAGE_TRANSFORMATION: "false",
      IMAGE_TRANSFORMATION_ENABLED: "false",
      TUS_URL_PATH: "/storage/v1/upload/resumable",
      S3_PROTOCOL_ENABLED: "false",
      S3_PROTOCOL_PREFIX: "/storage/v1",
      LOG_LEVEL: "info",
    },
    P.node24,
  );
}

function restEnv(keys) {
  return {
    ...process.env,
    PGRST_DB_URI: `postgres://authenticator@127.0.0.1:${PORTS.db}/postgres`,
    PGRST_DB_SCHEMAS: "public,graphql_public",
    PGRST_DB_EXTRA_SEARCH_PATH: "public,extensions",
    PGRST_DB_ANON_ROLE: "anon",
    PGRST_DB_MAX_ROWS: "1000",
    PGRST_DB_CHANNEL_ENABLED: "true",
    PGRST_DB_CHANNEL: "pgrst",
    PGRST_JWT_SECRET: keys.jwtSecret,
    PGRST_SERVER_HOST: "127.0.0.1",
    PGRST_SERVER_PORT: String(PORTS.rest),
    PGRST_ADMIN_SERVER_HOST: "127.0.0.1",
    PGRST_ADMIN_SERVER_PORT: String(PORTS.restAdmin),
    PGRST_LOG_LEVEL: "warn",
  };
}

function serviceSpecs(keys, opts = {}) {
  const node = process.execPath;
  const functionsDir = path.resolve(
    opts.functionsDir || process.env.SUPABASE_LOCAL_FUNCTIONS_DIR || P.functionsDir,
  );
  const http200 = (url) => async () => (await httpCheck(url)) === 200;
  return [
    {
      name: "smtp",
      port: PORTS.smtp,
      cmd: node,
      args: [path.join(TOOLS_DIR, "smtp-sink.mjs")],
      env: process.env,
      image: "node.exe",
      health: () => tcpCheck(PORTS.smtp),
    },
    {
      name: "gateway",
      port: PORTS.gateway,
      cmd: node,
      args: [path.join(TOOLS_DIR, "gateway.mjs")],
      env: process.env,
      image: "node.exe",
      health: http200(`http://127.0.0.1:${PORTS.gateway}/__supabase_local/health`),
    },
    {
      name: "auth",
      port: PORTS.auth,
      cmd: EXE.auth,
      args: [],
      cwd: P.authSrc,
      env: authEnv(keys),
      image: "auth.exe",
      health: http200(`http://127.0.0.1:${PORTS.auth}/health`),
      timeoutMs: 180_000, // first start runs ~75 GoTrue migrations
    },
    {
      name: "storage",
      port: PORTS.storage,
      cmd: EXE.node24,
      args: [path.join("dist", "start", "server.js")],
      cwd: P.storageSrc,
      env: storageEnv(keys),
      image: "node.exe",
      health: http200(`http://127.0.0.1:${PORTS.storage}/status`),
      timeoutMs: 180_000,
    },
    {
      name: "rest",
      port: PORTS.rest,
      cmd: EXE.postgrest,
      args: [],
      env: restEnv(keys),
      image: "postgrest.exe",
      health: http200(`http://127.0.0.1:${PORTS.restAdmin}/ready`),
      startAttempts: 8, // ~15% of v16.4 Windows starts exit with code 3 (LISTEN channel race)
    },
    {
      name: "functions",
      port: null,
      cmd: node,
      args: [path.join(TOOLS_DIR, "functions-runner.mjs"), "--functions-dir", functionsDir],
      env: { ...process.env, ADMIN_SITE_URL: SITE_URL },
      image: "node.exe",
      health: async (pid) => readJson(P.functionsState)?.runnerPid === pid,
    },
  ];
}

// Gateway before GoTrue: it also serves the email templates GoTrue fetches.
const ALL_SERVICES = ["smtp", "gateway", "auth", "storage", "rest", "functions"];
const stateFile = (name) => path.join(P.run, `${name}.proc.json`); // pid bookkeeping (not run/functions.json)
const logFile = (name) => path.join(P.run, `${name}.log`);

function readState(name) {
  const st = readJson(stateFile(name));
  if (!st) return null;
  if (!isPidAlive(st.pid) || processImage(st.pid)?.toLowerCase() !== st.image.toLowerCase())
    return { ...st, alive: false };
  return { ...st, alive: true };
}

async function startServices(names, opts = {}) {
  const keys = loadKeys();
  for (const [exe, hint] of [
    [EXE.auth, "auth.exe"],
    [EXE.postgrest, "postgrest.exe"],
    [EXE.deno, "deno.exe"],
    [path.join(P.storageSrc, "dist", "start", "server.js"), "storage-api build"],
  ]) {
    if (!fs.existsSync(exe))
      throw new Error(`${hint} missing. Run: node tools/supabase-local/cli.mjs setup`);
  }
  ensureDir(P.run);
  await ensurePostgres();
  if (!opts.skipBootstrap) applyBootstrap(keys);
  for (const spec of serviceSpecs(keys, opts)) {
    if (!names.includes(spec.name)) continue;
    const st = readState(spec.name);
    if (st?.alive) {
      if (await spec.health(st.pid)) {
        log(`${spec.name} already running (pid ${st.pid})`);
        continue;
      }
      log(`${spec.name} (pid ${st.pid}) unhealthy — restarting`);
      killTree(st.pid);
      await sleep(500);
    }
    if (spec.port && (await tcpCheck(spec.port))) {
      throw new Error(`port ${spec.port} (${spec.name}) is already in use by another process`);
    }
    // PostgREST's Windows build sometimes exits (code 3) while its LISTEN connection starts up;
    // a process that dies before becoming healthy is therefore retried a few times.
    const maxAttempts = spec.startAttempts || 3;
    for (let attempt = 1; ; attempt++) {
      const child = spawnDetached(spec.cmd, spec.args, {
        cwd: spec.cwd || TOOLS_DIR,
        env: spec.env,
        logFile: logFile(spec.name),
      });
      const pid = child.pid;
      let exitCode;
      child.on("exit", (code, signal) => {
        exitCode = code ?? signal;
      });
      writeJson(stateFile(spec.name), {
        pid,
        image: spec.image,
        port: spec.port,
        startedAt: new Date().toISOString(),
      });
      const timeout = spec.timeoutMs || 60_000;
      const t0 = Date.now();
      let healthy = false;
      while (exitCode === undefined && isPidAlive(pid)) {
        if (await spec.health(pid)) {
          healthy = true;
          break;
        }
        if (Date.now() - t0 > timeout) {
          throw new Error(
            `${spec.name} not healthy after ${timeout / 1000}s. Last log lines:\n${tail(logFile(spec.name))}`,
          );
        }
        await sleep(400);
      }
      if (healthy) {
        log(
          `${spec.name} started (pid ${pid}${spec.port ? `, port ${spec.port}` : ""}) in ${((Date.now() - t0) / 1000).toFixed(1)}s`,
        );
        break;
      }
      fs.rmSync(stateFile(spec.name), { force: true });
      if (attempt >= maxAttempts) {
        throw new Error(
          `${spec.name} exited during startup (exit code ${exitCode ?? "?"}). Last log lines (${logFile(spec.name)}):\n${tail(logFile(spec.name))}`,
        );
      }
      log(
        `${spec.name} exited during startup (exit code ${exitCode ?? "?"}); retrying (${attempt}/${maxAttempts - 1})`,
      );
      await sleep(300);
    }
  }
}

async function stopServices(names = ALL_SERVICES) {
  for (const name of [...names].reverse()) {
    const st = readState(name);
    if (st?.alive) {
      killTree(st.pid);
      for (let i = 0; i < 20 && isPidAlive(st.pid); i++) await sleep(250);
      log(`${name} stopped (pid ${st.pid})`);
    }
    fs.rmSync(stateFile(name), { force: true });
  }
  if (names.includes("functions")) fs.rmSync(P.functionsState, { force: true });
}

function warnConfig() {
  const email = readSupabaseConfig()["auth.email"];
  if (email?.enable_signup === false) {
    log(
      "warning: supabase/config.toml [auth.email] enable_signup = false turns the whole email provider off under " +
        "`supabase start`/config push (GOTRUE_EXTERNAL_EMAIL_ENABLED=false: password sign-in and /recover fail with " +
        "'Email logins are disabled'). Use [auth] enable_signup = false to block registration. This stack keeps email on.",
    );
  }
}

async function cmdStart(opts) {
  warnConfig();
  await startServices(ALL_SERVICES, opts);
  log(`stack ready: API ${API_URL}  DB ${DB_URL}  site ${SITE_URL}`);
  log("keys: node tools/supabase-local/cli.mjs env");
}

async function cmdStop() {
  await stopServices();
  stopPostgres();
  log("all services stopped");
}

async function cmdStatus() {
  let keys = null;
  try {
    keys = loadKeys();
  } catch {
    /* not set up */
  }
  const rows = [];
  const pgOk = pgRunning() && (await tcpCheck(PORTS.db));
  rows.push(["postgres", PORTS.db, "-", pgOk ? "healthy" : "stopped"]);
  const specs = keys ? serviceSpecs(keys) : [];
  for (const name of ALL_SERVICES) {
    const spec = specs.find((s) => s.name === name);
    const st = readState(name);
    let state = "stopped";
    if (st?.alive) state = spec && (await spec.health(st.pid)) ? "healthy" : "unhealthy";
    rows.push([name, spec?.port ?? "-", st?.alive ? st.pid : "-", state]);
  }
  const fns = readJson(P.functionsState);
  console.log("SERVICE    PORT   PID     STATE");
  for (const r of rows)
    console.log(
      `${String(r[0]).padEnd(10)} ${String(r[1]).padEnd(6)} ${String(r[2]).padEnd(7)} ${r[3]}`,
    );
  if (fns?.functions) {
    const list = Object.entries(fns.functions);
    console.log(
      `functions dir: ${fns.functionsDir} (${list.length} function${list.length === 1 ? "" : "s"})`,
    );
    for (const [name, f] of list) {
      console.log(
        `  /functions/v1/${name} -> :${f.port} ${f.status}${f.verifyJwt ? "" : " (verify_jwt=false)"}`,
      );
    }
  }
  console.log(`API URL: ${API_URL}   DB URL: ${DB_URL}   mail: ${P.mail}`);
  return rows.every((r) => r[3] === "healthy");
}

// =============================================================== migrations

const lit = (s) => `'${String(s).replace(/'/g, "''")}'`;
const ident = (s) => `"${String(s).replace(/"/g, '""')}"`;
const psqlPath = (p) => `'${p.replace(/\\/g, "/").replace(/'/g, "''")}'`;

function dollarQuote(text) {
  let tag;
  do tag = `$m${crypto.randomBytes(4).toString("hex")}$`;
  while (text.includes(tag));
  return `${tag}${text}${tag}`;
}

function runSqlFileInTransaction(wrapperSql, label) {
  ensureDir(P.run);
  const wrapper = path.join(P.run, `apply-${process.pid}.sql`);
  fs.writeFileSync(wrapper, wrapperSql);
  try {
    const r = capture(
      pgTool("psql"),
      [...psqlArgs(), "--single-transaction", "-q", "-f", wrapper],
      {
        env: { ...process.env, ...PG_ENV },
      },
    );
    if (r.status !== 0) {
      const err = new Error(
        `${label} failed (rolled back):\n${(r.stderr || r.stdout || "").trim()}`,
      );
      err.migrationFailure = true;
      throw err;
    }
    if (r.stderr?.trim()) process.stderr.write(r.stderr);
  } finally {
    fs.rmSync(wrapper, { force: true });
  }
}

async function cmdMigrate(opts = {}) {
  await ensurePostgres();
  const ready = sql(
    "select (to_regclass('auth.users') is not null and to_regclass('storage.objects') is not null)::text",
  );
  if (ready !== "true") {
    throw new Error(
      "auth/storage schemas are not migrated yet — run `start` first (GoTrue and storage-api create them)",
    );
  }
  sql(`create schema if not exists supabase_migrations;
create table if not exists supabase_migrations.schema_migrations (version text not null primary key);
alter table supabase_migrations.schema_migrations add column if not exists statements text[];
alter table supabase_migrations.schema_migrations add column if not exists name text;
create table if not exists supabase_migrations.seed_files (path text not null primary key, hash text not null);`);

  const applied = new Set(
    sql("select version from supabase_migrations.schema_migrations").split(/\r?\n/).filter(Boolean),
  );
  // Applied migrations whose file content changed since (only `reset` re-applies those).
  const appliedHashes = new Map(
    sql(
      "select version || ' ' || coalesce(md5(statements[1]), '') from supabase_migrations.schema_migrations where array_length(statements, 1) = 1",
    )
      .split(/\r?\n/)
      .filter(Boolean)
      .map((l) => l.split(" ")),
  );
  const edited = [];
  const files = fs.existsSync(P.migrationsDir)
    ? fs
        .readdirSync(P.migrationsDir)
        .filter((f) => f.toLowerCase().endsWith(".sql"))
        .sort()
    : [];
  let count = 0;
  for (const file of files) {
    const m = /^([0-9]+)_(.*)\.sql$/i.exec(file);
    if (!m) {
      log(`skipping ${file}: name must match <timestamp>_name.sql`);
      continue;
    }
    const [, version, name] = m;
    const full = path.join(P.migrationsDir, file);
    const content = fs.readFileSync(full, "utf8");
    if (applied.has(version)) {
      const stored = appliedHashes.get(version);
      const md5 = (t) => crypto.createHash("md5").update(t).digest("hex");
      if (stored && stored !== md5(content) && stored !== md5(content.replace(/\r\n/g, "\n")))
        edited.push(file);
      continue;
    }
    log(`applying migration ${file}`);
    runSqlFileInTransaction(
      `\\set ON_ERROR_STOP 1\n\\i ${psqlPath(full)}\n` +
        `insert into supabase_migrations.schema_migrations (version, name, statements) values (${lit(version)}, ${lit(name)}, array[${dollarQuote(content)}]);\n`,
      `migration ${file}`,
    );
    count++;
  }
  log(
    count
      ? `applied ${count} migration(s)`
      : `no pending migrations (${files.length} file(s) in supabase/migrations)`,
  );
  if (edited.length) {
    log(
      `warning: already-applied migration(s) changed on disk (not re-applied): ${edited.join(", ")} — run \`reset\` to rebuild`,
    );
  }

  if (opts.seed !== "no" && fs.existsSync(P.seedFile)) {
    const content = fs.readFileSync(P.seedFile, "utf8");
    const hash = crypto.createHash("sha256").update(content).digest("hex");
    const prev = sql(
      "select hash from supabase_migrations.seed_files where path = 'supabase/seed.sql'",
    );
    if (!prev || opts.seed === "force") {
      log("applying supabase/seed.sql");
      runSqlFileInTransaction(
        `\\set ON_ERROR_STOP 1\n\\i ${psqlPath(P.seedFile)}\n` +
          `insert into supabase_migrations.seed_files (path, hash) values ('supabase/seed.sql', ${lit(hash)}) on conflict (path) do update set hash = excluded.hash;\n`,
        "seed.sql",
      );
    } else if (prev !== hash) {
      log(
        "supabase/seed.sql changed since it was applied — run `reset` (or `migrate --seed`) to re-seed",
      );
    }
  }
  await reloadPostgrestSchema();
}

async function schemaCacheLoads() {
  try {
    const res = await fetch(`http://127.0.0.1:${PORTS.restAdmin}/metrics`, {
      signal: AbortSignal.timeout(2000),
    });
    const m = /pgrst_schema_cache_loads_total\{status="SUCCESS"\}\s+([\d.]+)/.exec(
      await res.text(),
    );
    return m ? Number(m[1]) : null;
  } catch {
    return null; // PostgREST not running: it loads a fresh cache when it starts
  }
}

/** NOTIFY pgrst and, if PostgREST is up, wait until it has actually reloaded (so tests can start right away). */
async function reloadPostgrestSchema() {
  const before = await schemaCacheLoads();
  sql("notify pgrst, 'reload schema'");
  if (before === null) return;
  // Wait for a reload after our NOTIFY, then until reloads settle (DDL in the migrations queued some too).
  let last = before;
  for (let i = 0; i < 50; i++) {
    await sleep(250);
    const now = await schemaCacheLoads();
    if (now === null) return;
    if (now > before && now === last) return;
    last = now;
  }
  log("warning: PostgREST did not report a schema cache reload within ~12s");
}

// =============================================================== reset

async function cmdReset(opts) {
  const keys = loadKeys();
  await stopServices();
  await ensurePostgres();
  log("recreating database `postgres`");
  sql("drop database if exists postgres with (force)", { db: "template1" });
  const extraRoles = sql("select rolname from pg_roles where rolname !~ '^pg_' order by 1", {
    db: "template1",
  })
    .split(/\r?\n/)
    .filter((r) => r && !BOOTSTRAP_ROLES.includes(r));
  for (const role of extraRoles) {
    sql(`drop owned by ${ident(role)}; drop role ${ident(role)}`, { db: "template1" });
    log(`dropped role ${role} (created by migrations; they recreate it)`);
  }
  sql("create database postgres template template0", { db: "template1" });
  applyBootstrap(keys);
  fs.rmSync(P.storageFiles, { recursive: true, force: true });
  ensureDir(P.storageFiles);
  // GoTrue + storage-api run their own migrations; then ours; then the rest of the stack.
  await startServices(["smtp", "gateway", "auth", "storage"], { ...opts, skipBootstrap: true });
  await cmdMigrate(opts);
  await startServices(ALL_SERVICES, { ...opts, skipBootstrap: true });
  log("reset complete");
}

// =============================================================== env

function cmdEnv() {
  const keys = loadKeys();
  console.log(`NEXT_PUBLIC_SUPABASE_URL=${API_URL}`);
  console.log(`NEXT_PUBLIC_SUPABASE_ANON_KEY=${keys.anonKey}`);
  console.log(`SUPABASE_SERVICE_ROLE_KEY=${keys.serviceRoleKey}`);
  console.log(`SUPABASE_DB_URL=${DB_URL}`);
}

// =============================================================== main

function parseOpts(argv) {
  const opts = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--functions-dir") opts.functionsDir = argv[++i];
    else if (a.startsWith("--functions-dir="))
      opts.functionsDir = a.slice("--functions-dir=".length);
    else if (a === "--seed") opts.seed = "force";
    else if (a === "--no-seed") opts.seed = "no";
    else throw new Error(`unknown option ${a}`);
  }
  return opts;
}

const USAGE = `usage: node tools/supabase-local/cli.mjs <command> [options]

  setup     download/build GoTrue, PostgREST, storage-api, Deno (idempotent) + bootstrap DB
  start     start Postgres (if needed) and all services   [--functions-dir <dir>]
  stop      stop all services and Postgres
  restart   stop services (not Postgres) and start again  [--functions-dir <dir>]
  status    health of every service (exit 1 if any is not healthy)
  migrate   apply supabase/migrations/*.sql, then supabase/seed.sql once  [--seed | --no-seed]
  reset     recreate the database, re-run GoTrue/storage/our migrations + seed, restart services
  env       print env lines for the Next.js app`;

async function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  const opts = parseOpts(rest);
  switch (cmd) {
    case "setup":
      return cmdSetup();
    case "start":
      return cmdStart(opts);
    case "stop":
      return cmdStop();
    case "restart":
      await stopServices();
      return cmdStart(opts);
    case "status":
      if (!(await cmdStatus())) process.exitCode = 1;
      return;
    case "migrate":
      return cmdMigrate(opts);
    case "reset":
      return cmdReset(opts);
    case "env":
      return cmdEnv();
    default:
      console.log(USAGE);
      if (cmd && cmd !== "help" && cmd !== "--help") process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(`[supabase-local] ERROR: ${err.message}`);
  process.exit(1);
});
