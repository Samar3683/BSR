# Architecture

## Layers

```text
HTML / CSS (Server Components)   content, navigation, forms, CTAs — always available
        ▲
GSAP + ScrollTrigger (+ Lenis)   orchestration: the single authority for animated values
        ▼
WebGL (R3F, lazy, optional)      cinematic enhancement — never owns business content
        │
Zustand stores                   cross-system state (quality tier, canvas status, scene state)
        │
performance / accessibility      capability detection, quality tiers, motion preference
```

- **HTML owns content and conversion.** Essential copy, navigation and actions are semantic HTML.
  The canvas is `aria-hidden` and decorative.
- **WebGL is progressive enhancement.** `ExperienceLayer` renders nothing until capabilities are
  known. It also renders nothing on the `fallback` tier or after a failure (render error or context
  loss), and Three.js is loaded only when it will be used.
- **GSAP is the animation authority.** Import it only from `@/lib/animation/gsap`, which registers
  plugins and project eases once. ESLint enforces this. Each animated property has exactly one owner:
  never animate the same property with both CSS transitions and GSAP.

### Dependency direction

```text
app → features / experiences → components → hooks / stores → lib / config / constants / types
```

Lower layers never import higher ones. `no-restricted-imports` in `eslint.config.mjs` enforces
this. It also keeps the site independent of the hero: `features/**` and `components/**` may not
import `@/experiences/*`, `@/lib/three/*`, `three` or `@react-three/*` (`HERO_INDEPENDENCE`).

## Server / client boundary

Server Components are the default. `"use client"` is used only where browser APIs are needed:

- `providers/app-providers.tsx` is the single app-wide client boundary. Server-rendered children pass
  through it unchanged.
- `experiences/shared/canvas/*` holds WebGL, loaded with `next/dynamic` (`ssr: false`) from a client
  component.
- `hooks/*`, `components/feedback/error-boundary.tsx`.

Pages stay server-rendered composition layers.

## Motion

- Tokens: `--duration-*` and `--ease-*` in `styles/tokens.css`, mirrored in
  `lib/animation/motion-tokens.ts` (GSAP eases `bsr-standard`, `bsr-enter`, `bsr-exit`,
  `bsr-emphasized`). A unit test keeps the two in sync.
- Lenis runs on GSAP's ticker and drives `ScrollTrigger.update`, so smooth scroll and timelines share
  one frame. Touch scrolling is native. Hash links are handled by the browser. Nested scroll areas use
  `data-lenis-prevent`.
- Scroll flow: user scroll → Lenis → ScrollTrigger → experience timeline → DOM + Three.js.
- User control: a keyboard scroll key pressed while Lenis is interpolating a wheel gesture settles
  the animation, so the native keyboard scroll wins. An e2e test guards this.

### Frame-loop ownership

The GSAP ticker is the single `requestAnimationFrame` owner.

| Loop          | Driven by                                                              |
| ------------- | ---------------------------------------------------------------------- |
| GSAP          | its own ticker (the RAF owner)                                         |
| Lenis         | `gsap.ticker` (`autoRaf: false`)                                       |
| ScrollTrigger | Lenis `scroll` events                                                  |
| R3F           | `frameloop="demand"`: renders only when invalidated; no permanent loop |

When a scene needs continuous or scroll-synchronised rendering, it must not switch to
`frameloop="always"`. Use `frameloop="never"` and call R3F's `advance(time)` from `gsap.ticker`
while the scene is on screen, then remove the ticker callback when it leaves. DOM, scroll and
WebGL then share one clock and one frame, and idle pages don't render.

Never start an independent `requestAnimationFrame` loop in feature code.

## Reduced motion

A designed alternative, not a global kill switch:

- React: `useReducedMotion()`. It reports `true` until the preference is confirmed.
- Imperative code: `prefersReducedMotion()`, and `REDUCED_MOTION_QUERY` / `FULL_MOTION_QUERY` for
  `gsap.matchMedia()`.
- CSS: Tailwind `motion-safe:` / `motion-reduce:` variants.
- Lenis is never started under reduced motion.

## Performance and quality tiers

`high | medium | low | fallback` (`lib/performance/quality.ts`). Budgets per tier live in
`config/performance.ts`.

- `CapabilityDetector` reads coarse signals: hardware WebGL2, Save-Data, device memory and core
  count. No fingerprinting and no benchmarks.
- Software-rendered WebGL counts as unavailable.
- The initial tier is conservative and never `high`. Promotion needs runtime evidence, such as
  measured frame rate.
- The tier is published to `usePerformanceStore` and to `<html data-experience-quality>` for CSS.
- Mount `ExperienceLayer` only in experiences that actually render a scene. An empty canvas still
  costs a GPU context and the ~0.9 MB Three.js chunk.
- Layout breakpoints (`constants/breakpoints.ts`) are unrelated to device capability.

### Hero real-time quality

- **GPU class** (`classifyGpu` in `lib/performance/tier-decision.ts`) comes from the WebGL renderer
  name, probed on the high-performance GPU like the hero canvas: `minimal` (below the weakest
  supported GPU) gets stills from the start; `weak` (Intel HD/UHD/Iris class, reference Intel UHD 620) starts LOW at a reduced render scale; modern `integrated` GPUs start at MEDIUM at most.
- **Ladder** (`HERO_LADDER` in `config/hero-quality.ts`): HIGH → MEDIUM → LOW → LOW at three
  render-scale pixel budgets → stills. Each step is a settings change on the built world (no
  rebuild); the Canvas `dpr` prop holds the render scale (R3F re-applies that prop on every render,
  so an imperative `setDpr` does not stick).
- **Monitor** (`lib/performance/frame-monitor.ts`): sustained <20 fps steps one level down,
  sustained <15 fps goes straight to LOW (or one level at/below LOW), and only <15 fps on the last
  level hands over to stills. Windows are measured in rendered time from back-to-back frames only:
  on-demand rendering idles between scroll inputs, and those gaps are not frame times.
- **Readiness** behind the poster: first frame ≤100 ms, then two unmeasured warm-up frames, then a
  median ≤40 ms over six frames; a failure retries once, then steps down and tries again, unseen.
- **Warm-up**: shader variants for drawing into render targets (wet-floor reflection, bloom main
  pass) compile with the on-screen ones before the handoff; the road world's lighting, buildings
  and textures are prepared in idle time after it, so the dock → road switch compiles and uploads
  nothing.
- **Draw calls**: `batchStatic` (`lib/three/static-batch.ts`) merges static meshes per material,
  folding colour/roughness/metalness/emissive differences into vertex attributes (same shading);
  moving parts (truck, forklift wheels) are rigidly skinned to their nodes. Pooled road buildings
  are instanced per type. Measure with `node scripts/bench-hero.mjs` (real GPU, per checkpoint).

## State

One small store per concern. `performance-store` holds capability and tier. `experience-store`
holds canvas status and, later, scene state. Local UI state stays in components. Render loops read
stores with `getState()` instead of subscribing every frame.

## Home hero (Phase 1 foundation; Phase 2B visual production in progress)

Status: the engineering foundation is complete. In Phase 2B, the dock camera, layout and light
system are matched to Styleframes 01/02, and the production asset pipeline is in place. The truck,
trailer, dock kit, textures, backdrops, stills and clips are still **development placeholders**.
The production truck and the BSR logo are missing, which blocks Gates 1–2. See
[hero-phase-2b-audit.md](hero-phase-2b-audit.md) and [hero-asset-pipeline.md](hero-asset-pipeline.md).

### Structure

| Layer                             | Location                                                                     | Notes                                                                                                                                                                                 |
| --------------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Semantic shell (Server Component) | `experiences/home/components/hero-section.tsx`                               | H1, copy, quote and WhatsApp links, poster. Works without JavaScript.                                                                                                                 |
| Layout geometry                   | `hero.module.css`                                                            | Sticky stage, sticky copy and the state 5 line. Height depends only on layout (CSS), never on the rendering path.                                                                     |
| Client island                     | `hero-cinematic.tsx`                                                         | One unpinned ScrollTrigger feeds the progress controller. Decides the rendering path and tier, mounts the ladder, media or real-time layers, and fades the copy during the departure. |
| Still ladder / poster             | `hero-still-ladder.tsx`, `hero-picture.tsx`                                  | S1–S4 art-directed `<picture>`s. S1 is the poster (LCP).                                                                                                                              |
| Phone media                       | `hero-media-player.tsx` + `motion/hero-media-chapters.ts`                    | Clips triggered by chapter: never queued, played once, cancelled when skipped.                                                                                                        |
| Real-time                         | `hero-realtime.tsx` (lazy) → `scenes/` + `runtime/hero-runtime.ts`           | One canvas, `frameloop="never"`, driven by `scenes/hero-frame-driver.tsx` on the GSAP ticker.                                                                                         |
| Story                             | `motion/hero-timeline.ts`                                                    | The single master GSAP timeline (labels: clarity … route) writing plain values.                                                                                                       |
| Simulation                        | `motion/hero-simulation.ts`                                                  | Forward-only continuous motion: dock distance, speeds, wheels, springs.                                                                                                               |
| Story control                     | `motion/hero-story-control.ts`                                               | World switching (trailer wipe) and return mode, including occlusion gates.                                                                                                            |
| Camera                            | `config/hero-shots.ts`, `motion/hero-camera.ts`                              | Truck-relative shots, framing buckets, lens shift, return path.                                                                                                                       |
| Model contract                    | `scenes/truck-contract-spec.ts` (data), `scenes/truck-contract.ts` (binding) | Node names and material slots every truck/trailer asset must provide. The placeholder builds against it.                                                                              |
| World builder                     | `scenes/hero-world.ts`                                                       | Loads the tier's GLBs (`lib/three/gltf-loader.ts`: Meshopt + KTX2, no Draco) or builds placeholders; prepares materials per tier; enforces contract and hard budgets.                 |
| Light system                      | `scenes/hero-sky.ts`, `scenes/hero-environment.ts`                           | Sky dome on the light-story keyframes; image-based lighting generated from it (PMREM), regenerated only at quantised steps.                                                           |
| Budgets                           | `config/hero-budgets.ts`                                                     | Approved transfer and GPU budgets (data only; shared with the offline validator).                                                                                                     |
| Configuration                     | `config/hero-*.ts`                                                           | States, content (placeholder copy), assets (manifest and budgets), quality tiers and the step-down ladder, rig parameters.                                                            |

### Invariants (tested)

- **Forward-only truck.** The truck never drives backwards: dock distance and speeds only increase,
  and wheels never spin in reverse.
- **Covered re-base only.** The truck returns to the bay only while the trailer covers at least 92%
  of the frame (forward wipe, return re-base).
- **No mid-story takeover.** Real-time takes over only at H1 (progress ≤ 0.10) or H2 (the hold, after
  200 ms idle). Otherwise the still ladder continues.
- **Separate decisions.** Layout mode (CSS) and rendering path are decided independently. The phone
  media path needs every phone signal.
- **One of each.** One canvas, one hero ScrollTrigger, one frame driver, one master timeline.
- **Copy accessibility.** Faded hero copy stays in the accessibility tree, ignores the pointer, and
  keyboard focus brings it back.

### Asset pipeline

- `pnpm assets:validate-model <file.glb> --role tractor|trailer|dock --tier <tier>` checks the
  pipeline, the contract and the budgets offline. It uses `lib/three/glb-inspect.ts`, run with
  Node's type stripping.
- `pnpm assets:decoders` syncs the Basis transcoder into `public/assets/decoders/basis/`. A unit
  test fails on drift.
- `pnpm assets:capture-hero` captures the four checkpoints against their styleframes (with a test
  build running).
- The frame driver starts compiling only once the world is built and bound. A failed build or
  over-budget asset falls back to stills through the existing error boundary.

### Development tooling

In `next dev`, or in a test build made with `NEXT_PUBLIC_BSR_HERO_TEST_HOOKS=true`, the hero accepts
these URL overrides:

| Override                                        | Effect                                                                                                                                                           |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `?hero-debug`                                   | Shows the debug panel.                                                                                                                                           |
| `?hero-path=realtime\|media\|reduced\|fallback` | Forces a rendering path.                                                                                                                                         |
| `?hero-tier=high\|medium\|low`                  | Forces a quality tier.                                                                                                                                           |
| `?hero-allow-software`                          | Allows software WebGL, for continuous integration. Readiness limits are scaled and the step-down monitor is off (CPU rasterisation is not a performance signal). |
| `?hero-fail=assets`                             | Simulates an asset failure.                                                                                                                                      |
| `?hero-delay=<ms>`                              | Delays real-time loading, to simulate late readiness.                                                                                                            |

These builds also expose `window.__BSR_HERO__` for tests.

Each guard is an inline build-time expression, so normal production builds contain neither the
overrides, the hooks nor the debug chunk (this was verified on the built chunks).
`NEXT_PUBLIC_BSR_HERO_TEST_HOOKS` is always defined at build time in `next.config.ts`, so the guards
fold to constants.

### Styleframe checkpoints

`HERO_CHECKPOINTS` (opening 0.04, hold 0.39, road 0.72, route 0.97) define S1–S4, the styleframe
review positions, and the visual-test positions. Use the checkpoint buttons and "freeze sim" in the
debug panel for deterministic captures.

The checkpoint buttons dispatch a synthetic `ArrowDown` keydown before they jump. The smooth-scroll
provider handles that key by stopping an in-flight Lenis animation, which would otherwise keep
pulling the page back to its old target and override the jump. This is dev-only; production is
unchanged. `tests/e2e/hero.spec.ts` ("development tooling") fails without it.

### Initial JavaScript (accepted for Phase 1; re-measure after Phase 2)

Phase 2B re-measure (production build, 2026-09-25): the initial `/` HTML references
**245 261 bytes** of gzipped JavaScript. The real-time chunk, now with the glTF, KTX2 and Meshopt
loaders, is **305 922 bytes** gzipped (≈ 298.7 KiB): at the "≤ 300 KB" goal. It is still not
referenced by the initial HTML. Production assets are not in yet, so re-measure again when they land.

Phase 1 closeout:

On the Phase 1 closeout build, the `/` HTML references 245 051 bytes of JavaScript after gzip
(about 239 KiB). That is a few KB over the target, and the overage is accepted for now. The real-time
bundle (three, R3F, the scenes; about 251 KB after gzip) is in a separate chunk that the initial
HTML and the hero island chunk do not reference. It loads only through `next/dynamic`
(`ssr: false`) when the real-time path is selected. Re-measure after Phase 2 production assets and
scenes land.

## Site pages (below the hero)

The hero is locked (see [hero-baseline.md](hero-baseline.md)) and may later become pre-rendered
video. Everything else is built so that swap touches one line.

- **Route group.** `app/(site)/layout.tsx` adds the `SiteHeader` and `SiteFooter` around every
  public page (`/`, `/preventivo`). `/dev/design-system` stays outside the group.
- **Composition only in `app`.** `app/(site)/page.tsx` composes `<HeroSection />`, the route
  transition, the sections in the approved order, and the quick actions. Features never import
  each other's sections (shared copy such as the navigation labels is imported from `config/`).
- **Domain features.** Each chapter lives with its domain and keeps its copy in `config/`:

  | Section (anchor)                  | Feature                                                          |
  | --------------------------------- | ---------------------------------------------------------------- |
  | Hero → page, who BSR is (`bsr`)   | `features/home` (`RouteTransition`, `IdentitySection`)           |
  | Servizi (`servizi`)               | `features/services` (`ServiceStage`)                              |
  | Per chi lavoriamo (`settori`)     | `features/sectors`                                               |
  | Come funziona (`come-funziona`)   | `features/booking` (`ShipmentJourney`)                           |
  | Flotta (`flotta`)                 | `features/fleet` (`VehicleSelector`, technical schematics)       |
  | Copertura (`copertura`)           | `features/routes` (the supplied coverage map, sequenced)         |
  | Sicurezza del carico (`sicurezza`)| `features/trust` (`ProtectionSection`)                           |
  | Clienti (`clienti`)               | `features/trust` (`NetworkSection`; logos only when verified)    |
  | Recensioni (`recensioni`)         | `features/reviews` (an invitation until real testimonials exist) |
  | Chi siamo (`chi-siamo`)           | `features/about`                                                 |
  | Preventivo (`richiesta`)          | `features/booking` (`BookingSection` → `BookingFlow` quote starter) |
  | FAQ (`faq`)                       | `features/faq` (native `<details>` disclosures)                  |
  | Final CTA (`preventivo`)          | `features/contact` (`QuoteSection`)                              |
  | Header, menu, footer, quick       | `features/site` (`QuickActions`)                                 |

- **The request flow (no backend).** The home page's form is a plain GET to `/preventivo`
  (`partenza`, `destinazione`, `servizio`, `settore`); services, sectors, vehicles and coverage
  link there with `servizio` / `settore` / `mezzo` / `destinazione`. The page stays static:
  `QuoteComposerFromUrl` (client, inside a `Suspense` whose fallback is the empty composer, same
  layout) fills an editable composer; every edit rewrites the message preview, the WhatsApp and
  email links and the URL (`history.replaceState`: a reload keeps what was typed). Unknown values
  are dropped (`features/booking/lib/quote-draft.ts`, unit-tested). Nothing is sent by the site.

- **Server first.** Every section is a Server Component. The client code below the hero is small
  and self-contained: the header's scroll state (pure logic in `features/site/lib/header-state.ts`,
  unit-tested), the mobile menu (a native modal `<dialog>`), the journey's current step (one
  rAF-throttled scroll measurement, attached only while the block is near the screen), the vehicle selector (WAI-ARIA tabs, server-rendered; a `<noscript>` rule lists every type without JS), the quote starter (`BookingFlow`: route, service, sector; named errors, focus on the first missing field), the service stage (`ServiceStage`: the picture follows the service in play), the
  metric count-up (`CountUp`: final value server-rendered, counting copy written to its own text
  node), the quote page's URL draft, the sector preview (`SectorExplorer`), the header's section
  in view, the entry motion (`RevealController`: one IntersectionObserver for the page — see
  docs/design-system.md, "Motion") and the quick actions (IntersectionObservers; `inert` while
  hidden, stepping aside for any `data-conversion` section and the footer). None of it uses GSAP, so the
  hero's ScrollTrigger setup stays isolated.
- **Editorial components.** `components/editorial/`: `Chapter` (surface, rhythm, the chapter mark
  "04 / 12"), `Label` (mono label with a state mark), `RouteLine`, `ActionLink` / `ActionButton`
  (pill actions). Server components; every chapter below the hero is built from them and the
  `ed-*` utilities in `styles/editorial.css`.
- **No layout shift on hydration.** Anything that appears or collapses after the page becomes
  interactive must be rendered in its final state from the server (fleet tabs, closed form steps);
  the no-JavaScript fallback is a `<noscript>` style, not a different DOM.
- **No WebGL below the hero.** Richness comes from type, surfaces, SVG and the supplied
  photography. `site.spec.ts` fails on any canvas or video outside `[data-hero]`, and on any
  image outside it that is not from the live livery or the coverage map, lacks `alt` or is not
  lazy-loaded.
- **Media.** `tools/media/import-site-media.mjs` imports the whole supplied package
  (`assets/source/BSR-All-Images-WebP-SVG`): web-weight WebP at original pixel size (never
  upscaled) into `public/assets/images/content/`, a typed manifest with blur placeholders
  (`src/config/media-manifest.ts`, generated), the coverage map's route layer
  (`features/routes/graphics/coverage-network.ts`, generated), a derived dark geography and the
  social card (`src/app/opengraph-image.jpg`). Re-run it when the package changes.
  - Livery: `SITE_LIVERY` in `src/config/media.ts` (default `"final"`, the white BSR livery)
    switches every vehicle photograph at once to an alternative set (`custom-wrap`, `black`,
    `blue`, `green`, `red`). Only the livery the real fleet carries may go live.
  - `/dev/media` (developer preview, hidden in production like `/dev/design-system`) reviews
    every file: what is live and where, the livery sets side by side, the archive (superseded
    drafts, first renders, livery references — never on public pages) and the map variants.
  - Coverage map: the supplied map's dark geography (image) under its route layer (inline SVG,
    routes draw on entry); the light variant on `/preventivo`; the geography-only variant behind
    the not-found page.
- **Business facts.** Every fact — company, legal name, contacts, address, identifiers, transit
  times, the European routes, service / vehicle / sector names — is written once, in
  `config/site-content.ts`; `site-content.test.ts` fails if a phone number, email, PEC, VAT
  number, REA or address appears anywhere else in `src`. Each fact is justified in
  `docs/content-audit.md` (internal, never published): claim → source → status. Only VERIFIED
  claims reach the page.
- **SEO.** Root metadata (`app/layout.tsx`: `metadataBase` bsrtrasporti.com, Italian title and
  description, canonical, Open Graph, Twitter card; the image is `app/opengraph-image.jpg`), a
  title/description/canonical per page, `app/robots.ts` (`/dev/` disallowed), `app/sitemap.ts`,
  and LocalBusiness structured data from verified facts only (`features/seo`).
- **Legal.** `/privacy` (`features/legal`) restates the official site's published policy and the
  build's own facts (no cookies, no storage, no analytics); legal review and the hosting provider
  remain before launch.
- **Photographs.** One file, `config/site-media.ts`, places every photograph on the site (each
  once, tested); sections read their pictures from it through their content config.

## Design system

See [design-system.md](design-system.md). Tokens are CSS custom properties: primitives are in
`styles/tokens.css`, and semantic roles for each `data-surface` environment are in `styles/themes.css`.
The developer preview is at `/dev/design-system`.

## Assets

`public/assets/{images,video,models,textures,hdr,icons}/…`. Resolve paths through `assetUrl()` in
`config/assets.ts`. Names are lowercase kebab-case with an optional quality suffix:
`bsr-truck-high.glb`, `dock-blue-hour.avif`, `road-asphalt-normal.ktx2`. Models ship as optimised
GLB and textures as KTX2 where it helps. Raw Blender exports are never loaded directly.

## Testing

- **Vitest** covers pure logic, config, stores and token parity.
- **Playwright** runs against a production build on desktop and mobile Chromium. It covers document
  structure, the skip link, axe WCAG 2.2 A/AA, the no-WebGL fallback and motion preference.
  `site.spec.ts` covers the pages below the hero: landmarks and headings, anchors, header states,
  the mobile menu, no-JS rendering, axe with reveals in their final state, and the no-media rule.
- **Software-WebGL projects.** `hero-realtime.spec.ts` opts into software WebGL and runs in its own
  projects (`*-webgl`), in order, after the other projects. CPU rasterisation can saturate every
  core, so running it alongside the others made unrelated tests time out. These runs verify
  real-time logic (forward-only motion, coverage, handoff, fallbacks), not speed. Under
  `hero-allow-software`, readiness limits are scaled 12× and the step-down monitor is off.
- **Limits.** Automated accessibility checks are partial, so manual evaluation is still required.
  Headless Chromium uses a software GPU, so visual quality and performance need real hardware.

## Dependencies and environment

- **Runtime:** Node `^22.12.0 || ^24.0.0` (`.nvmrc`: 22). pnpm is pinned via `packageManager`.
  `engineStrict` in `pnpm-workspace.yaml` rejects installs on other Node versions.
- **Pinned exactly (framework-coupled):** `next`, `eslint-config-next`, `react` and `react-dom`
  (19.3.0). The React version matches the React 19.3 build that Next.js vendors for the App Router.
  It also matches the React range that `@react-three/fiber` supports (`>=19 <19.4`) and the scheduler
  R3F bundles. Upgrade Next.js and React together, and check R3F's React peer range first.
- **`tailwindcss` / `@tailwindcss/postcss`:** pinned to the same version, because they must move in
  lockstep.
- **`typescript` (`~5.9`):** `typescript-eslint` supports `<6.1`, so TypeScript 7 is excluded for
  now.
- **`three` (`^0.186`):** a caret on `0.x` locks the minor version, and each Three.js minor release
  can break things. Upgrade deliberately and keep `@types/three` in step.
- **Everything else:** caret ranges, resolved by the committed `pnpm-lock.yaml`. CI installs with
  `pnpm install --frozen-lockfile`.
- **ESLint 9:** stays on the 9.x line until Next.js's bundled plugins (`react`, `import`, `jsx-a11y`)
  declare ESLint 10 support.
- **Planned packages:** checked against the current set, and they resolve with no peer conflicts.
  Add them when a feature needs them: `@react-three/drei` ^10, `react-hook-form` ^7,
  `zod` ^4 and `@hookform/resolvers` ^5.
- **Dev server origin:** use `http://localhost:<port>`. The Next.js dev server only serves dev
  resources to its own origin, so `127.0.0.1` loads without hydrating. Add other hosts via
  `allowedDevOrigins`.
