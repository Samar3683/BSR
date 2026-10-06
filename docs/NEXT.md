# Next

Where the project stands and what comes next. Update this file at the end of every phase.

## Where we are (1 October 2026)

**Phase 4 — content accuracy, business clarity, trust, conversion, production readiness: done.**

- Every business fact lives once in `src/config/site-content.ts` and is justified in
  `docs/content-audit.md` (claim → source → status; source: the official site bsrtrasporti.com
  and the client brief). Only VERIFIED claims reach the page; a unit test fails if a contact or
  company identifier is written anywhere else in `src`.
- Quote flow: home form (route, service, sector) and every service / sector / vehicle / coverage
  action prefill `/preventivo`, where an editable composer writes a short WhatsApp / email
  message. Nothing is submitted by the site; invalid parameters are dropped.
- Clients and testimonials render only entries with `permission: true` (none yet).
- SEO: Italian metadata, canonical, Open Graph / Twitter, robots.txt, sitemap.xml, LocalBusiness
  structured data (verified facts only). `/privacy` restates the published policy and the
  build's own facts.
- The locked hero is untouched except one copy string (`hero-content.ts`: the unconfirmed
  "30 minuti" note replaced by a neutral line).
- Hero isolation (found while verifying Phase 4 against the baseline): below-hero code must not
  run per-frame work while the hero plays. Fixed: the process journey listens to the scroll only
  near its own section (IntersectionObserver), and the below-hero parallax pauses while the hero
  is on screen (`HeroInView` → `html[data-hero-in-view]`). Traced on the software-WebGL path, the
  page now adds no per-scroll JavaScript, style writes or frame requests during the hero.
  (`content-visibility` was tried and rejected: placeholder heights measured before hydration
  settled shifted anchor positions.)
- Known environment sensitivity: the software-WebGL hero specs (`hero-realtime.spec.ts`) and the
  `hero-world` unit test are CPU-timing bound. On this shared machine they time out under load —
  and the untouched baseline (`archive/hero-baseline-2026-09-28`) fails the same way under the
  same load. Re-run them on an idle machine or CI before treating a failure as a regression.

**Cinematic redesign pass (below the hero): done, October 2026.** See "Cinematic pass" in
`docs/design-system.md`. Sections recomposed (lanes, the load, sticky process, fleet track,
network pulse, green editorial, progressive request, finale), carbon header and green mobile menu,
section bridges. The hero is untouched (only `hero-content.ts` differs from the baseline). Open
item: visual review on real devices.

**Do not start Phase 5 implementation until the items below are scheduled.**

## Launch blockers

1. **Hero placeholder art.** The hero's stills and phone clips are labelled development
   placeholders: the text "DEVELOPMENT PLACEHOLDER — NOT FINAL ART" and a magenta dashed
   "TRUCK ZONE" box are drawn into the images themselves (`scripts/generate-hero-placeholders.mjs`,
   `src/experiences/home/config/hero-assets.ts`, `docs/hero-baseline.md` → open items) — they are
   in the production build, not a test overlay. Visitors on the stills path (no WebGL, weak
   devices, reduced motion, and while the 3D scene loads) would see them. Replace them with the approved
   stills captured from the real-time scene through the hero asset pipeline
   (`docs/hero-asset-pipeline.md`) — a change inside the locked hero, done under its change policy
   and re-verified against the baseline.
2. **Legal review of `/privacy`**, and its hosting paragraph (provider, server logs) once the site
   is deployed.
3. **Domain.** Canonical URLs, Open Graph and the sitemap point to https://bsrtrasporti.com — right
   only once this site replaces the current one there.

## Needs BSR confirmation (never invented — see `docs/content-audit.md`)

- PEC: `b.s.r@legalmail.it` (official site, used) vs `bsr@legalmail.it` (brief).
- Response time: the official site says both "entro 30 minuti" and "in poche ore"; working hours.
- "Oltre 40 autisti" still current.
- The four sectors (Industria, Retail, E-commerce, Aziende commerciali) as BSR's positioning.
- Client logos: the official site shows six (Transcoop, Transmec Group, One Express, LogiCo,
  Done! Deliveries, Expedia) — relationship and written permission for each.
- Testimonials: quote, person, company, role, with written consent.
- Capacity of motrici and bilici, if BSR wants figures published (only the van has them).
- A real, consented portrait of the titolare (the current one is illustrative and captioned so).

---

# PHASE 5 — REAL MEDIA + CINEMATIC POLISH + PRODUCTION LAUNCH QA

Goal: replace every generated picture with real BSR photography, polish motion on the real
material, and take the site through production launch QA. No redesign, no new sections, the
White / Green / Red / minimal Black system unchanged, the hero locked (except blocker 1 above).

## 5.1 Real photography (when supplied)

Every photograph is placed once in `src/config/site-media.ts` (by section, alt text, focal point
per breakpoint); `site-media.test.ts` fails on repeats, a non-live livery or an unplaced file.
Replacing a picture is an edit to that file only — no layout work.

| Slot (`siteMedia.…`)        | Real shot needed                                         | Today (generated)  |
| --------------------------- | -------------------------------------------------------- | ------------------ |
| `fleet.van`                 | BSR van, three-quarter front, in the real livery          | van                |
| `fleet.rigid`               | BSR rigid truck (motrice), same framing                   | rigid-truck        |
| `fleet.articulated`         | BSR tractor + semi-trailer, same framing                  | articulated-truck  |
| `services.express`          | A BSR truck on an Italian motorway (dawn/dusk)            | express-motorway   |
| `services.dedicated`        | A dedicated load at a dock, vehicle reserved              | dedicated-dock     |
| `process.main`              | Real loading: forklift or pallet going on a BSR vehicle   | forklift-loading   |
| `security.main`             | Cargo strapped and protected inside a BSR vehicle         | secured-cargo      |
| `sectors.stage` + 4 sectors | Goods ready to ship; one picture per sector if available  | wrapped-pallet     |
| `about.portrait`            | The titolare or a driver, with consent (drop the caption)  | direct-contact     |
| `coverage.background`       | Aerial of the base area / northern plain                 | coverage-aerial    |
| `finalCta.background`       | A BSR departure (dawn), vehicle on the right third        | truck-departure    |
| new: Carpi base             | The operational base in Carpi, if BSR wants it shown      | —                  |

Brief for the shoot: landscape ≥ 2560 px plus a 4:5 crop of each; the real livery only; no
heavy grading; people only with written consent; subjects kept clear of the left text column
on the final call to action. Import through `tools/media/import-site-media.mjs` (web WebP, blur
placeholders, manifest), then set alt text (what the picture shows, never who) and focal points.

## 5.2 Video (optional, after photography)

Slots already accept `SlotMedia` `kind: "video"` (autoplay, muted, loop, playsInline, poster,
reduced-motion fallback = the poster). Candidates: services, process, fleet, final call to
action. Budget: ≤ 2 MB per loop, ≤ 8 s, H.264 + AV1/WebM, poster = a real still, `preload="none"`
below the fold, never more than one playing in view. Measure on the UHD 620 reference laptop
before shipping; drop any loop that costs hero frame time.

## 5.3 Image and video optimisation

- Re-run the import with the real files; check srcset widths and `sizes` per slot against
  rendered widths at 390 / 820 / 1024 / 1440 / 1920.
- AVIF + WebP, lazy below the fold, nothing preloaded below the hero; blur placeholders kept.
- Target: largest image request below the hero ≤ 250 KB at 1440; total below-hero image weight
  on first scroll ≤ 1.5 MB.

## 5.4 Motion polish (on the real material)

- Re-tune focal points and reveal directions per photograph; parallax only where the picture has
  depth to give (±3%, large screens, never under reduced motion or `data-motion-lite`).
- Check the entry reveals, the journey line, the coverage sequence and the vehicle crossfade on
  a mid-range Android phone and the reference laptop; nothing may cost hero frame time.
- Keep: transform / opacity / clip-path only, 150–900 ms, no bounce, no pinning, no hijacking.

## 5.5 SEO, metadata, social sharing

- Open Graph image: a real BSR photograph (1200×630) replacing `app/opengraph-image.jpg`;
  per-page images for `/preventivo` if useful.
- Confirm the production domain, then: canonical, sitemap, robots, Search Console, structured
  data validation (Rich Results Test / Schema validator).
- Favicon / app icons from the real BSR logo (with permission to use the final mark).
- No keyword stuffing; titles and descriptions stay as written unless BSR's facts change.

## 5.6 Legal completion

- Legal review of `/privacy`; add the hosting provider and its log retention.
- Re-verify "no cookies / no storage / no analytics" after any addition (analytics, maps,
  embeds, a form backend). If analytics are wanted: consent first, then update the notice.
- If BSR wants an online form that sends data: a backend, its processor in the notice, consent
  wording, spam protection — a separate decision, not part of the current static site.

## 5.7 Production performance

- Hero: re-run `node scripts/bench-hero.mjs --tier auto` on the reference machine after blocker 1;
  results must match `docs/hero-baseline.md` — now with the full page below the hero (the
  baseline was measured with an almost empty page).
- Hero isolation: keep the rule — no per-scroll or per-frame work below the hero while it plays
  (observers, not scroll listeners; composited motion paused while `data-hero-in-view`). Re-trace
  with `Performance` / tracing on the software path after any below-hero motion change.
- Run `hero-realtime.spec.ts` and the `hero-world` unit test on an idle machine or CI (they are
  CPU-timing bound; see "Known environment sensitivity" above).
- Below the hero: Lighthouse / WebPageTest on 4G mobile and desktop — LCP, CLS (target 0), INP,
  total JS; confirm no below-hero code imports WebGL or the hero's modules (ESLint already
  enforces it).
- Caching headers for `/assets`, compression, image CDN behaviour on the chosen host.

## 5.8 Final accessibility

- Automated: the axe suites (home, below the hero, `/preventivo`, design system) stay at zero.
- Manual: keyboard-only pass of the whole journey (nav, sectors, fleet tabs, FAQ, form,
  composer, WhatsApp / email links); screen reader pass (NVDA + Chrome, VoiceOver iOS); zoom to
  200 % and 400 %; reduced motion; forced colours.
- Alt text reviewed on every real photograph.

## 5.9 Final responsive QA

- 390×844, 820×1180, 1024×768, 1440×900, plus 360×740, 1280×800, 1920×1080 and landscape phones.
- Per viewport: no horizontal overflow, headings ≤ 2 lines at desktop, no truncated fields, the
  mobile quote bar never covering a form or a primary action, focal points on the real photos.
- Real devices: one iPhone (Safari), one mid-range Android (Chrome), one Windows laptop (Edge).

## Phase 5 gate

`pnpm typecheck` · `pnpm lint` · `pnpm vitest run` · `pnpm build` · `pnpm playwright test`
(including the WebGL projects) · the hero benchmark on the reference machine · the manual
accessibility and device passes above. Launch only with the blockers at the top of this file
closed.
