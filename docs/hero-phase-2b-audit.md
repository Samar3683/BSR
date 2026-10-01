# Hero Phase 2B: visual audit, asset audit and gate status

Written 2026-09-25, at the start of Phase 2B (cinematic visual production). Review captures of the
current state are in [styleframes/hero/captures/](styleframes/hero/captures/): clean plate, copy-on
frame, 50 % overlay and side-by-side for each checkpoint. They come from software WebGL, so they
are valid for composition only.

## 1. Placeholder versus styleframe target

| Aspect         | Styleframe target                                                                                              | Before 2B (Phase 1 placeholder)                      | Now                                                                                                                                                               |
| -------------- | -------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Camera (01/02) | Low (≈ 0.6 m), level, long lens (≈ 65 mm), truck's right side, cab front right of frame, horizon ≈ 74 % down   | Truck's left side, cab front on the left, 28–30° FOV | **Fitted to 01/02** (numerical fit to landmarks, with a copy-safe constraint; see decision D2)                                                                    |
| Camera (03/04) | Low tracking, rear-left, sunrise ahead; then camera rising over route language                                 | Blocking shots                                       | Unchanged (Gates 3–4 not started)                                                                                                                                 |
| Truck          | Modern European cab-over, credible detail and materials                                                        | Magenta-edged blocks                                 | Unchanged blocking geometry. **Blocked: no production asset.** Paint value set to soft white so exposure can be judged                                            |
| Trailer        | White curtain-sider, tension, folds, buckles, chassis                                                          | Box                                                  | Box; material slot is now `MAT_Curtain`; contour marking added. **Blocked: no production asset**                                                                  |
| Scale          | Truck dominant, flank ≈ 2 × cab-front width                                                                    | Near-frontal, trailer half hidden                    | Styleframe angle kept; truck scaled ≈ 80 % so it clears the copy (D2)                                                                                             |
| Environment    | Façade parallel to the truck, lit open bay beside the cab, yard towards camera, distant relief and city lights | Façade behind the trailer (end-on bay), grid floor   | **Layout matches 01/02**: parallel façade, lit bay beside the cab, levellers, bollards, slab joints, yard lamps. Relief/city/backdrop: art production             |
| Materials      | Separated paint / glass / rubber / metal / fabric / reflective; damp concrete                                  | Few flat materials                                   | Contract material slots, tier material preparation (clearcoat high only); damp-concrete roughness. Textures: art production                                       |
| Light          | Blue-hour sky + one warm dock source + vehicle lights                                                          | Flat hemisphere, very dark                           | **Blue-hour system**: sky dome (light-story keyframes), environment map generated from the sky (image-based lighting), one warm flood, restrained headlight beams |
| Atmosphere     | Subtle depth, faint horizon glow                                                                               | Flat fog                                             | Fog follows the sky horizon colour; narrow warm horizon band. No particles (removable first under pressure)                                                       |
| Road (03)      | European lane marking, guardrails, flat agri-industrial outskirts, sunrise, haze                               | Grid, poles, posts                                   | Unchanged except the sky now carries the light story (Gate 3 not started)                                                                                         |
| Route (04)     | Road simplifies into graphite; green route language; camera rises                                              | Dark plane + green line                              | Unchanged (Gate 4 not started). The styleframe's map labels and geography are **not** to be copied                                                                |

## 2. Production asset availability

| Item                                        | Status                                                                                                 |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Tractor GLB                                 | **MISSING — requires art production or a licence** (and user input on the source)                      |
| Trailer GLB (curtain-side; box alternative) | **MISSING — requires art production or a licence**                                                     |
| BSR vector logo                             | **MISSING — requires user input.** No logo is invented; the livery slot stays a neutral placeholder    |
| Truck livery                                | REQUIRES the logo, then art production (geometry, per the amended spec)                                |
| Dock environment kit                        | PLACEHOLDER (blocking, now in the approved layout) — requires art production                           |
| Road environment                            | PLACEHOLDER (procedural) — requires art production and a road-kit contract (Gate 3)                    |
| Environment maps                            | **AVAILABLE as a system**: generated at runtime from the sky (no asset). A production HDR is optional  |
| Backdrops (relief, city lights, sky detail) | MISSING — requires art production                                                                      |
| Road / concrete materials (textures)        | MISSING — requires art production (only material parameters exist)                                     |
| Vegetation, guardrails, road lighting poles | PLACEHOLDER geometry — requires art production                                                         |
| Vehicle light textures, glow textures       | MISSING — requires art production (lights are emissive materials + runtime beams today)                |
| Posters, S1–S4 stills (wide and compact)    | PLACEHOLDER (labelled development images). Must be captured from the production scene, not styleframes |
| Mobile clips A/B                            | PLACEHOLDER. Only after desktop visual lock (brief §47)                                                |
| KTX2 transcoder, Meshopt decoder            | AVAILABLE (self-hosted, synced from the installed three)                                               |
| Styleframes 01–04                           | AVAILABLE (renamed from `*.png.png` to the approved paths)                                             |

Licensing: nothing in the repository is licensed third-party 3D art. Any purchased or commissioned
model must allow web real-time use and modification, and must carry no manufacturer branding
unless that is licensed too.

## 3. Decisions taken (for review)

- **D1: camera side and choreography.** Styleframes 01/02 put the cab front on the right of the
  frame, which means the camera is on the truck's right side. Styleframe 03 shows the left side.
  From the reveal, the camera now travels **around the rear** (never across the departure path)
  while the truck pulls away. It then crosses behind the tail to the existing left-side trailer
  occlusion. The wipe, the road side and the return path are unchanged, and tests now cover
  camera clearance on every forward and return path.
- **D2: copy-safe composition (a deliberate deviation from 01/02).** The styleframes were composed
  without copy. At their exact scale, the trailer's rear third sits under the headline (white text
  on a white curtain). The fit keeps their viewing angle, lens and low horizon, and scales the
  truck about 80 % towards the cab-front corner, so the whole truck clears the text zone at every
  checkpoint and bucket (tested). **Alternative for the art director:** match the styleframe scale
  and let the trailer's rear run behind a stronger scrim. That needs a creative-spec change to the
  safe-zone rule.
- **D3: lit bay position.** Worked out from the fitted camera: only façade points between
  z ≈ −10.5 and −5.6 appear right of the cab front.
- **D4: image-based lighting from the sky.** Paint, glass and damp concrete need blue-hour
  reflections. The environment map is generated from the sky dome with Three's PMREM generator: no
  HDR asset and no dependency. It regenerates only at quantised light-story steps, and
  never during a readiness measurement. Measured on software WebGL at the light tier's 64 px cube:
  11 regenerations over a 0–0.75 glide averaged 2.4 ms of CPU time each. GPU time is not measured
  yet (real hardware). The significant cost on software WebGL is per-pixel environment sampling
  (about 3× frame time there), which is normal and cheap on GPUs. That is why the step-down
  monitor is off in software-WebGL test runs.
- **D5: light-tier punctual lights.** The light tier's budget is two punctual lights, so it gets
  one centred headlight beam plus the dock flood.
- **D6: budgets gate production assets only.** The blocking placeholders are measured and
  reported, not rejected.

## 4. Gates

| Gate             | Status                                                                                                                                                                                                                                     |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1 — Opening (01) | **Partially matched.** Camera, composition, negative space, dock layout and the blue-hour light system are in place. Truck and material believability are **blocked** by the missing truck; the backdrop and textures need art production. |
| 2 — Reveal (02)  | **Blocked.** Composition and headlight system are in place, but this gate is about truck quality, which needs the production truck.                                                                                                        |
| 3 — Road (03)    | Not started (the brief gates it behind Gates 1–2).                                                                                                                                                                                         |
| 4 — Route (04)   | Not started.                                                                                                                                                                                                                               |

## 5. What unblocks the next step

1. A production tractor and curtain-side trailer (commissioned or licensed, unbranded), delivered
   to [hero-asset-pipeline.md](hero-asset-pipeline.md) and passing `pnpm assets:validate-model`
   at every tier.
2. BSR's vector wordmark.
3. A decision on D2 (copy-safe scale, or styleframe scale behind a scrim).
4. Real-hardware review access: a dedicated-GPU desktop, an integrated-GPU laptop, a tablet, and
   flagship and mid-range phones.
