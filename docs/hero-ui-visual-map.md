# Hero UI visual map (Phase 2)

Where hero UI may sit, in what colour and with how much support, at each of the eight cinematic
checkpoints, measured on the locked hero render. This is the placement contract for the Phase 2
UI, brand and content integration; no final copy yet.

The cinematic and the real-time performance system are locked. Nothing below changes scene art,
cameras, timings, materials or the quality system. Four existing layout conflicts are listed at
the end, with UI-side fixes.

Images: [`styleframes/hero/ui-map/`](styleframes/hero/ui-map/). `desktop-overview.jpg` and
`mobile-overview.jpg` show all scenes. There is one `desktop-<scene>.jpg` per scene, and
`layout-conflicts.jpg` shows the conflicts. Legend: magenta hatching = truck exclusion (exact
silhouette + margin), amber = livery/logo, cyan dashed = safe text region, white box = CTA slot,
white dashed line = navbar band, dotted = local gradient.

## Recommended hero UI system

1. **The world leads; UI follows the frame.** Copy appears only where the frame has calm negative
   space. The truck and its livery are hard exclusions: silhouette + 2% of the viewport width on
   desktop, + 3% on mobile.
2. **Text colour follows the surface under the text, not the page theme.**
   - Dark scenes (dock, Departure, Reach fields, Italy): Soft White (`text-primary`) for headlines
     and Titanium (`text-secondary`) for supporting text.
   - Bright sunrise sky on desktop road chapters (5–7): Carbon, from the light-surface
     `text-primary`. It gets 5.9–8.4:1 with no gradient. Allow one line only: the light-surface
     secondary tokens (Slate, Mist) reach only about 3.5:1 on this sky.
3. **Contrast support is local and light, or absent.** No full-frame or full-height scrims and no
   panels.
   - The only support needed on desktop is a feathered carbon gradient of at most 20%. It sits
     under the lower half of the opening copy block (Preparation/Ready), where Titanium measures
     3.6–3.8:1 against the brightest 5% of pixels.
   - This replaces today's full-height left scrim (82% → 45% → 0).
4. **Content density follows the story.**
   - **L3 full:** eyebrow, headline, supporting line, CTAs and note. Preparation and Ready.
   - **L0 none:** Loading and Departure.
   - **L1 one line:** the road chapters and Reach.
   - **L2 closing:** statement plus CTAs. Italy handoff.
5. **Navbar.**
   - At the top of the page and at the Italy handoff it is transparent with Soft White text
     (12–19:1).
   - From the reveal on, it hides on scroll-down. On scroll-up it returns as a **solid Carbon bar**
     (opaque, no blur or translucency).
   - The solid bar is mandatory over the road and Reach skies: transparent Soft White gets only
     2.0–3.0:1 there. On desktop the trailer also rises into the navbar band on the right (38–50%
     of the right-hand nav area), so right-aligned navbar items would sit on the truck.
6. **Colour roles.**
   - BSR Red is for CTAs only: the primary button in the opening copy, the closing and the
     navbar.
   - BSR Green is for route and progress cues only: the Reach and Italy route language (already
     in the art) and, optionally, a 2 px journey progress rail. Never for body text.
   - Titanium, Slate and Mist are for supporting text.
   - No tricolour adjacencies (green, white and red side by side). No glow, neon or text shadows.
7. **CTA availability.** In-frame CTAs appear in the opening (Preparation → Ready) and the closing
   (Italy handoff) only. In between, the CTA lives in the navbar when it is revealed. Nothing
   floats over the cinematic.

## Scenes

Checkpoints follow the photoreal review set. Scroll order is Preparation (0.04) → Ready (0.39) →
Loading (0.49) → Departure (0.53) → road chapters. Coordinates are fractions of the viewport
(x → right, y → down). Desktop values are for 1920×1080 unless noted.

### Background

| #   | Scene         | p     | Dominant luminance (L\*, truck excluded)                   | Temperature                                           |
| --- | ------------- | ----- | ---------------------------------------------------------- | ----------------------------------------------------- |
| 1   | Preparation   | 0.04  | **very dark**: 17 (brightest 5% 41)                        | cool blue hour (b\* −10)                              |
| 2   | Loading       | 0.49  | **dark**: 27; wet-floor reflections to 64                  | cool (b\* −7, ≈8 300 K)                               |
| 3   | Ready         | 0.39  | **dark**: 22 (brightest 5% 49)                             | cool blue (b\* −13)                                   |
| 4   | Departure     | 0.53  | **very dark**: 18 (brightest 5% 44)                        | cool (b\* −8, ≈9 200 K)                               |
| 5   | Industrial    | 0.665 | **mid-bright**: 46; upper-left sky 71                      | warm-neutral sunrise (sky b\* +7…+12, ≈4 600–5 200 K) |
| 6   | Service       | 0.705 | **bright**: 53; sky 74                                     | warm (sky b\* +26, ≈3 900 K)                          |
| 7   | Open Road     | 0.77  | **bright**: 51; sky 69                                     | warm (sky b\* +22, ≈4 000 K)                          |
| 8a  | Reach         | 0.885 | **split**: bright haze on top (71), dark fields below (11) | warm (b\* +14, ≈4 400 K)                              |
| 8b  | Italy handoff | 0.97  | **near-black**: 1                                          | neutral                                               |

L\* runs from 0 (black) to 100 (white). b\* below 0 is blue, above 0 is warm. Kelvin is quoted only
where L\* > 15: on near-black areas a correlated colour temperature is meaningless.

### Zones (desktop)

| #   | Truck exclusion (bounding box of the silhouette) | Livery / logo            | Safe text region                                                           |
| --- | ------------------------------------------------ | ------------------------ | -------------------------------------------------------------------------- |
| 1   | x 0.51–0.91, y 0.37–0.80                         | x 0.58–0.75, y 0.48–0.59 | Opening column: text x ≤ **0.44**, y 0.23–0.83 (today 0.167–0.446 at 1920) |
| 2   | x 0.35–0.78, y 0.33–0.72 (**centre-left**)       | x 0.64–0.76, y 0.39–0.48 | None. Optional micro label at x 0.05–0.28, y 0.76–0.92                     |
| 3   | x 0.51–0.90, y 0.38–0.79                         | x 0.59–0.76, y 0.48–0.59 | Same as 1                                                                  |
| 4   | x 0.45–0.77, y 0.27–0.86                         | x 0.47–0.49 (edge)       | None                                                                       |
| 5   | x 0.41–1.00, y 0.00–0.86                         | x 0.43–0.66, y 0.36–0.57 | Sky, x 0.05–0.34, y 0.13–0.28 (clear of the lamp posts)                    |
| 6   | x 0.48–1.00, y 0.02–0.83                         | x 0.50–0.75, y 0.37–0.57 | Sky, x 0.05–0.40, y 0.14–0.32                                              |
| 7   | x 0.48–1.00, y 0.02–0.83                         | x 0.50–0.75, y 0.37–0.57 | Sky, x 0.05–0.40, y 0.14–0.32                                              |
| 8a  | marker only: x 0.65–0.67, y 0.84–0.89            | (marker)                 | Lower-left fields, x 0.05–0.45, y 0.62–0.90                                |
| 8b  | none (Italy map ≈ x 0.55–0.95)                   | —                        | Left half, x 0.08–0.46, y 0.30–0.74                                        |

### Treatment (desktop)

"Contrast" is measured against the brightest 5% of background pixels in the zone, i.e. the worst
case under the text. The target is 4.5:1.

| #   | Recommended text colour                              | Contrast                     | Local contrast support                  | Navbar                                         | CTA                                  | Content level   |
| --- | ---------------------------------------------------- | ---------------------------- | --------------------------------------- | ---------------------------------------------- | ------------------------------------ | --------------- |
| 1   | Soft White headline, Titanium supporting             | SW 6.8, Ti 3.8               | **Yes, light**: ≤20% carbon, lower half | Transparent, Soft White (12.5:1)               | **Primary (Red) + WhatsApp**         | L3 full         |
| 2   | (optional label: Soft White)                         | label strip SW 8.4, Ti 4.7   | None                                    | Auto-hidden (transparent if shown: 8.8:1)      | Navbar only                          | L0 none         |
| 3   | Soft White / Titanium                                | SW 6.4, Ti 3.6               | **Yes, light**: as 1                    | Transparent (12.2:1)                           | **Primary + WhatsApp** (reveal hold) | L3 full         |
| 4   | —                                                    | —                            | None                                    | Auto-hidden (transparent if shown: 9.4:1)      | Navbar only                          | L0 none         |
| 5   | **Carbon** (one line)                                | Carbon 5.9 (SW would be 1.7) | None                                    | Hidden; **solid Carbon** on scroll-up          | Navbar only                          | L1 chapter line |
| 6   | **Carbon** (one line)                                | Carbon 8.4                   | None                                    | Hidden; solid Carbon on scroll-up              | Navbar only                          | L1 chapter line |
| 7   | **Carbon** (one line)                                | Carbon 6.7                   | None                                    | Hidden; solid Carbon on scroll-up              | Navbar only                          | L1 chapter line |
| 8a  | Soft White (+ Titanium); route cue in BSR Green      | SW 12.1, Ti 6.8              | None                                    | Hidden; solid Carbon on scroll-up (haze 2.0:1) | Navbar only                          | L1 route cue    |
| 8b  | Soft White / Titanium; Green only in the network art | SW 19, Ti 11                 | None                                    | Transparent (19:1)                             | **Closing primary + WhatsApp**       | L2 closing      |

The road-chapter line (today's state 5 line) should be held in the sky zone while its chapter is
on screen. Today it scrolls up through the frame, crossing the horizon.

### Mobile safe zones (390×844, portrait framing)

Phones take the media path (clips and stills, still development placeholders). These values come
from the real-time portrait framing, which the production phone media should be rendered from.
**Requirement for that media:** keep the truck within y ≈ 0.14–0.56, so the compact copy fits
below it.

| #   | Truck exclusion                          | Safe text region                                           | Contrast        | Navbar                            |
| --- | ---------------------------------------- | ---------------------------------------------------------- | --------------- | --------------------------------- |
| 1   | x 0–0.56, y 0.38–0.56 (cut at left edge) | y 0.61–0.95: **compact** (headline + primary CTA)          | SW 7.8, Ti 4.4  | Transparent (17:1)                |
| 2   | y 0.22–0.39                              | None by default (space from y 0.45)                        | SW 7.2, Ti 4.1  | Auto-hidden                       |
| 3   | y 0.38–0.55                              | y 0.61–0.95, compact; ≤15% bottom fade under supporting    | SW 6.3, Ti 3.6  | Transparent (16:1)                |
| 4   | y 0.27–0.49                              | None                                                       | —               | Auto-hidden                       |
| 5   | full width, y 0.22–0.53                  | y 0.74–0.95, one line, **Soft White** (sky has the poplar) | SW 8.5, Ti 4.8  | Hidden / solid Carbon (sky 3.6:1) |
| 6   | full width, y 0.23–0.51                  | y 0.74–0.95, one line, Soft White                          | SW 7.8, Ti 4.4  | Hidden / solid Carbon (2.8:1)     |
| 7   | full width, y 0.23–0.51                  | y 0.74–0.95, one line, Soft White                          | SW 7.6, Ti 4.3  | Hidden / solid Carbon (3.3:1)     |
| 8a  | marker, y 0.47–0.49                      | y 0.62–0.95                                                | SW 12.8, Ti 7.2 | Hidden / solid Carbon (2.0:1)     |
| 8b  | none (map in the top half)               | y 0.60–0.95: closing + CTA                                 | SW 19           | Transparent                       |

Add safe-area insets to every mobile zone.

## Existing layout conflicts (fix in the UI integration)

These are measured on today's layout with the real copy (`layout-conflicts.jpg`). All four are UI
fixes; none needs an art change.

- **C1. The copy fades too late (all desktop sizes).**
  - The trailer enters the copy column at p ≈ 0.44–0.45: its left edge goes 0.458 → 0.388 at
    1920, and 0.417 → 0.342 at 1440 and 1280.
  - At that point the copy is still 97–90% opaque; the fade (0.44 → 0.54, marked provisional in
    `hero-cinematic.tsx`) is only half done at 0.49. Headline and CTAs sit over the trailer.
  - **Fix:** finish the fade by 0.44, e.g. fade over 0.415 → 0.44, right after the reveal hold.
- **C2. 4:3 landscape (1024×768).**
  - The text reaches x 0.548, while the truck starts at 0.475: the supporting line and CTA row
    run into the truck.
  - **Fix:** cap the copy column at ≈ 0.44 × viewport width, and stack the two CTAs on
    standard-aspect viewports.
- **C3. Tablet portrait (820×1180).**
  - The copy layout switches on _width_ (≥48 rem gives the side column, vertically centred at
    x 0.04–0.68, y 0.32–0.74). The camera switches on _aspect_ and uses the portrait framing
    (truck x 0.05–0.54, y 0.38–0.56). The headline block covers the truck.
  - **Fix:** choose the copy layout by aspect or orientation too, so portrait gets the
    bottom-anchored compact copy at y ≥ 0.61.
- **C4. Narrow portrait windows on the real-time path (390×844).**
  - The copy starts at y 0.448, but the truck reaches y 0.56.
  - **Fix:** the compact copy starts at y ≥ 0.61. Keep the headline and primary CTA in the frame;
    move the supporting text, WhatsApp link and note below the hero, or reveal them later.

**Composition observation (art, locked — for decision only).** In the 4:3, narrow and portrait
camera framings, a near-camera dark dock/yard building volume enters the frame and hides the
cab. It is visible in C2–C4. The wide framing only shows a similar dark volume at its left edge
(1920 Preparation). This is outside the UI scope.

## Method

- **Capture.** Test-hooks production build, high tier, story frozen at each checkpoint, copy and
  scrim hidden. Viewports 1920×1080 and 390×844.
- **Silhouettes.** Truck and livery are exact: each was rendered alone, flat white on black, in
  the same frame.
- **Luminance and busyness.** Luminance is CIE L\*; busyness is Sobel edge density on L\*.
- **Contrast.** WCAG 2.x ratio against the brightest 5% of background pixels in the zone. Carbon
  on sky is checked against the darkest 5%, its worst case.
- **Local support.** The smallest carbon overlay alpha, composited in sRGB as CSS does, that
  reaches 4.5:1.
- **Temperature.** Mean-colour CIELAB b\* plus an approximate CCT (McCamy).
- **Conflicts.** Truck bounds were swept over progress 0.39–0.53 at 2560×1080, 1920×1080,
  1440×900, 1280×800, 1024×768, 820×1180 and 390×844. They were compared with the rendered
  copy's text extents.
