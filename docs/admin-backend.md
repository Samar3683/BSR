# Admin panel and PostgreSQL backend

The BSR operations panel lives at `/admin`. It is a separate product inside the same Next.js app.
The backend is **plain PostgreSQL**: tables, functions, triggers, row-level security and column
privileges live in the database, and the Next.js server is the only thing that talks to it. There is
no third-party backend service. The public site does not depend on any of it.

```text
Browser (/admin, React client components)
  │  same-origin calls only; the only credential is an httpOnly session cookie
  ▼
Next.js server (route handlers under /admin/api, src/admin/server)
  ├─ /admin/api/rest ........ table access (select / insert / update / delete), one parameterised statement
  ├─ /admin/api/rpc/<fn> .... calls a function of the public schema
  ├─ /admin/api/auth/* ...... login, logout, password reset request, password change
  ├─ /admin/api/admins/invite  invite an administrator (sends the email)
  ├─ /admin/api/files ....... private file upload / download
  ├─ src/proxy.ts ........... /admin only: redirects visitors without a valid session cookie
  └─ app/admin/(panel)/layout  checks the session row + active admin profile before rendering
  ▼
Prisma Client (src/server/db.ts, driver adapter @prisma/adapter-pg)
  ▼
PostgreSQL
  each request runs in a transaction as role `authenticated` with the user in request.jwt.claims,
  so RLS, column grants and auth.uid() apply to every statement
```

The server reaches the database only through Prisma Client (`db()` and `withIdentity()` in
`src/server/db.ts`). Sessions, login and one-time links use Prisma's models of the `auth` tables;
everything that runs as the signed-in user uses raw SQL inside `withIdentity()`, because the
request roles may only read some columns and Prisma's model queries read all of them. The one
exception is the live-update listener (`src/server/changes.ts`): `LISTEN` needs a dedicated
connection, so it uses `pg` directly.

## Where things are

| Path                             | Contents                                                                                                                                                                                                         |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `prisma/migrations/`             | SQL migrations applied by Prisma Migrate: bootstrap (request roles, `auth` and `storage` schemas, `auth.uid()`, extensions), schema, functions, triggers, RLS, storage, configuration seed, the application role |
| `prisma/schema.prisma`           | Prisma Client models, introspected from the migrated database (`npm run db:pull`)                                                                                                                                |
| `prisma.config.ts`               | Prisma CLI settings (migrations and introspection connect as `DATABASE_ADMIN_URL`)                                                                                                                               |
| `src/server/db.ts`               | Prisma Client, `withIdentity()` (request role + claims), database errors                                                                                                                                         |
| `compose.yaml`, `Dockerfile`     | Docker: PostgreSQL, mail sink, migrations job and the web app                                                                                                                                                    |
| `scripts/db/reset.mjs`           | Drops and recreates the local database, then applies every migration (`npm run db:reset`)                                                                                                                        |
| `src/app/admin/`                 | Pages (login, recovery, `auth/confirm`, `(panel)`) and the API (`api/rest`, `api/rpc`, `api/auth`, `api/admins`, `api/files`)                                                                                    |
| `src/admin/server/`              | Server only: query builder, passwords, sessions, auth actions, HTTP helpers                                                                                                                                      |
| `src/admin/`                     | The admin area: `lib/` (data client, field engine, dates, CSV, errors), `services/` (data access), `components/` (UI kit, fields, shell), `features/` (pages), `styles/admin.css`                                |
| `src/proxy.ts`                   | Request proxy, matcher `/admin/:path*` only                                                                                                                                                                      |
| `scripts/admin/create-admin.mjs` | Create the first administrator (writes to PostgreSQL, trusted machine)                                                                                                                                           |
| `docker/mail-sink/`              | The SMTP sink of the `mail` service: captures emails as files for development and tests                                                                                                                          |
| `tests/db/`, `tests/e2e-admin/`  | Database integration tests, admin end-to-end tests                                                                                                                                                               |

Isolation is enforced by ESLint (`eslint.config.mjs`): public code cannot import `@/admin/*`; admin
code cannot import the public site's features, components, providers, stores or the hero. Admin
styles are loaded only by `app/admin/layout.tsx`, and every rule is scoped under `.adm`. The admin
root sets `data-lenis-prevent`, so the public smooth scroll does not affect its scroll areas.

## Data model

| Table                                                 | Purpose                                                                                                                        |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `auth.users`, `auth.sessions`, `auth.one_time_tokens` | Logins (scrypt password hashes), server-side sessions (token hashes), emailed reset / invitation links                         |
| `admin_profiles`                                      | Who may use the panel: `user_id` → `auth.users`, `display_name`, `role` (`admin`), `active`                                    |
| `entity_configs`                                      | The four entities (`order`, `vehicle`, `driver`, `customer`): names, active flag, primary display field                        |
| `field_definitions`                                   | Dynamic fields: key, label, type, rules, default, visibility, search/filter/sort/report flags, relation target, system binding |
| `field_options`                                       | Options of select fields (records store option ids)                                                                            |
| `customers`, `drivers`, `vehicles`, `orders`          | System columns + `attributes jsonb` (dynamic values by `field_key`) + derived `display_name`                                   |
| `driver_vehicle_assignments`                          | Driver ↔ vehicle pairings over time                                                                                            |
| `order_assignments`                                   | Driver and/or vehicle reserved for an order's window                                                                           |
| `order_status_history`                                | Every status change with actor and note                                                                                        |
| `audit_logs`                                          | Append-only audit trail of every mutation                                                                                      |
| `storage.buckets`, `storage.objects`                  | Private files of image / file fields (bytes in `bytea`) with row-level security                                                |

Order-specific system columns: `order_number` (generated, `BSR-YYYY-NNNNN`), `customer_id`, `status`,
`pickup_at`, `delivery_at`. Drivers and vehicles have `available`. Every entity has `archived_at`,
`created_at/by` and `updated_at/by`, all of them set by the database.

### Migrations

`npm run db:migrate` (`prisma migrate deploy`) applies every folder of `prisma/migrations/` that
has not been applied yet, in order, each in one transaction, and records them in
`public._prisma_migrations` (no request role can read it). The migrations are plain SQL: Prisma
does not model row-level security, grants, functions or triggers, so the SQL is the definition of
the database and `prisma/schema.prisma` is read back from it.

To change the schema: add a folder `prisma/migrations/<timestamp>_<name>/migration.sql` (by hand,
or `npx prisma migrate dev --create-only` and review the SQL), apply it with `npm run db:migrate`,
then run `npm run db:pull` to refresh the models and the client. A migration that adds a function
the server calls as itself (outside a request role) grants it to `bsr_app` in the same file.

| File                               | Contents                                                                                 |
| ---------------------------------- | ---------------------------------------------------------------------------------------- |
| `…085900_bootstrap`                | Database defaults, request roles, `auth` and `storage` schemas, `auth.uid()`, extensions |
| `…090000_foundation`               | Extensions, `private` schema, `admin_profiles`, authorization helpers, `current_admin()` |
| `…090100_configuration`            | `field_type` enum, `entity_configs`, `field_definitions`, `field_options`                |
| `…090200_entities`                 | `order_status` enum, entity tables, indexes, order numbers                               |
| `…090300_dynamic_fields`           | Validation engine, definition / option guards, display names, field builder RPCs         |
| `…090400_dispatch`                 | Pairings, assignments (exclusion constraints), status workflow, dispatch RPCs            |
| `…090500_audit`                    | `audit_logs`, generic audit trigger, immutability                                        |
| `…090600_security`                 | Grants, column privileges, RLS policies, deletion guards                                 |
| `…090700_queries`                  | `list_records()`: configured search / filters / sorting                                  |
| `…090800_operations_reports`       | Dashboard, calendar, dispatch candidates, reports                                        |
| `…090900_storage`                  | Private bucket `entity-files` and its policies                                           |
| `…091000_seed_configuration`       | The four entities and starting fields/options (no records)                               |
| `…091100_admin_access_and_exports` | `list_admins()`, `create_admin_profile()`, `report_orders_export()`                      |
| `…20261012090000_admin_ux`         | Field sections, bulk actions, global search, dispatch requirements                       |
| `…20261012100000_auth_helpers`     | `auth.active_admin_user_id()` for password-reset requests                                |
| `…20261012110000_quote_requests`   | Quote requests and contact events from the public site (`intake` schema)                 |
| `…20261012120000_realtime_notify`  | `bsr_changes` notifications for live updates                                             |
| `…20261012130000_app_role`         | The `bsr_app` login role and its grants                                                  |

## Security model

- **Authentication.** Email and password, handled by the app. There is no registration endpoint;
  administrators are created by invitation (Settings → Administrators) or, for the first one, by
  `scripts/admin/create-admin.mjs`. Passwords are stored as salted scrypt hashes. They need at
  least 10 characters with lower- and uppercase letters and a digit. Sign-in errors never say
  whether the email or the password was wrong, and attempts are rate limited.
- **Sessions.** `bsr-admin-session`: an opaque random token, its expiry and an HMAC signature
  (`SESSION_SECRET`). The proxy verifies the signature without a database call; every page and
  API call checks that the session row still exists, and only a SHA-256 hash of the token is stored.
  httpOnly, SameSite=Lax, path `/admin` (public pages never receive it), Secure on https, 7 days.
  A password change signs every other session out. Links from email open a 30-minute session that
  may only set a password.
- **Cross-site requests.** State-changing API calls must come from this site (`Origin` check on
  top of SameSite).
- **Authorization lives in the database.** `private.is_active_admin()` is true only for a user with
  an active `admin` profile. Every table has RLS enabled. Administrators get policies on business
  and configuration tables. A signed-in user without an active profile sees only their own profile
  row. The anonymous role has no grants at all. The server connects as a limited login role
  (`bsr_app`) that can only `SET ROLE` into the request roles; each API call runs in a transaction
  as `authenticated` with `request.jwt.claims` set, so the same RLS and grants apply as for any
  database client.
- **Table access is not a free-form SQL channel.** `/admin/api/rest` accepts a structured request
  (table, filters, ordering, values), validates every identifier, always binds values as
  parameters and only touches the `public` schema; `/admin/api/rpc/<fn>` only calls functions of
  `public`. Unit tests cover the statement builder.
- **Column privileges.** Clients can write only business columns. IDs, stamps, display names, order
  numbers and statuses, and system-field bindings, are set by the database. Statuses change through
  `change_order_status()`. Assignments, pairings and history are written only by `SECURITY DEFINER`
  functions, which check the caller first. INSERT triggers check the caller too, because Postgres
  runs BEFORE triggers ahead of RLS `WITH CHECK`.
- **The audit log is append-only for everyone.** It has no write grants, no write policies, and
  triggers that reject UPDATE, DELETE and TRUNCATE.
- **Files.** Bucket `entity-files` is private. Only active administrators can upload, and only to
  `<entity>/<field_key>/<file>`. Nobody can overwrite or delete. Files are served by
  `/admin/api/files` to signed-in administrators with `nosniff`, and non-image types download.
  When a record references a file, the database re-checks its type and size.
- **Invitations.** `/admin/api/admins/invite` requires an active administrator; the profile is
  created through `create_admin_profile()` with the caller's identity, so the audit log names the
  inviting administrator. The email carries a one-time link (7 days).
- **Secrets.** Nothing secret reaches the browser: `DATABASE_URL`, `SESSION_SECRET` and `SMTP_URL`
  are read by the server only. A test checks that none of them appears in the built client bundle.
- Admin responses carry `Cache-Control: private, no-store` and `X-Robots-Tag: noindex`.

## Dynamic fields

Business fields are metadata: forms, record pages, list columns, search, filters, sorting, reports
and CSV exports are all built from `field_definitions` and `field_options`. Nothing in the UI hard
codes a business field or a dropdown value.

- **Types (19):** short text, long text, integer, decimal, currency, percentage, date, time, date &
  time, email, phone, URL, yes/no, single select, multi select, relation, address, image, file.
  `src/admin/lib/fields/registry.ts` lists what each type supports. A database test checks that it
  matches `private.field_type_supports()` and `private.validate_rules()`.
- **Keys are stable.** They are generated from the label when the field is created and never change
  after that, so labels can be edited freely. Keys are unique per entity; column names and a few
  words are reserved.
- **Validation runs twice.** The panel validates for immediate feedback (`lib/fields/validate.ts`).
  The database trigger `private.entity_before_write()` validates again against the stored
  definitions and never trusts client metadata. It covers unknown keys, archived, disabled,
  read-only and hidden fields, types, rules, required values, option and relation validity,
  file metadata and unique values (serialised with an advisory lock). Errors come back as
  `{field_key: message}`.
- **Patch semantics.** A write changes only the keys it sends, and a JSON `null` clears a value.
  Values of archived or disabled fields are preserved.
- **Lifecycle.**
  - **Disable** removes a field from forms and lists and keeps its data.
  - **Archive** retires it: values stay on records (shown read-only under "Values of retired
    fields") and in the audit history.
  - **Delete** is allowed only while no record holds a value.
  - **Type changes** are allowed only while no record holds a value, or between types that keep
    the data valid (short → long text, integer → decimal/currency, decimal ↔ currency).
- **Options.** Records store option ids. Options can be added, renamed, reordered, archived or
  restored. Archived options stay readable on existing records but cannot be chosen. Unused options
  can be deleted.
- **System fields** are bound to columns: order number (read-only), customer, pickup, delivery.
  They can be relabelled, reordered and shown or hidden, but never archived, retyped or deleted,
  because dispatch, the calendar and integrity rules depend on them.
- **Display names.** Each entity has a primary display field (Settings → Entities). The derived
  `display_name` is recomputed when that field, an option label or a related record changes.

## Dispatch

- **Pairings** (driver ↔ vehicle, open-ended or bounded) cannot overlap for the same driver or
  vehicle. They are suggested in the dispatch panel.
- **Order assignments** reserve a driver and/or a vehicle for the order's window (pickup →
  delivery). A driver or vehicle cannot be booked twice for overlapping time. `exclusion
constraints` on the effective period enforce this and are safe under concurrency. The RPCs check
  first so they can name the conflicting order.
- **Assigning** a driver _and_ a vehicle moves a confirmed order to _scheduled_. Reassigning an
  order that already started (in transit) releases the old assignment as of now, and the new one
  takes over from now, so both stay in the history.
- **Unassigning** keeps the released row (with its reason) and moves the order back to _confirmed_.
- **Cancelling** releases the assignment. **Delivered early** shortens it, which frees the rest of
  the window.
- **Window changes** move a live reservation with the order. They are refused if they would create
  a conflict.
- **Retiring resources.** Drivers and vehicles with current or upcoming work cannot be archived or
  marked unavailable.

Status workflow (`private.order_status_transition_allowed`):

| From       | To                                                         |
| ---------- | ---------------------------------------------------------- |
| draft      | confirmed, cancelled                                       |
| confirmed  | draft, scheduled (needs driver + vehicle), cancelled       |
| scheduled  | confirmed (releases the assignment), in transit, cancelled |
| in transit | scheduled, delivered, cancelled                            |
| delivered  | in transit (correction)                                    |
| cancelled  | confirmed (reopen)                                         |

## Calendar and reports

- **Calendar** (`calendar_events`). It shows orders whose planned window overlaps the visible range,
  with their current driver and vehicle. Views: month, week (grouped by driver or vehicle) and a
  two-week agenda. Filters: driver, vehicle, customer, cancelled. All days are Europe/Rome.
- **Reports** (`report_summary`, `report_field_breakdown`, `report_orders_export`).
  - **Dating.** An order is dated by its pickup day (or creation day when it has no pickup), in
    Europe/Rome. Archived orders count: archiving hides, it does not delete.
  - **Content.** Totals, status distribution, orders per day/week/month, and per-customer,
    per-driver and per-vehicle tables. Planned hours are the assignment periods inside the range;
    utilisation is those hours divided by the hours in the range.
  - **On time** means delivered (last change to _delivered_) no later than the planned delivery.
  - **Field breakdown.** Any reportable dynamic field: categories, numeric statistics or a monthly
    timeline.
  - **CSV** files are UTF-8 with a BOM and CRLF line ends. Cells that look like formulas are
    neutralised.

## Admin routes

| Route                                                                                   | Page                                              |
| --------------------------------------------------------------------------------------- | ------------------------------------------------- |
| `/admin/login`, `/admin/forgot-password`, `/admin/reset-password`                       | Sign-in and recovery (no sign-up)                 |
| `/admin/auth/confirm`                                                                   | Email-link handler (one-time token)               |
| `/admin`                                                                                | Dashboard                                         |
| `/admin/orders[/new                                                                     | /:id                                              | /:id/edit]` | Orders |
| `/admin/dispatch`                                                                       | Order queue + assignment, driver–vehicle pairings |
| `/admin/calendar`                                                                       | Calendar                                          |
| `/admin/vehicles`, `/admin/drivers`, `/admin/customers` (+ `/new`, `/:id`, `/:id/edit`) | Resources and customers                           |
| `/admin/reports`                                                                        | Reports and CSV exports                           |
| `/admin/audit`                                                                          | Audit log (read-only)                             |
| `/admin/settings/fields`, `/entities`, `/administrators`                                | Field builder, entity settings, administrators    |

## Environment variables

See `.env.example`. None of these is ever sent to a browser.

| Variable                | Where                                                       | Secret  |
| ----------------------- | ----------------------------------------------------------- | ------- |
| `DATABASE_URL`          | Web server: the limited application role                    | **yes** |
| `SESSION_SECRET`        | Web server: signs the session cookie (32+ chars)            | **yes** |
| `APP_URL`               | Web server: base URL of emailed links                       | no      |
| `SMTP_URL`, `MAIL_FROM` | Web server: reset and invitation emails                     | **yes** |
| `DATABASE_ADMIN_URL`    | Prisma CLI (`db:migrate`, `db:pull`), `admin:create`, tests | **yes** |

Without `DATABASE_URL` and `SESSION_SECRET` the panel shows "Backend not configured". The public
site is unaffected either way.

## Local development

Docker Desktop (or Docker Engine with Compose v2) runs PostgreSQL 17 and the mail sink; Node.js
runs the app as usual. `.env.local` holds the connection settings (see `.env.example`; the values
below are the defaults of `compose.yaml`):

```bash
DATABASE_URL=postgresql://bsr_app@localhost:54320/bsr
DATABASE_ADMIN_URL=postgresql://postgres@localhost:54320/bsr
SESSION_SECRET=<48 random bytes: node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))">
APP_URL=http://localhost:3000
SMTP_URL=smtp://127.0.0.1:54325
MAIL_FROM=BSR Trasporti <no-reply@bsr.test>
```

```bash
npm install          # also generates Prisma Client (postinstall)
npm run db:start     # PostgreSQL on 127.0.0.1:54320 + mail sink on 127.0.0.1:54325 (Docker)
npm run db:migrate   # apply prisma/migrations; npm run db:reset for a fresh database
npm run admin:create -- --email you@example.com --name "Your Name" --password '…'
npm run dev          # http://localhost:3000/admin
npm run db:status    # container health; npm run db:stop to stop them
```

The data lives in the Docker volume `bsr_pgdata` (`docker compose down -v` deletes it). Emails
(password reset, invitations) are captured as `.eml` / `.json` files in `.local/mail/` instead of
being sent. `npx prisma studio` browses the database as `DATABASE_ADMIN_URL`.

### The whole app in Docker

```bash
npm run docker:up    # builds the image, applies migrations, starts the app on 127.0.0.1:3000
npm run docker:down
```

The `app` profile of `compose.yaml` adds two services built from the `Dockerfile`: `migrate`
(runs `prisma migrate deploy` as the database owner, then exits) and `web` (the Next.js standalone
server, as the unprivileged `node` user). `web` reads `SESSION_SECRET`, `APP_URL`, `MAIL_FROM` and
`NOTIFY_EMAIL` from `.env.local`; its database and mail connections point at the other containers.
Stop `npm run dev` first or set `WEB_PORT` to another port.

## Deployment

1. Provision a PostgreSQL 15+ database (managed or self-hosted) and make sure the migration role can
   create schemas, roles and extensions (`pgcrypto`, `btree_gist`).
2. Apply the schema from a trusted machine or CI:
   `DATABASE_ADMIN_URL=postgresql://… npx prisma migrate deploy`. The last migration creates the
   application login role `bsr_app` (no password) and grants it what it needs; give it a password:
   `alter role bsr_app password '…'`.
3. Set `DATABASE_URL` (the application role), `SESSION_SECRET`, `APP_URL`, `SMTP_URL` and
   `MAIL_FROM` in the hosting environment and deploy the Next.js app (a Node.js host: the proxy and
   API routes use the Node runtime and a persistent connection pool). With Docker, build the
   `runner` target of the `Dockerfile` (and `migrate` for step 2) and pass these as environment
   variables; nothing secret is baked into the images.
4. Create the first administrator:
   `DATABASE_ADMIN_URL=… SMTP_URL=… APP_URL=https://<origin> npm run admin:create -- --email … --name … --invite`.
   Invite the others from Settings → Administrators.
5. Use TLS (`?sslmode=require` in the connection string) and run the application behind HTTPS so the
   session cookie is marked Secure. A reverse proxy in front of the app must pass the original host
   and scheme (`Host` or `X-Forwarded-Host`, and `X-Forwarded-Proto`): the cross-site check and the
   cookie's Secure flag use them (`src/server/request.ts`), because inside the Docker image Next.js
   only knows its listening address (`0.0.0.0:3000`).

`compose.yaml` is made for one machine: it publishes every port on 127.0.0.1 only and lets
PostgreSQL trust connections without a password. To run it on a server, set `POSTGRES_PASSWORD`
and `POSTGRES_HOST_AUTH_METHOD=scram-sha-256` before the first start, give `bsr_app` a password,
and pass the URLs with passwords as `CONTAINER_DATABASE_URL` and `CONTAINER_DATABASE_ADMIN_URL`;
replace the mail sink with a real SMTP server (`CONTAINER_SMTP_URL`).

## Tests

| Command                  | What                                                                                                                                                                                                                                                           |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm test`               | Unit tests: field validation, values, keys, dates/DST, CSV, errors, filters, the query builder, passwords and session cookies (plus the existing site tests)                                                                                                   |
| `npm run test:db`        | Database tests against the running PostgreSQL (`npm run db:start`, `npm run db:reset`): RLS, privileges, audit immutability, validation engine, field lifecycle, dispatch conflicts and workflow, reports (each test rolls back)                               |
| `npm run test:e2e:admin` | Admin E2E on a production build against the Docker database (reset first) and mail sink: auth and recovery by email, dynamic-field workflow, dispatch workflow, reports + CSV, audit, security (API, files, sessions), WCAG A/AA, responsive, public isolation |
| `npm run test:e2e`       | The public site's existing suite (unchanged)                                                                                                                                                                                                                   |
