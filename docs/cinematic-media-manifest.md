# Cinematic media manifest — the film below the hero

The home page below the locked hero is one shipment told in twelve acts (structure:
`src/features/story/config/acts.ts`). This manifest lists every media slot of the film: what it
shows today (the fallback), what it should show, and the exact spec to photograph, film, render or
generate. **Nothing here blocks the site:** every slot already shows a fallback, and a missing or
failing asset never leaves a hole (see "How media degrades").

Priorities: **P0** required for cinematic quality · **P1** strongly recommended · **P2** enhancement ·
**P3** optional.

## How to replace an asset (no layout work)

| Kind of asset | Where it goes | What to change |
| --- | --- | --- |
| A photograph | `public/assets/images/content/scenes/final/<name>.webp` + `src/config/media-manifest.ts` (size) | the slot in `src/config/site-media.ts` (`scene("<name>", alt, focal)`) |
| A video loop over a photograph | `public/assets/video/<act>/<name>.mp4` (+ a 9:16 or 4:5 cut for phones) | add `motion: { kind: "video", src, mobileSrc }` to the slot in `site-media.ts` — the photograph stays as poster and fallback |
| An image sequence (scroll-scrubbed) | `public/assets/video/sequences/<name>/0001.webp …` (+ a lighter `…-mobile/` set) | add `motion: { kind: "sequence", pattern: "/assets/video/sequences/<name>/{0000}.webp", frames, mobilePattern, mobileFrames }` |
| A truck cut-out | `public/assets/images/content/cutouts/` | re-render with `pnpm assets:truck-cutouts` (from the GLB models) or replace the WebP with a photographic cut-out of the same view and framing, then update the placements in `src/config/cutouts.ts` |
| A sector's own photograph | as a photograph | set `siteMedia.sectors.<id>` — the act crossfades to it for that sector |

Rules that stay (tests enforce them): each photograph appears once on the page; only the live
livery (`scenes/final`), the maps and the truck cut-outs reach the page; every image has an alt
(meaningful, or empty when decorative) and loads lazily; no canvas or video is rendered below the
hero until a slot actually declares motion.

## How media degrades

- **Video:** loads only near the viewport, plays only while visible, pauses off screen; never under
  reduced motion or data saving; if it fails, it removes itself and the photograph stays.
- **Image sequence:** loads only near its act (first frame first, six at a time); draws the nearest
  loaded frame; phones load the lighter set; reduced motion and data saving draw nothing (the
  photograph stays); a failed frame is skipped.
- **Photograph:** sits on the surface colour of its frame (no white hole while loading).
- **No JavaScript / reduced motion:** nothing pins or scrubs; every act is a readable sequence at its
  final frame.

## The protagonist: truck cut-outs (C)

Rendered from the hero's own models (`public/assets/models/truck/bsr-tractor-high.glb` +
`bsr-trailer-high.glb`), so the film's truck is exactly the hero's truck: same livery, proportions,
wheels. Transparent WebP, studio light from the front left, no environment reflections of a place.

| ID | Asset (current) | Used in | Spec | Replace with (ideal) | Priority |
| --- | --- | --- | --- | --- | --- |
| C-01 | `cutouts/truck-side-tractor.webp`, `truck-side-trailer.webp` (rendered) | Act 01 (horizon), Act 06 (departure) | side elevation facing right, orthographic, 3154 × 768 box, layers registered | photographic cut-out of the real BSR tractor + trailer, exact side elevation, same layering (tractor / trailer / wheels), ≥ 5120 px wide | P1 |
| C-02 | `cutouts/truck-wheel-front.webp`, `-drive.webp`, `-trailer.webp` (rendered) | turning wheels (Acts 01, 06) | square crops centred on the hub, transparent | wheels of the real truck, hub centred, same scale | P2 |
| C-03 | `cutouts/truck-front34.webp` (rendered) | Act 03 (the two services) | three-quarter front, facing right, 22° lens, soft contact shadow, 1938 × 830 | studio or location cut-out of the real truck, front three-quarter from the right, eye level ≈ 1.6 m, ≥ 4000 px wide, clean BSR livery | P0 |
| C-04 | `cutouts/truck-top.webp` (rendered) | Act 10 (the arrival route) | top view facing right, 1748 × 302 | drone top view of the real truck on neutral asphalt, cut out | P3 |

## Media per act

Columns: **Current** = what the slot shows today · **Ideal** = what to supply · **Spec** =
orientation, minimum resolution, video length · **Camera / light / colour / motion** · **Bg / alpha**
= background, transparency needed · **Phone** = the phone version.

### ACT 01 — Origine (`#bsr`)

| ID | Purpose | Type | Current | Ideal | Spec | Camera / light / colour / motion | Bg / alpha | Phone | P |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| M-01 | The truck leaving Carpi on the horizon route | cut-out | C-01 (rendered) | C-01 photographic | 3154 × 768 | side; neutral studio light; moves along the route with the scroll | transparent | same image, smaller | P1 |
| M-02 | The dawn behind the route | gradient (CSS) | night → BSR green → White | optional: a dawn sky plate over the Po valley, very soft | 16:9 ≥ 3840 px | static; dawn; desaturated greens | — | 9:16 crop | P3 |

### ACT 02 — Il carico (`#settori`)

| ID | Purpose | Type | Current | Ideal | Spec | Camera / light / colour / motion | Bg / alpha | Phone | P |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| M-03 | The cargo close-up the camera pulls back from | photo | `wrapped-pallet` (reframed per sector) | a real BSR load at the Carpi dock: wrapped pallets, BSR trailer edge in the background | 4:5 and 16:9, ≥ 3840 px | close → medium; dock light, warm; slow scale with the scroll | full frame | 4:5 crop | P0 |
| M-04 | Industria | photo | shared stage (crop 1) | machinery or components on pallets, strapped, inside a BSR trailer | 4:5 ≥ 3840 px | medium close; industrial light | full frame | 4:5 | P1 |
| M-05 | Retail | photo | shared stage (crop 2) | roll cages / boxed retail goods at a store's loading door | 4:5 ≥ 3840 px | medium; morning light | full frame | 4:5 | P1 |
| M-06 | E-commerce | photo | shared stage (crop 3) | parcels on pallets in a warehouse, scanner, labels | 4:5 ≥ 3840 px | medium; cool warehouse light | full frame | 4:5 | P1 |
| M-07 | Aziende commerciali | photo | shared stage (crop 4) | mixed commercial load being handed over at a client's dock | 4:5 ≥ 3840 px | medium; daylight | full frame | 4:5 | P2 |

### ACT 03 — Il servizio (`#servizi`)

| ID | Purpose | Type | Current | Ideal | Spec | Camera / light / colour / motion | Bg / alpha | Phone | P |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| M-08 | The truck between the two modes | cut-out | C-03 (rendered) | C-03 photographic | ≥ 4000 px wide | front three-quarter; neutral; slides in, shifts with the mode | transparent | same, full width | P0 |
| M-09 | Espresso | photo / video | `express-motorway` | VIDEO 03: the BSR truck on an Italian motorway at speed, tracking shot | 16:9 ≥ 3840 px; video 6–10 s loop | side tracking, low; early morning sun; motion blur on the road | full frame | 4:5 | P1 |
| M-10 | Dedicato | photo / video | `dedicated-dock` | a single BSR truck loaded at a client's dock, doors closing — one load, one truck | 16:9 ≥ 3840 px; video 6–10 s | wide; blue hour; still camera | full frame | 4:5 | P1 |

### ACT 04 — Preparazione (`#come-funziona`)

| ID | Purpose | Type | Current | Ideal | Spec | Camera / light / colour / motion | Bg / alpha | Phone | P |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| M-11 | The loading bay the camera walks into (behind the four steps) | photo → video / sequence | `forklift-loading` | VIDEO 02 / SEQ-01: forklift lifting a wrapped pallet into the BSR trailer, dock door open | 16:9 ≥ 3840 px; video 8–12 s; or 120–180 frames scrubbed | wide, locked or slow push-in; dock lights at dusk; warm interior, cool exterior | full frame | 9:16 crop with the forklift centred | P0 |
| M-12 | Cargo secured in the trailer (step 3 detail) | photo | — (uses M-11) | straps being tensioned on wrapped pallets inside the trailer | 16:9 ≥ 3840 px | close detail; interior light | full frame | 4:5 | P2 |

### ACT 05 — Sicurezza (`#sicurezza`)

| ID | Purpose | Type | Current | Ideal | Spec | Camera / light / colour / motion | Bg / alpha | Phone | P |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| M-13 | Secured cargo, framed like a trailer's open side | photo / video | `secured-cargo` | VIDEO 06: inside a BSR trailer, pallets strapped, slow dolly along the load | 3:4 ≥ 3000 px tall; video 6–10 s | interior, symmetrical; cool white light; slow dolly | full frame | same | P0 |

### ACT 06 — Partenza (`#flotta`)

| ID | Purpose | Type | Current | Ideal | Spec | Camera / light / colour / motion | Bg / alpha | Phone | P |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| M-14 | Furgone | photo | `van` | the real BSR van, three-quarter front, at the Carpi base | 16:10 ≥ 3840 px | front ¾, eye level; soft daylight; same yard as M-15/M-16 | full frame | 4:3 | P0 |
| M-15 | Motrice | photo | `rigid-truck` | the real BSR rigid truck, same yard and angle as M-14 | 16:10 ≥ 3840 px | same as M-14 | full frame | 4:3 | P0 |
| M-16 | Articolato | photo | `articulated-truck` | the real BSR articulated truck, same yard and angle | 16:10 ≥ 3840 px | same as M-14 | full frame | 4:3 | P0 |
| M-17 | The departure: the truck drives off | cut-out + drawn road | C-01 + SVG skyline, poplars, guardrail, lane markings | VIDEO 01 or SEQ-02: the BSR truck pulling out of the depot onto the road, side tracking | 21:9 or 16:9 ≥ 3840 px; video 8–12 s; or 150–240 frames | side tracking at wheel height; morning; road and verge passing | full frame (or keep the cut-out and replace only the scenery) | 9:16 | P1 |
| M-18 | Road scenery layers (if kept as 2.5D) | SVG (drawn) | sheds, crane, poles, poplars, guardrail | photographic plates of the Po valley edge: industrial sheds, poplar rows, guardrail — three layers | each ≥ 6000 px wide, tileable | parallel to the road; flat morning light | transparent sky on the far and near layers | same | P2 |

### ACT 07 — La rete (`#copertura`)

| ID | Purpose | Type | Current | Ideal | Spec | Camera / light / colour / motion | Bg / alpha | Phone | P |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| M-19 | The aerial the camera rises from | photo / video | `coverage-aerial` | VIDEO 05: drone rising over a motorway in the Po valley at golden hour, the BSR truck small on it | 16:9 ≥ 3840 px; video 6–10 s | top-down tilting to oblique, rising; golden hour; warm fields, green | full frame | 9:16 | P1 |
| M-20 | The map | SVG (supplied) | `maps/coverage-geography-dark.svg` + route network | — (verified geography; keep) | 1800 × 1000 viewBox | camera zooms Carpi → north → Italy → Europe | — | same | — |

### ACT 08 — Fiducia (`#clienti`, `#recensioni`)

| ID | Purpose | Type | Current | Ideal | Spec | Camera / light / colour / motion | Bg / alpha | Phone | P |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| M-21 | Client marks | SVG logos | 8 empty cells, "Spazio logo" | monochrome SVG marks of clients with **written consent** (`network-content.ts`) | SVG, ≤ 40 px tall in use | — | transparent | same | P1 |
| M-22 | A review | text + optional portrait | invitation (no review) | a consented testimonial (`reviews-content.ts`), optional consented portrait | 1:1 ≥ 1200 px | portrait, natural light | — | same | P1 |

### ACT 09 — Le persone (`#chi-siamo`)

| ID | Purpose | Type | Current | Ideal | Spec | Camera / light / colour / motion | Bg / alpha | Phone | P |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| M-23 | The person behind every shipment | photo | `direct-contact` (illustrative, captioned so) | a real, consented photograph of the BSR contact at the base, phone in hand, truck behind | 4:3 and 4:5 ≥ 3840 px | medium; overcast daylight; natural | full frame | 4:5 | P0 |

### ACT 10 — Richiesta (`#richiesta`)

| ID | Purpose | Type | Current | Ideal | Spec | Camera / light / colour / motion | Bg / alpha | Phone | P |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| M-24 | The route arriving at the destination | cut-out + line | C-04 (rendered top view) | C-04 photographic | — | top view; runs to the red destination | transparent | same | P3 |

### ACT 11 — Domande (`#faq`)

No media by design (the answers are the content).

### ACT 12 — Arrivo (`#preventivo`)

| ID | Purpose | Type | Current | Ideal | Spec | Camera / light / colour / motion | Bg / alpha | Phone | P |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| M-25 | The last frame: the truck leaving at dawn | photo / video | `truck-departure` | VIDEO 07 / 01: the BSR truck driving away from the depot into the dawn, rear three-quarter | 16:9 ≥ 3840 px; video 8–12 s loop | rear ¾, low; dawn; warm sky, wet asphalt; slow push-in | full frame | 9:16 with the truck in the lower third | P0 |

## Video slots (future)

All: 4K preferred (3840 × 2160), 16:9 master, a 9:16 (or 4:5) crop for phones, 5–15 s, H.264 MP4
(and optionally WebM/AV1), no audio track, locked camera or one controlled move, clean BSR branding,
no unrelated vehicle dominating the frame, the same truck and livery throughout, colour graded to
the site (neutral highlights, deep greens, no teal-orange look).

| Video | Shot | Slot | Notes |
| --- | --- | --- | --- |
| VIDEO 01 | Truck leaving the depot | M-17 (Act 06), M-25 (Act 12) | side tracking for Act 06; rear ¾ for Act 12 |
| VIDEO 02 | Forklift loading cargo | M-11 (Act 04) | also as SEQ-01 (scrubbed) |
| VIDEO 03 | Truck on the motorway | M-09 (Act 03) | |
| VIDEO 04 | Close side tracking shot | M-17 alternative | wheels and livery close |
| VIDEO 05 | Italian countryside aerial | M-19 (Act 07) | rising drone |
| VIDEO 06 | Cargo secured in the trailer | M-13 (Act 05) | slow dolly |
| VIDEO 07 | Truck arriving at destination | M-25 alternative | |
| VIDEO 08 | Driver opening the trailer / delivery | Act 09 or Act 12 alternative | consented people only |

## Image sequences (optional)

| Sequence | Slot | Frames | Format | Notes |
| --- | --- | --- | --- | --- |
| SEQ-01 | M-11 forklift loading (Act 04) | 120–180 (phone 60–90) | WebP, 1920 px (phone 960 px) | scrubbed by the act's progress |
| SEQ-02 | M-17 truck pulling out (Act 06) | 150–240 (phone 80–120) | WebP, 1920 px (phone 960 px) | scrubbed; the truck may stay a cut-out over it |
| SEQ-03 | Truck turning 90°, top view | 60 | WebP with alpha | for a future map handoff |

## Photograph list for the shoot (brief §47)

P0: articulated truck on the road · loading at the dock · cargo preparation · the Carpi base / dock ·
departure · motorway journey · vehicle close-up · secured cargo · the contact person (consented) ·
the depot. P1: van in action · rigid truck in action · dedicated transport · express transport ·
Italian road aerial · northern Italy landscape · European route · destination arrival · driver at
work · cargo close-up. P2: wheel detail · trailer curtain · straps · pallet wrap · dock lights ·
road detail · countryside · industrial area · sunrise departure · arrival detail.

Every still: ≥ 3840 px on the long edge (5120 px+ preferred), 16:9 master plus 4:5 and 9:16 crops,
never upscaled or stretched; the same truck, livery, dirt level and light direction across the
film.

## Sound (not used)

Media components carry no audio. If sound is ever added (warehouse ambience, engine, road), it
must be opt-in, off by default, and never needed to understand anything.
