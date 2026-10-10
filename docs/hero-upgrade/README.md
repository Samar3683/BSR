# Hero and film upgrade — October 2026

What changed in the cinematic hero and the film below it, why, and the evidence. Measured on
9–10 October 2026. Everything here is reproducible with the scripts named below.

## Test conditions

|                  |                                                                                                                  |
| ---------------- | ---------------------------------------------------------------------------------------------------------------- |
| Machine          | Apple M3 Pro (11-core CPU, 14-core GPU), macOS 26                                                                |
| Browser          | Playwright Chromium headless shell 156, **real GPU** (ANGLE Metal); software WebGL only in the e2e suite         |
| Desktop viewport | 1600 × 900 @1 (frames, loading, scroll), 1920 × 1080 @1.25 (benchmark)                                           |
| Phones           | iPhone 13 and Pixel 7 **emulation** (Chromium), not real devices                                                 |
| Network          | unthrottled localhost; CDP emulation "fast 4G" (9 Mbit/s, 40 ms) and "slow 4G" (1.6 Mbit/s, 150 ms)              |
| Cache            | disabled for loading runs (cold visit)                                                                           |
| Builds           | `NEXT_PUBLIC_BSR_HERO_TEST_HOOKS=true` production builds: baseline = commit `f0fffd9`, after = this working tree |

Not measured: Safari/WebKit, real phones, Windows/Intel GPUs (the documented UHD 620 reference
laptop), Lighthouse, field INP.

## Baseline, prioritised (before any change)

|     | Finding                                                                                                                                                                                                     | Evidence                                     |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| P0  | Phones, reduced motion, no-WebGL and "still loading" visitors saw development placeholder art ("NOT FINAL ART", magenta "TRUCK ZONE")                                                                       | below-hero captures, user report             |
| P0  | The CC BY 4.0 credit for both truck models was missing from the site                                                                                                                                        | `grep` of `src`                              |
| P1  | The first 3D frame waited for the 2.4 MB road kit (only needed from the trailer wipe); the KTX2 transcoder was requested only after the models had downloaded                                               | first 3D frame 6.1 s fast 4G, 26.9 s slow 4G |
| P1  | Real-time could take over only at 0–10 % or 36–42 %: a refresh or a late load mid-story stayed on stills                                                                                                    | `hero-handoff.ts`                            |
| P1  | Pacing: six scenes in 120svh of scroll (≈ 180 px per scene)                                                                                                                                                 | scroll probe                                 |
| P2  | Reach (84 %): ground ~25 % see-through (sunrise orange through two half-transparent layers), ghost tree belts, a stray route line across the fields; map (93 %): sea and neighbours shown as brown farmland | frames 11–13                                 |
| P2  | Mirror-chrome hubs, "shower curtain" folds, pink-clipped tail lamps, tree halos, departure ground streaks running under the camera, an 8 %-long blank grey wipe                                             | frames 06–10, filmstrip                      |
| P2  | Portrait/tablet opening camera stood **inside** a yard building (dark slab over the mobile poster); the wide camera stood 0.2 m from it (black bar at the left edge)                                        | occluder search, frame 01                    |
| P3  | Coverage map: camera and routes on 1.4–1.6 s time-based transitions — the map lagged its text by a whole step and kept moving after the scroll stopped; fixed SVG `id`                                      | 300 ms-after-stop captures                   |
| P3  | Map labels clipped/mis-anchored when the web font replaced the fallback; ≈ 9 px type                                                                                                                        | `italy-stage.ts`                             |
| OK  | 60 fps at every checkpoint (high tier); LCP 292 ms / CLS 0.0003 on fast 4G; no console errors                                                                                                               | benchmark, load probe                        |

## What changed

### 1. Loading and fallback

| Change                                                                                                                                                                                                                                                                                                | Files                                                                                             |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| The opening loads only the truck; the road kit loads after the first frame through the same loader and is swapped in while the dock is on screen (`HeroRuntime.attachRoad`). Its programs and textures warm up in idle time; a road handoff waits for that                                            | `hero-world.ts`, `hero-scene.tsx`, `hero-runtime.ts`, `hero-frame-driver.tsx`                     |
| KTX2 transcoder fetched alongside the models (`ktx2.init()`)                                                                                                                                                                                                                                          | `lib/three/gltf-loader.ts`                                                                        |
| A visitor who reaches the wipe before the road arrives sees the still ladder (S3/S4); the story waits at the wipe and resumes with a snap once the road is attached **and** warm                                                                                                                      | `hero-cinematic.tsx`, `hero-frame-driver.tsx`, `hero-runtime.ts`                                  |
| New handoff points H3 (road, 0.64–0.80) and H4 (Italy, 0.95–1) once the road is warm, so a refresh or late load mid-story becomes real-time                                                                                                                                                           | `hero-handoff.ts` (+ tests)                                                                       |
| Shadow-size changes recompile shaders only when shadows switch on/off (a step-down between shadowed levels recompiled every material)                                                                                                                                                                 | `hero-runtime.ts`                                                                                 |
| **Production stills and phone clips captured from the real-time scene** (S1–S4 wide 2560 × 1440 and portrait 1080 × 1920; clips A S1→S2 and B S2→S4, 720 × 1280 30 fps, AV1 + H.264). Content-hashed file names and a generated manifest, so no cache can serve an old frame. Placeholder art removed | `scripts/capture-hero-stills.mjs`, `config/hero-captures.ts` (generated), `config/hero-assets.ts` |
| Phone clips started only when the hero section was ≥ 50 % visible; the observer now watches the sticky stage (screen coverage), independent of story length                                                                                                                                           | `hero-cinematic.tsx`                                                                              |
| CC BY 4.0 credit line in the footer                                                                                                                                                                                                                                                                   | `site-navigation.ts`, `site-footer.tsx`                                                           |

### 2. Truck, lighting, opening

| Change                                                                                                                                                                                                         | Files                                      |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| Material separation (values only, no baked light): satin hubs/tanks (metalness 0.75, roughness 0.56), curtain at an off-white with half-strength folds, textured grille plastic, saturated tail/brake lens red | `truck-materials.ts`                       |
| Yard block on the camera side moved past every opening/reveal camera position (all five framing buckets); new clearance test                                                                                   | `dock-hardware.ts`, `hero-camera.test.ts`  |
| Portrait framing lifts the truck into the band above the phone copy (≈ 12–31 % of the height) and keeps the wordmark in frame; safe-zone test tightened to the real copy layout                                | `hero-shots.ts`, `hero-safe-zones.test.ts` |

### 3. Dock, road, camera continuity

| Change                                                                                                                                                                       | Files                                   |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| Story scroll 120svh → **300svh** (compact 70 → 160svh): each scene has an entrance, a hold and an exit                                                                       | `hero.module.css`                       |
| Trailer wipe hold 0.57–0.63 → **0.585–0.615** (switch points unchanged, still under ≥ 92 % cover)                                                                            | `hero-states.ts`                        |
| Wet-floor reflection follows a Schlick-like curve (a few % looking down, strong at grazing); ground glints shrink and fade as the view steepens and stop short of the camera | `dock-wet-floor.ts`, `world-details.ts` |
| Reach: opaque field plane under the aerial tile; tree belts grow out of the ground (opaque) instead of fading                                                                | `road-world.ts`                         |
| Roadside tree cards: fringe darkened towards the silhouette (no halo against the sunrise)                                                                                    | `road-scenery.ts`                       |

### 4. Maps and cut-outs

| Change                                                                                                                                                                                                                                       | Files                                                                                       |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Hero map: only the A22 leg grows with the lane line; the rest of the network waits for the map. Ground dissolves before Italy forms; the sea is carbon by mid-blend                                                                          | `italy-stage.ts`, `road-world.ts`, `hero-runtime.ts`                                        |
| Labels re-measure and re-texture when the web font arrives; ≈ 15–17 px on screen                                                                                                                                                             | `italy-stage.ts`                                                                            |
| Coverage map scrubbed by the act's progress in CSS (no transitions, no catch-up); line weights and labels compensate the zoom; unique clip-path id; reduced motion keeps the complete static map                                             | `coverage-map.tsx`, `coverage-map.module.css`                                               |
| Cut-outs re-rendered with the hero's material values; wheels lit along the view axis (no orbiting highlight); crops centred on the axle (0.00 px measured); placements and hashed file names written to a generated module — no hand copying | `render-truck-cutouts.mjs`, `config/cutouts-placements.ts` (generated), `config/cutouts.ts` |

### 5. Tests

- A fleet caption faded through low contrast while its picture crossfaded (intermittent axe
  failure, also on the baseline): inactive captions are now hidden at once (`cinematic.css`).
- `hero-realtime.spec.ts` "short desktop window" created its context with the phone's touch
  input in the mobile project (failed on the baseline too): the context is now explicitly a
  desktop one.

## Results

### Loading (cold, median of 3)

|             | First 3D frame — before | after         | Largest main-thread task — before | after  |
| ----------- | ----------------------- | ------------- | --------------------------------- | ------ |
| Unthrottled | 1 896 ms                | 1 859 ms      | 376 ms                            | 291 ms |
| Fast 4G     | 6 070 ms                | **3 701 ms**  | 385 ms                            | 294 ms |
| Slow 4G     | 26 947 ms               | **14 939 ms** | 393 ms                            | 306 ms |

FCP/LCP unchanged (64 / 292 / 948 ms; the LCP element is the headline). CLS ≤ 0.0003 in every
run. Road kit now completes at 5.2 s (fast 4G), after the first frame instead of gating it.

### Frame time

|                                                      | before                                            | after                                        |
| ---------------------------------------------------- | ------------------------------------------------- | -------------------------------------------- |
| Benchmark (1920 × 1080 @1.25, auto = high), vsync on | 60 fps every checkpoint                           | 60 fps every checkpoint                      |
| Same, vsync and frame cap off                        | 10.7–11.0 ms avg                                  | 10.7–11.0 ms avg                             |
| Shader programs                                      | 228–233                                           | 217–222                                      |
| Wheel scroll forward + reverse, high                 | p99 16.8 ms, 1 frame > 33 ms, no long tasks       | p99 16.8 ms, 0 frames > 33 ms, no long tasks |
| Same, low tier, CPU ×4                               | intermittent 333 ms / 133 ms stalls (1 of 2 runs) | none in 3 runs                               |
| Fast flicks and 10 random jumps                      | —                                                 | max 17 ms, no long tasks                     |

### Lab interaction latency (Event Timing, keyboard scroll, nav, FAQ)

Worst interaction 48 ms → 32 ms; interactions over 16 ms 20 → 10. Lab only: field INP needs
real-user data.

### Behaviour verified

- Trailer occlusion: 9 viewports (4:3 to 21:9, portrait tablets), slow forward/reverse through
  the wipe and 10 jumps each — every world switch and re-base at coverage 1.00, 0 violations.
- Late loading on slow 4G: jump to the road before the 3D is ready → stills, then real-time at
  0.75 (H3) once the road is warm; past the wipe before the road → stills, resume after.
- Phone path (iPhone 13 / Pixel 7 emulation): clip A autoplays and ends on S2, clip B ends on
  S4; reduced motion shows S1 only; no errors.
- Unit: 651 passed. E2E: 121 passed, 0 failed, 23 skipped (form-factor gates) — including the
  software-WebGL hero specs.

## Evidence

- `frames/NN-*.jpg` — before | after at identical progress (14 hero frames).
- `frames/coverage-map-{before,after}.jpg` — 12 positions through the act, captured 300 ms after
  the scroll stops.
- `phone/phone-compositions.jpg` — iPhone 13 / Pixel 7 load and S2, reduced motion.
- `recordings/{before,after}-forward-reverse.mp4` — wheel scroll through the hero and back.

## Remaining asset requirements and launch blockers

1. **Tractor geometry.** `bsr-tractor-high.glb` has 37 510 triangles (medium is the same mesh)
   against the approved 150–250k for the high tier. Needed from 3D production: round lamps
   with ≥ 32 segments and modelled lenses/reflectors, a slatted grille, mirror arms and housings,
   window seals, wheel-arch liners, tyre sidewall lettering/tread at hero distance. Must keep
   `truck-contract-spec.ts` nodes and pass `pnpm assets:validate-model`. Blender and the Basis
   encoder (`tools/encode-vehicle-web.mjs`) were not available on this machine, so no geometry
   was changed.
2. **Real-device QA**: Safari (macOS/iOS), a mid-range Android, the UHD 620 reference laptop.
3. Legal review of `/privacy` and the production domain (unchanged, see `NEXT.md`).
4. Re-run `node scripts/capture-hero-stills.mjs` and `pnpm assets:truck-cutouts` after any
   change to the truck, the scene or the cameras.
