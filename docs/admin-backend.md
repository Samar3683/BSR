# Admin panel and serverless backend

The BSR operations panel lives at `/admin`. It is a separate product inside the same Next.js app.
The backend is **Supabase**: Postgres with Row Level Security, Auth, Storage, and one Edge
Function. There is no application server of our own. The public site does not depend on any of
it.

```text
Browser (/admin, React client components)
  │  @supabase/ssr browser client: public URL + anon key, session cookie scoped to /admin
  ├─► Supabase Auth ......... password sign-in, recovery, invitations (no public sign-up)
  ├─► PostgREST (Data API) .. tables + RPCs, every row filtered by RLS
  ├─► Storage ............... private bucket entity-files, signed URLs only
  └─► Edge Function ......... admin-users (invite an administrator, needs the service role)
Next.js server (no data access of its own)
  ├─ src/proxy.ts ........... /admin only: refreshes the session cookie, redirects signed-out visitors
  └─ app/admin/(panel)/layout  verifies user + active admin profile before rendering the panel
```

## Where things are

| Path                                          | Contents                                                                                                                                                                               |
| --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `supabase/migrations/`                        | Schema, functions, triggers, RLS, storage, configuration seed (12 migrations)                                                                                                          |
| `supabase/functions/admin-users/`             | Edge Function (Deno) + unit-tested handler                                                                                                                                             |
| `supabase/config.toml`, `supabase/templates/` | Supabase CLI config; invite and recovery email templates                                                                                                                               |
| `src/app/admin/`                              | Routes: login, recovery, `auth/confirm` handler, `(panel)` pages                                                                                                                       |
| `src/admin/`                                  | The admin area: `lib/` (Supabase clients, field engine, dates, CSV, errors), `services/` (data access), `components/` (UI kit, fields, shell), `features/` (pages), `styles/admin.css` |
| `src/proxy.ts`                                | Request proxy, matcher `/admin/:path*` only                                                                                                                                            |
| `scripts/admin/create-admin.mjs`              | Create the first administrator (service role, trusted machine)                                                                                                                         |
| `tools/supabase-local/`                       | Docker-less local Supabase stack (Windows) — see its README                                                                                                                            |
| `tests/db/`, `tests/e2e-admin/`               | Database integration tests, admin end-to-end tests                                                                                                                                     |

Isolation is enforced by ESLint (`eslint.config.mjs`): public code cannot import `@/admin/*`; admin
code cannot import the public site's features, components, providers, stores or the hero. Admin
styles are loaded only by `app/admin/layout.tsx`, and every rule is scoped under `.adm`. The admin
root sets `data-lenis-prevent`, so the public smooth scroll does not affect its scroll areas.

## Data model

| Table                                        | Purpose                                                                                                                        |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `admin_profiles`                             | Who may use the panel: `user_id` → `auth.users`, `display_name`, `role` (`admin`), `active`                                    |
| `entity_configs`                             | The four entities (`order`, `vehicle`, `driver`, `customer`): names, active flag, primary display field                        |
| `field_definitions`                          | Dynamic fields: key, label, type, rules, default, visibility, search/filter/sort/report flags, relation target, system binding |
| `field_options`                              | Options of select fields (records store option ids)                                                                            |
| `customers`, `drivers`, `vehicles`, `orders` | System columns + `attributes jsonb` (dynamic values by `field_key`) + derived `display_name`                                   |
| `driver_vehicle_assignments`                 | Driver ↔ vehicle pairings over time                                                                                            |
| `order_assignments`                          | Driver and/or vehicle reserved for an order's window                                                                           |
| `order_status_history`                       | Every status change with actor and note                                                                                        |
| `audit_logs`                                 | Append-only audit trail of every mutation                                                                                      |

Order-specific system columns: `order_number` (generated, `BSR-YYYY-NNNNN`), `customer_id`, `status`,
`pickup_at`, `delivery_at`. Drivers and vehicles have `available`. Every entity has `archived_at`,
`created_at/by` and `updated_at/by`, all of them set by the database.

### Migrations

| File                               | Contents                                                                                 |
| ---------------------------------- | ---------------------------------------------------------------------------------------- |
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

## Security model

- **Authentication.** Supabase Auth, email and password. Public sign-up is disabled
  (`[auth] enable_signup = false`). Administrators are created by invitation (Settings →
  Administrators → `admin-users` function) or, for the first one, by `scripts/admin/create-admin.mjs`.
  Passwords: at least 10 characters with lower- and uppercase letters and a digit.
- **Authorization lives in the database.** `private.is_active_admin()` is true only for a user with
  an active `admin` profile. Every table has RLS enabled. Administrators get policies on business
  and configuration tables. A signed-in user without an active profile sees only their own profile
  row. Anonymous users have no grants at all.
- **Column privileges.** Clients can write only business columns. IDs, stamps, display names, order
  numbers and statuses, and system-field bindings, are set by the database. Statuses change through
  `change_order_status()`. Assignments, pairings and history are written only by `SECURITY DEFINER`
  functions, which check the caller first. INSERT triggers check the caller too, because Postgres
  runs BEFORE triggers ahead of RLS `WITH CHECK`.
- **The audit log is append-only for everyone.** It has no write grants (the service role
  included), no write policies, and triggers that reject UPDATE, DELETE and TRUNCATE.
- **Storage.** Bucket `entity-files` is private. Only active administrators can upload, and only to
  `<entity>/<field_key>/<file>`. Nobody can overwrite or delete through the API. Files are read
  through short-lived signed URLs. When a record references a file, the database re-checks its type
  and size from Storage's own metadata.
- **Edge Function.** `admin-users` validates the bearer token with Auth and requires an active
  admin profile (read with the caller's token, so RLS applies) before it uses the service role.
  The profile is created through `create_admin_profile()` with the caller's token, so the audit log
  names the inviting administrator.
- **Secrets.** The browser only receives `NEXT_PUBLIC_SUPABASE_URL` and the anon key. The
  service-role key is used only by the Edge Function (provided by Supabase), the bootstrap script
  and the test tooling. A test checks that it never appears in the built client bundle.
- **Session cookie.** `bsr-admin-auth`, path `/admin`, SameSite=Lax, Secure on https. Public pages
  never receive it. Admin responses carry `Cache-Control: private, no-store` and
  `X-Robots-Tag: noindex`.

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
| `/admin/auth/confirm`                                                                   | Email-link handler (token hash or PKCE code)      |
| `/admin`                                                                                | Dashboard                                         |
| `/admin/orders[/new                                                                     | /:id                                              | /:id/edit]` | Orders |
| `/admin/dispatch`                                                                       | Order queue + assignment, driver–vehicle pairings |
| `/admin/calendar`                                                                       | Calendar                                          |
| `/admin/vehicles`, `/admin/drivers`, `/admin/customers` (+ `/new`, `/:id`, `/:id/edit`) | Resources and customers                           |
| `/admin/reports`                                                                        | Reports and CSV exports                           |
| `/admin/audit`                                                                          | Audit log (read-only)                             |
| `/admin/settings/fields`, `/entities`, `/administrators`                                | Field builder, entity settings, administrators    |

## Environment variables

See `.env.example`.

| Variable                        | Where                                                              | Secret                |
| ------------------------------- | ------------------------------------------------------------------ | --------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | Next.js build/runtime                                              | no                    |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Next.js build/runtime                                              | no (public by design) |
| `SUPABASE_SERVICE_ROLE_KEY`     | bootstrap script, tests only (Edge Functions get it from Supabase) | **yes**               |
| `SUPABASE_DB_URL`               | database tests, CI migrations                                      | **yes**               |
| `ADMIN_SITE_URL`                | Edge Function secret: site origin for invitation links             | no                    |

Without the two public variables the panel shows "Backend not configured". The public site is
unaffected either way.

## Local development

On this Windows machine (no Docker):

```bash
pnpm supabase:local setup        # once (~7 min): builds/downloads Auth, PostgREST, Storage, Deno
pnpm supabase:local start        # Postgres + services behind http://localhost:54321
pnpm supabase:local env          # → copy into .env.local
pnpm supabase:local reset        # fresh database: all migrations + configuration seed
pnpm admin:create --email you@example.com --name "Your Name" --password '…'
pnpm dev                         # http://localhost:3000/admin
```

With Docker, `supabase start` then `supabase status` gives the same URL and keys, and
`supabase db reset` applies the migrations.

## Deployment

1. Create a Supabase project. In Auth → URL configuration, set the site URL to the public origin
   and add `https://<origin>/admin/auth/confirm` to the redirect URLs. Disable sign-ups, keep the
   email provider enabled, and configure SMTP for production email.
2. Set the email templates (Invite user, Reset password) to the contents of `supabase/templates/`,
   or run `supabase config push`.
3. Apply the schema: `supabase link --project-ref <ref>` and then `supabase db push`.
4. Deploy the function: `supabase functions deploy admin-users`, then
   `supabase secrets set ADMIN_SITE_URL=https://<origin>`.
5. Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in the hosting environment and
   redeploy the site.
6. From a trusted machine, run
   `SUPABASE_SERVICE_ROLE_KEY=… NEXT_PUBLIC_SUPABASE_URL=… pnpm admin:create --email … --name … --invite --site-url https://<origin>`
   to invite the first administrator. Invite the others from Settings → Administrators.

## Tests

| Command               | What                                                                                                                                                                                                                                                             |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm test`           | Unit tests: field validation, values, keys, dates/DST, CSV, errors, filters, Edge Function handler (plus the existing site tests)                                                                                                                                |
| `pnpm test:db`        | Database tests against a running Supabase: RLS, privileges, audit immutability, validation engine, field lifecycle, dispatch conflicts and workflow, reports (each test rolls back)                                                                              |
| `pnpm test:e2e:admin` | Admin E2E on a production build against the real local backend: auth and recovery by email, dynamic-field workflow, dispatch workflow, reports + CSV, audit, security (REST/Storage/Function), WCAG A/AA, responsive at 1440/1024/820/390, public-site isolation |
| `pnpm test:e2e`       | The public site's existing suite (unchanged)                                                                                                                                                                                                                     |
