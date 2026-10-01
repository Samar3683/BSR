# Hero production baseline (locked 2026-09-28)

The home hero (WebGL cinematic + real-time performance system) is **locked** as the production
baseline. The rest of the site is built independently of it, so it can later be replaced (for
example by pre-rendered video) without touching anything below it.

## Snapshot

`archive/hero-baseline-2026-09-28/source.tar.gz`
(SHA-256 `bc978342d9e68e7d48ced300aa071d9458a2ec86bf3c0400b95983a11b58478d`).

It contains `src/`, `public/assets/`, `tools/`, `docs/*.md`, the UI map images and the build and
test configuration (`package.json`, `pnpm-lock.yaml`, Next, TypeScript, ESLint, Vitest,
Playwright, PostCSS, `.nvmrc`). The styleframe review images are not included (216 MB).

Restore into an empty folder with `tar -xzf source.tar.gz`, then `pnpm install`.

## Locked scope

- Three.js scenes, truck, cameras, cinematic timing, approved environment art and materials.
- GPU classification, static batching and instancing, the render-scale logic, the quality ladder
  and the fallback logic.
- The real-time performance infrastructure (frame driver, frame monitor, shader and asset
  warm-up).

**Change policy:** only to fix a demonstrated regression. A change must re-run the baseline
checks below and match them.

## Baseline

The reference machine is an Intel UHD 620 laptop (1920×1080 @ 1.25). This is the auto path: GPU
class "weak", starting level `low-scaled-1`, DPR 0.82.

| Scene       | p     | avg ms | fps  | Draw calls avg / max | Geometries | Textures |
| ----------- | ----- | ------ | ---- | -------------------- | ---------- | -------- |
| Preparation | 0.04  | 23.0   | 43.5 | 65 / 96              | 60         | 75       |
| Ready       | 0.39  | 20.0   | 50.0 | 64 / 95              | 60         | 75       |
| Loading     | 0.49  | 25.5   | 39.3 | 64 / 97              | 62         | 76       |
| Departure   | 0.53  | 23.6   | 42.3 | 63 / 94              | 62         | 76       |
| Industrial  | 0.665 | 20.5   | 48.8 | 57 / 57              | 102        | 77       |
| Service     | 0.705 | 19.4   | 51.5 | 42 / 42              | 109        | 77       |
| Open Road   | 0.77  | 19.5   | 51.3 | 52 / 52              | 126        | 77       |
| Reach       | 0.885 | 29.9   | 33.5 | 46 / 46              | 139        | 77       |

- The 90th-percentile frame is 33.4 ms or better in every scene.
- There is no context loss, and GPU resource counts plateau.
- 3D is active about 8 s after load, and the dock → road switch compiles and uploads nothing.
- Engineering gate: typecheck clean, lint 0 errors, 538/538 unit tests, Playwright 53 passed with
  0 failed (17 skips are form-factor gates).

**Re-verify:**

1. `BSR_DESIGN_PREVIEW=true NEXT_PUBLIC_BSR_HERO_TEST_HOOKS=true pnpm build && pnpm start --port 3100`
2. `node scripts/bench-hero.mjs --tier auto` on the reference machine.
3. The full test gate.

## Replacement contract (for a future video hero)

The page composes `<HeroSection />` followed by the below-hero sections (`src/app/(site)/page.tsx`).
Below-hero code never imports `@/experiences/*`, `@/lib/three/*`, `three` or `@react-three/*`; ESLint
enforces this. Any hero, WebGL or video, must:

- render the page's single `h1` and the hero copy as semantic HTML (it must work without
  JavaScript);
- own its scroll height and leave nothing positioned outside its own box;
- end on a dark frame near Carbon, with nothing essential in its bottom 12rem: the page places
  `RouteTransition` after it, which paints a fade over that band into Carbon (so the seam never
  shows on any path — real-time, stills, video), draws the route from Ritiro to the red
  Destinazione and cuts diagonally into the first white section.

## Open items (not part of the baseline, do not fix now)

- Hero UI conflicts C1–C4 and the non-wide camera occluder: see
  [hero-ui-visual-map.md](hero-ui-visual-map.md).
- Development-placeholder assets: truck, logo, stills and phone clips.
