# Hero asset pipeline and model contract

For whoever builds, licenses or optimises the hero's production 3D assets, and for the developer
who integrates them. It lists what to deliver, the conventions the real-time scene relies on, the
budgets, and how to check a file before hand-off.

The approved visual targets are the four styleframes in
[styleframes/hero/](styleframes/hero/). They set composition, light and material character. They
are AI-generated references, so reproduce their art direction, not their mechanical or
geographic mistakes.

## 1. Deliverables

| Asset                  | File (per tier: `-high`, `-medium`, `-low`) | Notes                                                                                                                              |
| ---------------------- | ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Tractor                | `models/truck/bsr-tractor-<tier>.glb`       | A modern European cab-over (S-Way / FH / S-series / TGX class). **No manufacturer badges, grille logos or names** unless licensed. |
| Curtain-side trailer   | `models/truck/bsr-trailer-<tier>.glb`       | European 13.6 m curtain-sider. A box trailer is the contract alternative (see section 3).                                          |
| Dock environment (kit) | `models/dock/dock-customer-<tier>.glb`      | Anonymous customer-side facility. **No BSR branding on the building.** Layout: see section 5.                                      |
| Road kit               | not yet contracted                          | The road world is procedural today; its kit contract is defined at Gate 3.                                                         |
| BSR wordmark           | vector (SVG/AI/PDF) from BSR                | **Required from BSR.** It is modelled as geometry on the trailer, not as a texture.                                                |

The three tiers are separate optimised files, not one file scaled at runtime (spec, section R).

## 2. Units, axes and origins

- Metres. +Y up, +Z forward (glTF default). The truck's **left** side is +X.
- **Tractor origin:** on the ground, under the rear drive axle.
- **Trailer origin (`Trailer_Root`):** at the kingpin. The runtime parents the trailer to the
  tractor's `Hitch_FifthWheel`.
- Every rotating wheel is a node ending in `_Spin`, pivoted at the hub, spinning about local **X**.
  The runtime measures each wheel's radius from its bounds and turns it from travelled distance.
  Wheels must be round and centred, or they will appear to slide.
- Front steering: `Wheel_FL` / `Wheel_FR` are the steering pivots (local Y). Their `_Spin`
  children carry the wheels.

## 3. Required nodes and material slots

The single source is
[`truck-contract-spec.ts`](../src/experiences/home/scenes/truck-contract-spec.ts). The scene
refuses an asset that breaks it, and the hero then falls back to stills.

**Tractor nodes:** `Tractor`, `Tractor_Body`, `Wheel_FL`, `Wheel_FR`, `Wheel_FL_Spin`,
`Wheel_FR_Spin`, `Hitch_FifthWheel`, `Lights_Head_L`, `Lights_Head_R`.

**Trailer nodes:** `Trailer`, `Trailer_Root`, `Trailer_Body`, `Livery_Wordmark`, `Livery_Accent`.

- `Trailer_Body` bounds are used for the occlusion wipe. Keep the curtain body in that node.
- The livery nodes carry both flanks: the dock shots see the right side, the road shots the left.

**Material slots.** Name every material from this list. Each class is tuned separately, so there is
no universal glossy material.

| Slot                                               | Use                                                    | Required            |
| -------------------------------------------------- | ------------------------------------------------------ | ------------------- |
| `MAT_Paint_Body`                                   | Painted, clear-coated cab (clearcoat on the high tier) | tractor             |
| `MAT_Paint_Graphite`                               | Dark painted parts                                     | —                   |
| `MAT_Plastic_Grille`                               | Grille, bumper plastics                                | —                   |
| `MAT_Rubber`                                       | Tyres                                                  | tractor and trailer |
| `MAT_Metal_Dark`, `MAT_Metal_Steel`                | Chassis; tanks, hubs, steps                            | —                   |
| `MAT_Glass`                                        | Glazing: reflective, dark enough to hide most interior | tractor             |
| `MAT_Interior`                                     | Simplified cab interior                                | —                   |
| `MAT_Curtain` **or** `MAT_Box_Panel`               | Trailer body (fabric, or the box alternative)          | trailer             |
| `MAT_Reflective`                                   | Retro-reflective contour marking                       | trailer             |
| `MAT_Livery_Mark`                                  | Graphite wordmark geometry                             | trailer             |
| `MAT_Livery_Accent_Red`, `MAT_Livery_Accent_Green` | Restrained accents                                     | —                   |
| `MAT_Light_Head`, `MAT_Light_Marker`               | Emissive lenses (driven by the runtime)                | tractor             |
| `MAT_Light_Tail`, `MAT_Light_Brake`                | Emissive lenses (driven by the runtime)                | trailer             |
| `MAT_Light_Reverse`                                | Optional; never switched on (the truck never reverses) | —                   |

Light lenses carry an emissive colour with intensity 0 in the file. The runtime switches them.
Headlight beams are runtime lights: never bake light into the asset.

## 4. Realism brief (truck)

The brief asks for realistic cab proportions and wheel scale, and for tyre sidewalls, hubs,
mirrors, steps, chassis parts, mudguards, fuel tanks, fifth wheel and coupling. It also asks for
panel seams, grille and headlight construction, marker lights, plausible ground clearance,
separate materials and subtle operational wear.

Avoid concept-truck surfaces, toy proportions, showroom perfection and fake luxury rims. The
curtain needs believable tension, subtle folds, lower buckles and tensioners, and a realistic
chassis, axles and rear frame. It must not read as plastic, polished metal or a flat box.

## 5. Dock layout (Styleframes 01/02)

The real-time camera and the checkpoint compositions assume this layout, in truck space with the
parked truck at the origin:

- The façade runs parallel to the truck on its far side, at **x ≈ +9 m**, from about
  **z −56 to 0**.
- Loading doors face the truck (−X), with the dock sill at about 1.2 m.
- **The open, lit bay is at z ≈ −8.** From the opening camera, only this part of the façade
  appears to the right of the cab front.
- The yard opens towards −X (the camera side). The exit road runs along +Z.
- Keep the zone around the cab front clear up to about 12 m from the façade. The camera's return
  move sweeps through it.
- Architecture: clean European cladding, a dock leveller, bollards and safety marking. Pallets and
  props are minor context only. Keep clutter low.

## 6. Budgets (per tier)

The single source is
[`hero-budgets.ts`](../src/experiences/home/config/hero-budgets.ts). "Hard" fails review; at
runtime, a production asset over a hard limit is rejected and the hero falls back to stills.

| Metric                  | High (A)     | Medium (B)   | Light (C)    |
| ----------------------- | ------------ | ------------ | ------------ |
| Tractor triangles       | 150–250k     | 80–120k      | 40–60k       |
| Trailer triangles       | 40–80k       | 25–40k       | 12–20k       |
| Dock triangles          | 100–200k     | 60–100k      | 30–50k       |
| Total visible triangles | 450k / 600k  | 250k / 300k  | 120k / 150k  |
| Truck materials         | ≤ 15         | ≤ 12         | ≤ 11 ¹       |
| GPU texture memory      | 120 / 160 MB | 70 / 96 MB   | 36 / 48 MB   |
| First-reveal download   | 6.5 / 9 MB   | 4 / 5.5 MB   | 2.5 / 3.5 MB |
| Road addition download  | 4.5 / 6 MB   | 2.8 / 3.5 MB | 1.6 / 2.2 MB |

¹ The specification gives "≤ 18 total" for the light tier; the split between truck and world
(11 / 7) is an implementation choice: the model contract alone requires 10 distinct truck slots.

Tier A first-reveal allocation (≈ 6.4 MB): tractor geometry 1.6, trailer geometry 0.5, tractor
textures 2.0 (2K cab atlas base colour + ORM, 2K normal, 1K wheel/light atlas, tiling detail
normals), dock geometry 0.6, dock textures 0.9, dock environment map 0.5, backdrop 0.25, glow and
decals 0.05.

## 7. Compression pipeline

- **GLB + Meshopt geometry + KTX2 (Basis Universal) textures.** No Draco.
- Pack occlusion, roughness and metalness into one ORM texture. Use UASTC for normal maps and
  close-up surfaces, and ETC1S for the rest.
- Quantise geometry. Keep separate `_Spin` / steering nodes intact; don't let the optimiser merge
  them away.
- The decoders are self-hosted. Meshopt is bundled; the Basis transcoder is served from
  `/assets/decoders/basis/` and synced with `pnpm assets:decoders`.
- The repository has **no optimiser dependency**. Run the optimisation (for example
  `gltf-transform`) on the production machine; adding it to the repository needs approval.

## 8. Check before hand-off

```bash
pnpm assets:validate-model path/to/bsr-tractor-high.glb --role tractor --tier high
pnpm assets:validate-model path/to/bsr-trailer-high.glb --role trailer --tier high
pnpm assets:validate-model path/to/dock-customer-high.glb --role dock --tier high
```

It reports size, triangles, materials, images, estimated GPU texture memory and extensions. It
**fails** on:

- Draco;
- missing Meshopt;
- non-KTX2 textures;
- missing contract nodes or material slots;
- triangles or texture memory over the tier's hard limit.

It **warns** on material names outside the contract vocabulary, and on counts over the goal.

After validation, add the files to `HERO_MODELS` in
[`hero-assets.ts`](../src/experiences/home/config/hero-assets.ts). The scene measures what it
loaded, applies the tier's material preparation (clearcoat on high only), binds the contract and
enforces the hard limits again at runtime.

## 9. Review captures

With a test build running (`pnpm test:e2e` starts one, or
`NEXT_PUBLIC_BSR_HERO_TEST_HOOKS=true pnpm build && pnpm start --port 3100`), run:

```bash
pnpm assets:capture-hero            # all four checkpoints
pnpm assets:capture-hero --only 01-opening,02-reveal
```

It writes a clean plate, a copy-on frame, a 50 % overlay on the styleframe, and a side-by-side
view to `docs/styleframes/hero/captures/`. Software-WebGL captures are for **composition review
only**. Visual and performance approval needs real hardware.

## 10. Production stills and phone clips

The poster, the still ladder (S1–S4, wide and portrait) and the phone clips (A: S1 → S2, B: S2
→ S4) are captured from the real-time scene, so every still matches the frame real-time takes
over from. With a test build running on a machine with a real GPU:

```bash
node scripts/capture-hero-stills.mjs --url http://localhost:3100            # stills + clips
node scripts/capture-hero-stills.mjs --url http://localhost:3100 --only stills
```

It writes content-hashed files (`hero-s1-opening-wide.<hash>.webp`,
`hero-clip-a.av1.<hash>.mp4` …) and the manifest `src/experiences/home/config/hero-captures.ts`
that `hero-assets.ts` reads — a re-capture never reuses a URL. Clips need `ffmpeg` with
`libsvtav1` and `libx264`; budget ≤ 2 MB per clip. Re-capture after any change to the truck, the
scene, the light or the cameras, and run `pnpm assets:truck-cutouts` for the film's cut-outs.
