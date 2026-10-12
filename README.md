# BSR — Web

Frontend for BSR, a freight transportation company operating in Italy: a cinematic, scroll-directed
logistics experience built on a conventional, accessible, conversion-focused website.

The public site is frontend only. The operations panel at `/admin` (orders, dispatch, calendar,
vehicles, drivers, customers, reports, audit log, configurable fields) runs on a
PostgreSQL backend — see [docs/admin-backend.md](docs/admin-backend.md). The public site does not
depend on it.

## Stack

| Concern         | Choice                                                        |
| --------------- | ------------------------------------------------------------- |
| Application     | Next.js 16 (App Router), React 19, TypeScript (strict)        |
| Styling         | Tailwind CSS v4, CSS custom-property design tokens, Archivo   |
| Icons           | Lucide (outline, via the `Icon` primitive)                    |
| Motion          | GSAP + ScrollTrigger (animation authority), Lenis (scrolling) |
| Real-time 3D    | Three.js via React Three Fiber                                |
| Shared state    | Zustand                                                       |
| Testing         | Vitest (units), Playwright + axe-core (browser, a11y)         |
| Package manager | pnpm (Node ≥ 22)                                              |
| Admin backend   | PostgreSQL (RLS, own auth/sessions, files) behind Next.js API |
| Admin data      | node-postgres (server only), TanStack Query                   |

Drei, React Hook Form, Zod and Radix are part of the planned stack. They get added when the first
feature needs them.

## Scripts

```bash
pnpm install
pnpm dev            # development server
pnpm build          # production build
pnpm start          # serve the production build

pnpm typecheck      # route type generation + tsc
pnpm lint           # ESLint (incl. architecture boundary rules)
pnpm format         # Prettier (with Tailwind class sorting)
pnpm test           # Vitest unit tests
pnpm test:e2e       # Playwright (builds and serves production; first run: pnpm exec playwright install chromium)
pnpm check          # typecheck + lint + format:check + unit tests
pnpm assets:hero-placeholders  # regenerate the hero DEVELOPMENT placeholder stills/clips
pnpm assets:decoders           # sync the self-hosted KTX2 (Basis) transcoder from three
pnpm assets:validate-model <file.glb> --role tractor|trailer|dock [--tier high|medium|low]
pnpm assets:capture-hero       # checkpoint captures vs styleframes (needs a running test build)

# Admin panel / backend (docs/admin-backend.md)
pnpm db:start                  # local PostgreSQL + mail sink (no Docker); pnpm db:reset for a fresh schema
pnpm test:db                   # database tests (RLS, triggers, dispatch, reports)
pnpm test:e2e:admin            # admin end-to-end tests against the real local PostgreSQL
pnpm admin:create --email … --name … --password …   # first administrator (writes to PostgreSQL)
```

## Structure

```text
src/
  app/            Routes, layouts, metadata. Composition only. app/admin = the panel's routes.
  admin/          The admin panel (isolated: own UI kit, styles, services, field engine).
  features/       Business domains (booking, services, routes, contact).
  experiences/    Cinematic layer: scenes, scene motion, 3D. home/ + shared/.
  components/     Reusable primitives: ui, forms, layout, motion, feedback, accessibility.
  providers/      The single client provider boundary (AppProviders).
  hooks/          Shared React hooks.
  stores/         Zustand stores, one per concern.
  lib/            Framework-agnostic infrastructure: animation, three,
                  performance, accessibility, validation, utils.
  config/         Project configuration (site, performance, scroll, assets).
  constants/      Stable values grouped by domain.
  styles/         Design tokens and document-level CSS.
  types/          Genuinely cross-domain types only.
public/assets/    Images, video, models, textures, hdr, icons.
tests/e2e/        Playwright specs.
docs/             Engineering documentation.
```

See [docs/design-system.md](docs/design-system.md) for the visual and interaction language (live preview
at `/dev/design-system` in development), and [docs/architecture.md](docs/architecture.md) for layering, the WebGL/motion architecture and
project rules.
