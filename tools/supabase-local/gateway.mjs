// API gateway on :54321 mimicking the Kong routes of `supabase start`. Node built-ins only.
//
//   /auth/v1/*            -> GoTrue      (prefix stripped; verify/callback/authorize are "open")
//   /rest/v1/*            -> PostgREST   (prefix stripped)
//   /storage/v1/*         -> storage-api (prefix stripped)
//   /functions/v1/<fn>/*  -> Deno process of <fn> (path becomes /<fn>/*, like the edge runtime)
//   /__templates/<file>   -> supabase/templates/<file>, read-only (GoTrue fetches email templates here)
//
// Like the hosted API gateway: /auth/v1 and /rest/v1 require a known `apikey` (header or
// ?apikey=); when no Authorization header is sent (or it carries an `sb_` key) the apikey is
// mapped to `Authorization: Bearer <jwt>`. Functions verify the JWT unless config.toml has
// `[functions.<fn>] verify_jwt = false`. CORS for auth/rest/storage is answered here, as Kong's cors
// plugin does; for functions, OPTIONS and CORS headers pass through so the function owns CORS, as on hosted.
import fs from "node:fs";
import http from "node:http";
import path from "node:path";

import { P, PORTS, loadKeys, readJson, sleep, verifyJwt } from "./lib.mjs";

const keys = loadKeys();
const API_KEYS = new Map([
  [keys.anonKey, keys.anonKey],
  [keys.serviceRoleKey, keys.serviceRoleKey],
  [keys.publishableKey, keys.anonKey],
  [keys.secretKey, keys.serviceRoleKey],
]);

const CORS_ALLOW_HEADERS = [
  "authorization",
  "apikey",
  "x-client-info",
  "content-type",
  "prefer",
  "range",
  "accept",
  "accept-profile",
  "content-profile",
  "x-upsert",
  "cache-control",
  "x-supabase-api-version",
  "x-retry-count",
  "tus-resumable",
  "upload-length",
  "upload-metadata",
  "upload-offset",
  "upload-defer-length",
  "upload-concat",
  "x-http-method-override",
];
const CORS_METHODS = "GET,POST,PUT,PATCH,DELETE,OPTIONS,HEAD";
const CORS_EXPOSE = ["content-range", "content-location", "location", "x-supabase-api-version"];
const HOP_BY_HOP = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
]);

// Idle upstream sockets are dropped after 4s so we never reuse one the upstream already closed.
const agent = new http.Agent({ keepAlive: true, maxSockets: 256, timeout: 4000 });

function json(res, status, body, extraHeaders = {}) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(payload),
    "access-control-allow-origin": "*",
    ...extraHeaders,
  });
  res.end(payload);
}

function preflight(req, res) {
  const requested = req.headers["access-control-request-headers"];
  const allow = new Set(CORS_ALLOW_HEADERS);
  if (requested)
    for (const h of requested.split(",")) if (h.trim()) allow.add(h.trim().toLowerCase());
  res.writeHead(200, {
    "access-control-allow-origin": "*",
    "access-control-allow-methods": CORS_METHODS,
    "access-control-allow-headers": [...allow].join(", "),
    "access-control-max-age": "3600",
    "content-length": "0",
  });
  res.end();
}

// --------------------------------------------------------------- functions state (written by functions-runner)

let fnCache = { at: 0, state: null };
function functionsState() {
  if (Date.now() - fnCache.at > 300)
    fnCache = { at: Date.now(), state: readJson(P.functionsState) };
  return fnCache.state;
}

// --------------------------------------------------------------- routing

function route(pathname) {
  const m = /^\/(auth|rest|storage)\/v1(\/.*)?$/.exec(pathname);
  if (m) {
    const rest = m[2] || "/";
    const service = m[1];
    const open = service === "auth" && /^\/(verify|callback|authorize)(\/|$)/.test(rest);
    const port = { auth: PORTS.auth, rest: PORTS.rest, storage: PORTS.storage }[service];
    return { service, port, path: rest, prefix: `/${service}/v1`, open };
  }
  const f = /^\/functions\/v1\/([^/]+)(\/.*)?$/.exec(pathname);
  if (f)
    return {
      service: "functions",
      fn: decodeURIComponent(f[1]),
      path: `/${f[1]}${f[2] || ""}`,
      prefix: "/functions/v1",
    };
  return null;
}

function bearerFromApiKey(req, apikey) {
  const auth = req.headers.authorization;
  if (auth && !auth.startsWith("Bearer sb_")) return; // caller's own JWT wins
  const jwt = API_KEYS.get(apikey);
  if (jwt) req.headers.authorization = `Bearer ${jwt}`;
  else if (apikey && !auth) req.headers.authorization = `Bearer ${apikey}`;
}

// --------------------------------------------------------------- proxy

function hasNoBody(req) {
  return !req.headers["transfer-encoding"] && Number(req.headers["content-length"] || 0) === 0;
}

function forward(req, res, opts, attempt = 1) {
  const { port, path: upstreamPath, prefix, body, timeoutMs, cors = true } = opts;
  return new Promise((resolve, reject) => {
    const headers = {};
    for (const [k, v] of Object.entries(req.headers)) if (!HOP_BY_HOP.has(k)) headers[k] = v;
    headers.host = `127.0.0.1:${port}`;
    headers["x-forwarded-for"] = req.socket.remoteAddress?.replace(/^::ffff:/, "") || "127.0.0.1";
    headers["x-real-ip"] = headers["x-forwarded-for"];
    headers["x-forwarded-proto"] = "http";
    headers["x-forwarded-host"] = req.headers.host || `localhost:${PORTS.gateway}`;
    headers["x-forwarded-port"] = String(PORTS.gateway);
    headers["x-forwarded-prefix"] = prefix;
    if (body) headers["content-length"] = String(body.length);

    const up = http.request(
      { host: "127.0.0.1", port, method: req.method, path: upstreamPath, headers, agent },
      (upRes) => {
        const out = [];
        let expose = new Set(CORS_EXPOSE);
        const raw = upRes.rawHeaders;
        for (let i = 0; i < raw.length; i += 2) {
          const name = raw[i];
          const lower = name.toLowerCase();
          if (HOP_BY_HOP.has(lower)) continue;
          if (!cors) {
            out.push(name, raw[i + 1]);
            continue;
          }
          if (lower === "access-control-expose-headers") {
            for (const h of raw[i + 1].split(",")) if (h.trim()) expose.add(h.trim().toLowerCase());
            continue;
          }
          if (lower.startsWith("access-control-allow-")) continue; // replaced below, like Kong's cors plugin
          out.push(name, raw[i + 1]);
        }
        if (cors)
          out.push(
            "Access-Control-Allow-Origin",
            "*",
            "Access-Control-Expose-Headers",
            [...expose].join(", "),
          );
        res.writeHead(upRes.statusCode, upRes.statusMessage, out);
        upRes.pipe(res);
        upRes.on("end", resolve);
        upRes.on("error", reject);
      },
    );
    if (timeoutMs)
      up.setTimeout(timeoutMs, () =>
        up.destroy(Object.assign(new Error("upstream timeout"), { code: "ETIMEDOUT" })),
      );
    const replayable = body || hasNoBody(req);
    up.on("error", (err) => {
      // A pooled keep-alive socket can be closed by the upstream just as we reuse it: retry once.
      if (
        attempt === 1 &&
        up.reusedSocket &&
        replayable &&
        !res.headersSent &&
        ["ECONNRESET", "EPIPE"].includes(err.code)
      ) {
        forward(req, res, opts, 2).then(resolve, reject);
        return;
      }
      reject(err);
    });
    res.on("close", () => {
      if (!res.writableFinished) up.destroy();
    });
    if (body) up.end(body);
    else if (hasNoBody(req)) up.end();
    else req.pipe(up);
  });
}

async function readBody(req, limit = 50 * 1024 * 1024) {
  const chunks = [];
  let size = 0;
  for await (const c of req) {
    size += c.length;
    if (size > limit) throw Object.assign(new Error("payload too large"), { status: 413 });
    chunks.push(c);
  }
  return Buffer.concat(chunks);
}

async function handleFunction(req, res, r) {
  let state = functionsState();
  let fn = state?.functions?.[r.fn];
  if (!fn)
    return json(res, 404, { code: "NOT_FOUND", message: "Requested function was not found" });
  if (fn.verifyJwt !== false && req.method !== "OPTIONS") {
    const auth = req.headers.authorization;
    if (!auth) return json(res, 401, { code: 401, message: "Missing authorization header" });
    const token = auth.replace(/^Bearer\s+/i, "");
    if (!verifyJwt(token, keys.jwtSecret))
      return json(res, 401, { code: 401, message: "Invalid JWT" });
  }
  const apikey = req.headers.apikey;
  if (apikey && API_KEYS.has(apikey)) req.headers["sb-api-key"] = API_KEYS.get(apikey);
  const body = req.method === "GET" || req.method === "HEAD" ? null : await readBody(req);
  // The Deno process may be booting (first run downloads npm:/jsr: deps) or restarting after a
  // file change (--watch): retry connection refusals for up to 60s before giving up.
  const deadline = Date.now() + 60_000;
  for (;;) {
    try {
      const search = new URL(req.url, "http://localhost").search;
      return await forward(req, res, {
        port: fn.port,
        path: r.path + search,
        prefix: r.prefix,
        body,
        timeoutMs: 150_000,
        cors: false,
      });
    } catch (err) {
      if (err.code !== "ECONNREFUSED" || res.headersSent || Date.now() > deadline) throw err;
      await sleep(250);
      fnCache.at = 0;
      state = functionsState();
      fn = state?.functions?.[r.fn];
      if (!fn)
        return json(res, 404, { code: "NOT_FOUND", message: "Requested function was not found" });
    }
  }
}

const TEMPLATE_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".htm": "text/html; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
};

async function serveTemplate(req, res, encodedName) {
  if (req.method !== "GET" && req.method !== "HEAD")
    return json(res, 405, { message: "Method not allowed" });
  let name;
  try {
    name = decodeURIComponent(encodedName);
  } catch {
    return json(res, 400, { message: "Bad template name" });
  }
  // Plain file names only: no separators, no "..", nothing outside supabase/templates.
  const type = TEMPLATE_TYPES[path.extname(name).toLowerCase()];
  const file = path.resolve(P.templatesDir, name);
  if (
    !/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(name) ||
    name.includes("..") ||
    !type ||
    path.dirname(file) !== path.resolve(P.templatesDir)
  ) {
    return json(res, 404, { message: "Template not found" });
  }
  let content;
  try {
    content = await fs.promises.readFile(file);
  } catch {
    return json(res, 404, { message: "Template not found" });
  }
  res.writeHead(200, {
    "content-type": type,
    "content-length": content.length,
    "cache-control": "no-store",
  });
  res.end(req.method === "HEAD" ? undefined : content);
}

async function handle(req, res) {
  const url = new URL(req.url, "http://localhost");
  if (url.pathname === "/__supabase_local/health") return json(res, 200, { ok: true });
  if (url.pathname.startsWith("/__templates/"))
    return serveTemplate(req, res, url.pathname.slice("/__templates/".length));
  const r = route(url.pathname);
  if (!r) return json(res, 404, { message: "no Route matched with those values" });
  if (r.service === "functions") return handleFunction(req, res, r);

  // CORS preflight is answered by the gateway (Kong cors plugin, preflight_continue=false).
  if (
    req.method === "OPTIONS" &&
    (req.headers.origin || req.headers["access-control-request-method"])
  ) {
    return preflight(req, res);
  }

  const apikey = req.headers.apikey || url.searchParams.get("apikey") || undefined;
  if (!r.open && (r.service === "auth" || r.service === "rest")) {
    if (!apikey) {
      return json(res, 401, {
        message: "No API key found in request",
        hint: "No `apikey` request header or url param was found.",
      });
    }
    if (!API_KEYS.has(apikey)) {
      return json(res, 401, {
        message: "Invalid API key",
        hint: "Double check your Supabase `anon` or `service_role` API key.",
      });
    }
  }
  if (!r.open) bearerFromApiKey(req, apikey);
  return forward(req, res, { port: r.port, path: r.path + url.search, prefix: r.prefix });
}

function onRequest(req, res) {
  const t0 = Date.now();
  res.on("finish", () => {
    console.log(
      `${new Date().toISOString()} ${req.method} ${req.url.split("?")[0]} ${res.statusCode} ${Date.now() - t0}ms`,
    );
  });
  handle(req, res).catch((err) => {
    console.error(`${req.method} ${req.url}: ${err.code || ""} ${err.message}`);
    if (res.headersSent) return res.destroy();
    if (err.status === 413) return json(res, 413, { message: "Request body too large" });
    json(res, 502, { message: "An invalid response was received from the upstream server" });
  });
}

function listen(host) {
  const server = http.createServer(onRequest);
  server.requestTimeout = 0; // large uploads
  server.keepAliveTimeout = 65_000;
  server.on("upgrade", (_req, socket) => socket.destroy()); // no realtime in this stack
  server.on("error", (err) => {
    if (host === "::1" && (err.code === "EADDRNOTAVAIL" || err.code === "EAFNOSUPPORT")) return;
    console.error(`gateway listen ${host}:${PORTS.gateway} failed: ${err.message}`);
    process.exit(1);
  });
  server.listen(PORTS.gateway, host, () =>
    console.log(
      `gateway listening on http://${host.includes(":") ? `[${host}]` : host}:${PORTS.gateway}`,
    ),
  );
}

// Both loopbacks, so `localhost` works whichever address family a client resolves first.
listen("127.0.0.1");
listen("::1");

// Keep the functions state fresh even when idle (cheap; avoids stale reads after restarts).
fs.watchFile(P.functionsState, { interval: 1000 }, () => {
  fnCache.at = 0;
});
