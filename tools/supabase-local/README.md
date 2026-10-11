# supabase-local — Supabase-compatible stack without Docker (Windows)

The standard way to run Supabase locally is `supabase start` (Supabase CLI + Docker). This
machine has no Docker/WSL, so this folder runs the **real** upstream services natively on
Windows instead, behind one gateway URL just like `supabase start`:

| Service                            | Port                 | Source                                                        |
| ---------------------------------- | -------------------- | ------------------------------------------------------------- |
| Gateway (Kong routes, CORS)        | 54321                | `gateway.mjs`                                                 |
| Postgres 18 (`postgres`, trust)    | 54322                | local PostgreSQL install, cluster in `.supabase-local/pgdata` |
| SMTP sink (GoTrue mail)            | 54325                | `smtp-sink.mjs` → `.supabase-local/mail/*.eml/.json`          |
| GoTrue / supabase/auth v2.197.0    | 54329                | built from source with a portable Go toolchain                |
| PostgREST v16.4                    | 54330 (+54332 admin) | official Windows binary                                       |
| storage-api v1.81.0 (file backend) | 54331                | built from source, runs on a portable Node 24                 |
| Edge functions (Deno 2.9.7)        | 54340+               | `functions-runner.mjs`, one Deno process per function         |

Versions match what the Supabase CLI pins (`supabase/gotrue:v2.197.0`, `postgrest:v16.4`,
`storage-api:v1.81.0`). Everything downloaded/built/generated lives in `.supabase-local/`
(gitignored): binaries, sources, Go/Node/Deno, data, logs, mail, JWT secret + keys.

## Usage

```sh
node tools/supabase-local/cli.mjs setup     # once: download + build everything (idempotent; ~7 min the first time)
node tools/supabase-local/cli.mjs start     # Postgres + all services, detached (~5 s warm); restarts missing ones
node tools/supabase-local/cli.mjs status    # health table (exit code 1 if anything is unhealthy)
node tools/supabase-local/cli.mjs env       # env lines for the Next.js app (.env.local)
node tools/supabase-local/cli.mjs migrate   # apply pending supabase/migrations/*.sql, then seed.sql once
node tools/supabase-local/cli.mjs reset     # fresh database: GoTrue/storage migrations + ours + seed (~11 s)
node tools/supabase-local/cli.mjs restart   # restart services (Postgres stays up)
node tools/supabase-local/cli.mjs stop      # stop everything, including Postgres
```

`setup` downloads into `.supabase-local/downloads` (sha256-checked for Go, Node, Deno,
PostgREST), so re-running it is cheap; it rebuilds a component only when its pinned version
or local patch changes. `SUPABASE_LOCAL_WORKDIR=<dir>` points the CLI at another project
directory containing `supabase/` (like the CLI's `--workdir`).

`env` prints `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
`SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_DB_URL`. Keys are generated once by `setup` (random
64-char HS256 secret, `anon`/`service_role` JWTs valid 10 years) and stored in
`.supabase-local/keys.json`, which also holds `sb_publishable_…`/`sb_secret_…` keys that the
gateway maps to those JWTs like hosted Supabase. Never copy them into tracked files.

Logs and PIDs: `.supabase-local/run/<service>.log|.json`; Postgres: `.supabase-local/postgres.log`.

### Migrations and seed

`migrate` applies every `supabase/migrations/<version>_<name>.sql` not yet in
`supabase_migrations.schema_migrations` (same table as the Supabase CLI), in filename order,
each in a single transaction (`psql --single-transaction`, `ON_ERROR_STOP=1`) as `postgres`.
A failing migration is rolled back and the psql error is printed. Then `supabase/seed.sql` is
applied once (tracked by hash in `supabase_migrations.seed_files`; `--seed` forces it,
`--no-seed` skips it). Finally `NOTIFY pgrst, 'reload schema'`, and `migrate` waits until
PostgREST reports the reload (admin `/metrics`), so tests can start immediately. Any other DDL
(e.g. from a test's `psql`) also triggers a reload via the image's `pgrst_ddl_watch` event
triggers, but asynchronously (~0.1–1 s): poll rather than assume it is instant.
Like the CLI, `migrate` never re-applies an edited migration; it warns
(`already-applied migration(s) changed on disk`) and `reset` rebuilds from scratch.

`reset` = stop services → `DROP DATABASE postgres WITH (FORCE)` (from `template1`) → drop
roles created by migrations → recreate → `bootstrap.sql` → GoTrue + storage-api run their
own migrations → `migrate` (+ seed) → start the rest. Uploaded files are wiped too.

### Edge functions

Every `supabase/functions/<name>/index.ts` (names starting with `_` or `.` are shared code)
is served at `http://localhost:54321/functions/v1/<name>` by its own `deno run --watch`
process (hot reload; new/deleted function folders are picked up within a second). Functions
written for the edge runtime (`Deno.serve(handler)`, also std `serve()`) run unchanged: a
generated wrapper binds them to their port. Inside, `new URL(req.url).pathname` is
`/<name>/...` as on Supabase. Env: `SUPABASE_URL`, `SUPABASE_ANON_KEY`,
`SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_DB_URL` (+ `SUPABASE_PUBLISHABLE_KEYS`/`SECRET_KEYS`) and
anything in `supabase/functions/.env`. A per-function `deno.json(c)` is used as config;
otherwise `supabase/functions/import_map.json` if present. `npm:`/`jsr:` deps are cached in
`.supabase-local/deno-dir`. Permissions: `--allow-net --allow-env --allow-read`.
JWT verification happens in the gateway (HS256, like the edge runtime) unless
`supabase/config.toml` has `[functions.<name>] verify_jwt = false`; a missing/invalid token gets
`401 {"code":401,"message":"Missing authorization header" | "Invalid JWT"}` before the function
runs. `OPTIONS` is never JWT-checked and, like every function response, passes through
untouched: **CORS is the function's job** (as on hosted Supabase), e.g. `_shared/http.ts`.
Query strings are forwarded. `ADMIN_SITE_URL` (= the GoTrue site URL, see below) is set for
functions; `supabase/functions/.env` can override it.
To serve another directory: `start --functions-dir <dir>` (or `SUPABASE_LOCAL_FUNCTIONS_DIR`);
e.g. `.supabase-local/test-functions` holds the throwaway `hello`/`whoami` functions used to
verify this setup. Function logs: `.supabase-local/run/functions.log` (prefixed `[name]`).

### Auth (GoTrue)

Signups are disabled (`GOTRUE_DISABLE_SIGNUP=true`): create users with the admin API
(`supabase.auth.admin.createUser({ email, password, email_confirm: true })` or
`POST /auth/v1/invite`, service role key). TOTP MFA on, very high rate limits.

**Site URL**: `http://localhost:3100` by default; set `BSR_SITE_URL` when running
`start`/`restart`/`reset` to change it (e.g. `BSR_SITE_URL=http://localhost:3000 node
tools/supabase-local/cli.mjs restart`; not persisted, so set it on every start). Redirect
allow-list: `<site>/**`, `http://localhost:3100/**`, `http://localhost:3000/**` (+127.0.0.1) and
`[auth] additional_redirect_urls`; `SUPABASE_LOCAL_REDIRECT_URLS` replaces it entirely.

**Mirrored from `supabase/config.toml`** (as `supabase start` does): `[auth.email.template.<type>]`
`subject` → `GOTRUE_MAILER_SUBJECTS_<TYPE>` and `content_path` (must be a file directly in
`supabase/templates/`) → `GOTRUE_MAILER_TEMPLATES_<TYPE>=http://127.0.0.1:54321/__templates/<file>`
(the gateway serves that folder read-only; GoTrue re-fetches every ~10 s, so template edits
show up without a restart); `[auth]` `jwt_expiry`, `enable_signup`, `enable_anonymous_sign_ins`,
refresh-token rotation/reuse interval, `minimum_password_length`, `password_requirements`;
`[auth.email]` `enable_confirmations`, `double_confirm_changes`, `secure_password_change`.
Not mirrored: `site_url` (see above), rate limits / `max_frequency` (kept generous for E2E) and
`[auth.email] enable_signup`. That last one is the _email provider_ switch
(`GOTRUE_EXTERNAL_EMAIL_ENABLED`): `false` disables password sign-in and `/recover` ("Email
logins are disabled") under `supabase start` / `config push`, so `start` prints a warning when it
is `false` and this stack keeps the provider on. Block registration with `[auth] enable_signup = false`.

Without custom templates, mail links point at `http://localhost:54321/auth/v1/verify?...`;
with the BSR templates they are `<site>/admin/auth/confirm?token_hash=...&type=recovery|invite&next=/admin/reset-password`.
Each mail is saved as
`.supabase-local/mail/<timestamp>-<n>.eml` plus a `.json` with `to`, `subject`, `text`,
`html` and the extracted `links`, e.g. in a Playwright test:

```ts
const files = fs
  .readdirSync(".supabase-local/mail")
  .filter((f) => f.endsWith(".json"))
  .sort();
const mail = JSON.parse(fs.readFileSync(`.supabase-local/mail/${files.at(-1)}`, "utf8"));
const link = mail.links.find((l: string) => l.includes("/admin/auth/confirm?token_hash="));
```

### Gateway behaviour (Kong equivalent)

`/auth/v1/*`, `/rest/v1/*`, `/storage/v1/*` are proxied with the prefix stripped,
`/functions/v1/<name>/*` to the function as `/<name>/*`, and `GET /__templates/<file>` serves
`supabase/templates/<file>` (plain .html/.txt names only; anything else is 404). `/auth/v1` (except the open
`verify`, `callback`, `authorize` routes) and `/rest/v1` require a known `apikey` header or
`?apikey=` (401 otherwise, as on hosted). Without an `Authorization` header the apikey becomes
`Authorization: Bearer <jwt>`. For auth/rest/storage, CORS preflights are answered by the gateway; responses get
`Access-Control-Allow-Origin: *` and expose `Content-Range`, `Content-Location`, `Location`.
Bodies are streamed (uploads, TUS resumable uploads at `/storage/v1/upload/resumable`).
Upstream keep-alive sockets idle >4 s are dropped and a reset reused socket is retried once
when the request is replayable. Realtime/GraphQL/Studio/pg-meta/imgproxy are not part of this stack.

## Local source patches (applied by `setup` to the downloaded checkouts only)

1. **supabase/auth** `cmd/serve_cmd.go`: the listener sets `SO_REUSEPORT` via
   `golang.org/x/sys/unix`, which does not compile for `GOOS=windows`. The import and the
   `SetsockoptInt` call are removed (plain listen). Built with `CGO_ENABLED=0`.
2. **supabase/storage** file backend stores object metadata (content-type, cache-control,
   etag) as xattrs through the native `fs-xattr` package (`os: !win32`). It is removed from
   `package.json`/`package-lock.json` and `src/storage/backend/file.ts` imports
   `./xattr-ads` instead — `patches/storage-xattr-ads.ts`, which stores the same attributes
   in NTFS alternate data streams. `npm ci --ignore-scripts`, then esbuild + resolve-tspaths
   (the upstream `tsc --noEmit` typecheck step is skipped). storage-api requires Node ≥ 24, so
   a portable Node 24 is kept in `.supabase-local/node` for it (the repo's Node is untouched).

No other changes: PostgREST and Deno are the official Windows binaries. storage-api runs with
`NODE_ENV` unset, as in the official image (`production` would force `https://` TUS URLs).

## Known Windows quirk handled by the CLI

PostgREST v16.4's Windows build exits with code 3 on roughly 1 in 7 starts, right after
opening its LISTEN connection (reproduced standalone; never with `db-channel-enabled=false`).
Once up it is stable, including across Postgres restarts. `start` therefore retries a service
that dies before becoming healthy (up to 8 attempts for PostgREST) and logs
`rest exited during startup (exit code 3); retrying`. If `status` ever shows a service
`stopped`, `start` brings back just the missing ones.

## Differences from `supabase start` / hosted (caveats)

- `postgres` is a real superuser here (the bootstrap superuser of an existing cluster cannot
  be demoted); on hosted it is a non-superuser with `BYPASSRLS`. RLS behaves the same for the
  API roles (`anon`, `authenticated`, `service_role`), which is what policies are tested with;
  just don't rely on `postgres` lacking privileges.
- Extensions only from a stock PostgreSQL 18 Windows install: `pgcrypto`, `uuid-ossp`,
  `pg_trgm`, `citext`, `unaccent`, … are available; `pg_net`, `pg_graphql`, `pgjwt`,
  `supabase_vault`, `pgsodium`, `pg_cron`, `postgis`, `vector` are not (so no database
  webhooks/`net.http_*`, no `/graphql/v1`). `safeupdate` is not preloaded for `authenticator`.
- Postgres 18 (hosted currently 15/17). `wal_level=replica`; no Realtime service.
- No imgproxy (image transformations off), no S3 protocol endpoint, no Studio/Inbucket UI.
- Storage object names containing `: * ? " < > |` cannot be stored by the Windows file backend.
- Functions run on stock Deno, not Supabase's edge-runtime: same `Deno.serve` API, but no
  per-request isolates, CPU/memory limits or `EdgeRuntime` features beyond a `waitUntil` stub.
- API roles are `INHERIT` (as in the current image after `20230529180330_alter_api_roles_for_inherit`).

## Files

- `cli.mjs` — commands above; `lib.mjs` — shared constants (versions, ports, paths), JWT helpers, config.toml reader
- `bootstrap.sql` — roles/schemas/grants of the supabase/postgres image (idempotent)
- `gateway.mjs`, `functions-runner.mjs`, `smtp-sink.mjs` — long-running services (Node built-ins)
- `patches/storage-xattr-ads.ts` — Windows shim copied into the storage-api checkout
