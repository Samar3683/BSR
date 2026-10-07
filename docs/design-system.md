# Design system

The BSR design system is premium and cinematic in presentation, industrial and precise in
character, and human-centred in interaction.

- **Live reference:** `/dev/design-system`. It is always on in `pnpm dev`. In production it is hidden
  unless `BSR_DESIGN_PREVIEW=true`, and it is marked noindex.
- **Sources of truth:**
  - `src/styles/tokens.css`: primitives and scales.
  - `src/styles/themes.css`: semantic roles per surface.
  - `src/styles/typography.css`: text styles.
  - `src/styles/utilities.css`: layout and interaction utilities.

## Colour

The BSR palette. Primary: Soft White `#F7F7F2` — the page's main background. Secondary: Deep
Italian Green `#0B6E45` (BSR Green; Active Green `#128453` for routes and progress). Accent: BSR
Red `#B32025` (Deep Red `#75191D` for its pressed state). Support: Carbon Black `#090B0B`, Graphite
`#121615`. Supporting light step: Warm White `#ECEDE7`; neutrals Titanium `#B8BDBA` and Neutral
Line `#D9DDDA`; pure White `#FFFFFF` for panels (forms, figures). No blue, purple, orange, cyan,
gold, neon, beige or cream outside photographs.

Visual weight: white dominant, green a strong secondary presence, red a small action emphasis,
black minimal — the hero, coverage, the final call to action, the footer and photographic scrims.
Never a dark website. Red and green have fixed meanings and never form flag stripes. Graphic
language, from the truck livery: sharp geometry, directional lines, controlled diagonal cuts. No
gradients except photographic scrims; no glow, no glass, shadows almost never (photography gives
the depth).

| Colour         | Meaning                                               | Never                                                  |
| -------------- | ----------------------------------------------------- | ------------------------------------------------------ |
| Red            | Action (CTA) and destination (where a route arrives)  | Decoration, large fields of colour, small text on dark |
| Green          | Movement: route, progress, positive operational state | Buttons or calls to action                             |
| Metal neutrals | Secondary text, borders (`line` on light surfaces)    | —                                                      |

`soft-white` (`#F7F7F2`) is also the text colour on dark surfaces and the 3D scene's mirror
(`src/lib/three/brand-colors.ts`, locked with the hero, parity-tested).

Components use **semantic roles** only (`bg-surface-elevated`, `text-text-muted`,
`border-border-strong`, `bg-action-primary`, `text-success`, …). Primitives (`carbon`, `red-500`, …)
feed the roles and are not used directly.

### Surfaces

Wrap a subtree in `<Surface tone="…">` (or `<Section tone="…">`). Every role then re-resolves:
text, borders, actions, status and focus.

| Dark (cinematic)        | Light (the page)                           | Brand                          |
| ----------------------- | ------------------------------------------ | ------------------------------ |
| `carbon` (page default) | `soft-white` (#F7F7F2, the main surface)   | `green` (BSR Green, `#0B6E45`) |
| `graphite`              | `warm-white` (#ECEDE7, rhythm)             |                                |
| `asphalt`               | `white` (#FFFFFF, photography and panels)  |                                |

On `green`, secondary text and graphics are pale greens (`green-50/100/200`) — never a lighter
green on green — and text is soft white (7.2:1).

Within a surface there are three layers:

- `background-primary`: the region itself.
- `surface-secondary`: grouped content.
- `surface-elevated`: raised panels.

Fields use `surface-field`. Depth on dark surfaces comes from a faint top highlight and deep
shadow; on light surfaces it comes from a contact shadow (`shadow-ambient`, `shadow-raised`,
`shadow-overlay`). Only floating layers get shadows. Interactive elements never do, because shadows
would clash with the focus halo. Translucency (`overlay-hover`, scrims) exists only where it
communicates state or preserves legibility. There is no decorative glass.

**Contrast** is enforced by `themes.test.ts` on all seven surfaces:

- Text roles: ≥ 4.5:1.
- Borders, focus and status graphics: ≥ 3:1.

Brand red `#B32025` is 2.96:1 on carbon, so on dark surfaces red text uses `danger` (`red-300`); red
destination marks there are decorative. The red fill carries white text at 6.2:1. Routes and
progress use `success-graphic` = Active Green (`green-600`) on every surface (≥ 3:1 on each; Iron,
the elevated dark panel, was darkened to keep it so).

## Typography

**Archivo** (SIL OFL), a single variable family with weight 100–900 and width 62–125. It is
self-hosted by `next/font`, uses the Latin subset (full Italian coverage), and has metric-matched
fallbacks. Display and stat styles use the expanded width, which gives an industrial, automotive
voice. Reading styles stay at normal width.

| Group    | Styles                                                                             |
| -------- | ---------------------------------------------------------------------------------- |
| Display  | `type-display-xl`, `type-display-lg` (hero only)                                   |
| Title    | `type-title` — a section's one headline, at most two lines (≈ 52px at 1440)        |
| Headings | `type-heading-xl`, `-lg`, `-md`, `-sm`                                             |
| Body     | `type-body-lg`, `-md`, `-sm`                                                       |
| Labels   | `type-label-lg` (buttons), `-md` (form labels, links), `-sm` (eyebrows, uppercase) |
| Figures  | `type-stat-xl`, `-lg` (tabular numbers)                                            |
| Support  | `type-caption`, `type-metadata` (uppercase, tabular: codes and timestamps)         |

- Choose the HTML element for document structure and the `type-*` class for visual hierarchy.
- Sizes are fluid (`clamp`, rem + vw), so they still respond to zoom.
- **Hierarchy:** eyebrow (`label-sm`, muted) → headline → supporting copy (`body-lg`, secondary) →
  metadata → primary CTA → secondary action.
- **Line length:** body copy always sits in a measure (`max-w-text-narrow` 32rem, `max-w-text`
  40rem, `max-w-text-wide` 48rem).

Below the hero the editorial system adds two faces and its own `ed-*` styles (Saira for
display capitals, IBM Plex Mono for technical labels) — see "Page composition (below the hero)".
The `type-*` styles above remain the hero's and the secondary pages'.

## Layout and spacing

- **Containers** (`<Container size>` or `container-*`): `text-narrow`, `text`, `text-wide`,
  `content` (80rem), `wide` (110rem), `full` (edge to edge). Use one container per region, and
  constrain text inside it with `max-w-text*`.
- **Grid** (`layout-grid`): 4 columns on small screens, 8 from `md`, 12 from `lg`, with a fluid
  `grid-gap`. Place items with `col-span-*`. Use flex or grid directly when that is simpler.
- **Spacing:**
  - Components use the 4px steps `1 2 3 4 6 8 12 16 24 32` (4–128px).
  - Layout spacing is fluid: `gutter`, `grid-gap`, and `section-sm` / `section` / `section-lg` (via
    `<Section spacing>`).
  - Prefer generous space over boxes and dividers.
- **Radius:** `sm` 2px (chips, checkboxes), `md` 4px (controls), `lg` 8px (panels). Pills
  (`rounded-full`) are for status badges only.
- **Breakpoints** (`sm` 40rem … `2xl` 96rem) change layout only. Rendering quality is a separate
  system (`lib/performance`).

### Information density

| Mode      | Where                   | Rule                                                                                                     |
| --------- | ----------------------- | -------------------------------------------------------------------------------------------------------- |
| Cinematic | Scene-driven sections   | One message at a time: display type, one supporting line, at most one CTA                                |
| Editorial | Services, explanations  | Moderate density: headings, body in a measure, figures, secondary actions                                |
| Task      | Booking, forms, contact | Highest clarity: no decoration, no scene motion, light or quiet surfaces, forms in `container-text-wide` |

On mobile, prioritise the task path and readability. Adapt cinematic richness instead of scaling
it down.

## Components

| Primitive                                              | Location                         | Notes                                                                                                                                                                                                                                                                                             |
| ------------------------------------------------------ | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Button`, `ButtonLink`, `IconButton`                   | `components/ui/button.tsx`       | Variants: `primary` (red, one per region), `secondary`, `ghost`, `inverse` (over imagery). Sizes: `sm` 40px (44px on touch), `md` 48px, `lg` 56px. States: hover, pressed (1px press, motion-safe), focus-visible, disabled, `loading` (`aria-busy`, keeps focus). `IconButton` requires `label`. |
| `TextLink`                                             | `components/ui/text-link.tsx`    | `inline` is always underlined. `utility` is for navigation; the current page gets `aria-current` plus a red underline. `action` has label weight and an arrow.                                                                                                                                    |
| `StatusBadge`                                          | `components/ui/status-badge.tsx` | Statuses: `active`, `in-transit`, `complete`, `available`, `delayed`, `error`, `inactive`. Always label + icon + tone.                                                                                                                                                                            |
| `Icon`                                                 | `components/ui/icon.tsx`         | Lucide outline only, 1.75px stroke at every size. Sizes: `sm` 16, `md` 20, `lg` 24. Uses `currentColor`. Decorative unless `label` is given.                                                                                                                                                      |
| `Field`, `Fieldset`                                    | `components/forms/`              | Label above the control, hint before it, message after it with icon and text. `required` is marked in words. ARIA wiring is included.                                                                                                                                                             |
| `TextInput`, `TextArea`, `Select`, `Checkbox`, `Radio` | `components/forms/`              | States: default, hover, focus, filled (same as default), disabled, read-only (dashed), error (`aria-invalid`), success (`data-state`). Selection uses the surface's ink, never red or green. Whole rows are 44px targets.                                                                         |
| `Container`, `Surface`, `Section`                      | `components/layout/`             | Width, environment and vertical rhythm.                                                                                                                                                                                                                                                           |
| `SectionHeader`                                        | `components/layout/`             | Chapter opening: hairline, index + eyebrow, `h2`, intro, at most one secondary action. `split` (label column on `lg`) or `stacked`; `heading` or `display` size. Point the section's `aria-labelledby` at its `id`.                                                                               |
| `Eyebrow`                                              | `components/layout/`             | The label that opens a chapter or block: an optional chapter index in the metadata style, then the label. Used inside `SectionHeader` and standalone.                                                                                                                                             |
| `Divider`                                              | `components/layout/`             | A hairline rule (`default` or `strong`). `aria-hidden`; semantics live in the heading it precedes.                                                                                                                                                                                                |
| `RouteMarker`                                          | `components/graphics/`           | The one recurring node in the route colour, marking a stage on a path. Always paired with a hairline or a labelled point — never decoration alone.                                                                                                                                                |
| `StatList`, `Stat`                                     | `components/data/stat.tsx`       | A `dl` of figures (value in `type-stat-lg`, label, optional detail). Confirmed figures only, never estimates.                                                                                                                                                                                     |
| `MediaSlot`                                            | `components/media/`              | The one media mechanism: a named slot at a fixed proportion (`16/9`, `3/2`, `4/3`, `4/5`, or `fill` for a background layer), fed a `SlotMedia` (image, or a decorative loop with a poster) from content config. Empty, it collapses (`:empty`) or shows a designed `fallback`.                    |
| `ProofList`                                            | `components/data/proof-list.tsx` | Claims as a headline plus an optional one-line detail, separated by hairlines. Supplied, confirmed points only.                                                                                                                                                                                   |
| `Thread`                                               | `components/graphics/`           | The page's route thread: a vertical line in the route colour ending on a node; draws downwards on entry. Out of the hero into chapter 01; into the final chapter.                                                                                                                                 |
| `BrandMark`                                            | `components/brand/`              | PLACEHOLDER typeset wordmark until the official logo is supplied; swap the inner markup, keep the component.                                                                                                                                                                                      |

**Cursor:** native cursors only. There is no custom cursor.

**Icons:** don't mix in filled icons, emoji or other icon sets.

## Focus

The focus style is `:focus-visible`. It has a 2px ring in the surface's `focus` colour (soft white
on dark, carbon on light) with a contrasting halo on both sides. The halo keeps it visible on dark,
light, red, green and imagery backgrounds. Never remove focus without replacing it with something
stronger.

## Motion

Motion is weighted, precise and controlled, with no bounce, springs or elastic effects.

- **Durations:**
  - `instant` 100ms
  - `fast` 160ms
  - `normal` 240ms
  - `slow` 400ms
  - `cinematic` 800ms
- **Easing:**
  - `ui`: state changes
  - `enter`: arrivals, decelerating
  - `exit`: departures, accelerating
  - `cinematic`: scene changes
  - `mechanical`: machinery with a decisive start and stop
- **Categories** (`MOTION_PRESET` for GSAP):
  - `micro`: fast, ui
  - `uiEnter`: normal, enter
  - `uiExit`: fast, exit
  - `reveal`: slow, enter
  - `section`: cinematic
  - `mechanical`: machinery
- **Scroll-linked motion** takes its pace from the user.
- **Controls:** use `transition-ui` for every control state change. Frequent interactions stay fast,
  and motion never blocks input.
- **GSAP** uses the registered eases (`bsr-ui`, `bsr-enter`, …) and `MOTION_PRESET`. Never hand-write
  bézier strings in sections.
- **Reduced motion** is a designed alternative:
  - Transforms and travel are gated with `motion-safe:`, or with `gsap.matchMedia()` using
    `REDUCED_MOTION_QUERY` / `FULL_MOTION_QUERY`.
  - Colour, opacity and state feedback remain.
  - Final states are shown immediately.
  - Lenis doesn't start.

## Layers

Use `z-(--z-*)` only:

| Layer          | Use                              |
| -------------- | -------------------------------- |
| `canvas`       | WebGL scene, beneath HTML        |
| `content`      | Page content                     |
| `cinematic-ui` | HTML synchronised with the scene |
| `sticky`       | Sticky in-page elements          |
| `navigation`   | Site navigation                  |
| `overlay`      | Scrims, drawers                  |
| `modal`        | Dialogs                          |
| `toast`        | Transient notifications          |
| `skip-link`    | Skip link, always on top         |

## Page composition (below the hero) — the film

Everything below the locked hero is one shipment told as a film: twelve acts, then the credits.
Every frame answers "where is the shipment now?" — origin, cargo, service, loading, security,
departure, the network, then trust, the person, the request and the arrival. The principle is
borrowed from the reference research (one journey, one visual system, large type, sparse frames,
moving objects, scroll-controlled transitions); never its colours, wording or illustrations.

The structure is `features/story/config/acts.ts`; the machinery is `features/story` and
`styles/cinematic.css`; the media slots and the assets to supply are in
`docs/cinematic-media-manifest.md`.

### The acts

| Act | Section | Where the shipment is | Frame | Pinned (desktop / phone) |
| --- | --- | --- | --- | --- |
| 01 Origine | `bsr` | Carpi | The hero's night turns to dawn; the truck drives out of Carpi along Carpi → Italia → Europa, the route drawing behind it; the statement inked; four large data markers, staggered | no (scrolls) |
| 02 Il carico | `settori` | the cargo | The cargo close-up fills the right half, the camera pulling back and reframing per sector; the four sectors in turn, the current one open | 3.4 / 3 viewports |
| 03 Il servizio | `servizi` | the choice | The truck in three-quarter view; ESPRESSO then DEDICATO running behind it as giant words; the mode's photograph and route; scrolling is the switch | 3 / — (phones scroll) |
| 04 Preparazione | `come-funziona` | the loading bay | A door opens on the bay, the camera walks in; the four steps over the picture with the route to the red destination; the frame turns green | 3.8 / 3.4 |
| 05 Sicurezza | `sicurezza` | secured | BSR green as atmosphere: glow, faint grid, a route drawing down the principles; the cargo cut like a trailer's open side; morning light at the end | no |
| 06 Partenza | `flotta` | the yard → the road | Van, rigid, articulated in turn; the camera pans to the road and the truck pulls away — far sheds, poplars, guardrail, lane markings sliding past, wheels turning, speed climbing; dusk | 4.6 / 4 |
| 07 La rete | `copertura` | Italy → Europe | Night: the aerial rises and falls away into the map; the camera pulls back Carpi → north → Italy → Europe as the routes draw and the destinations arrive in red; day returns from below | 3.8 / 3.4 |
| 08 Fiducia | `clienti`, `recensioni` | proof | The logo frame (consent only) and the invitation under a large quotation mark | no |
| 09 Le persone | `chi-siamo` | the person | Calm: "Una persona. Un contatto. Ogni spedizione.", the contact and the channels | no |
| 10 Richiesta | `richiesta` | the destination | The route arrives (the truck from above reaches the red pin); "Hai un carico da muovere?" and the quote starter | no |
| 11 Domande | `faq` | — | Three zones: the question, the numbered answers, the contact | no |
| 12 Arrivo | `preventivo` | arrived | The departure at dawn, pushing in; the whole route drawing to the red destination; "Il tuo carico. La nostra strada."; the request, WhatsApp, the phone | 2 / 1.8 |
| Credits | footer | — | Compact (≈ ⅓ viewport) | — |

About 30 viewports at 1440 × 900 including the hero.

### Continuity — how one act becomes the next

- **Same object:** the hero's truck becomes the small truck on the dawn route (01), the truck
  between the modes (03), the truck that departs (06); the cargo of 02 is the load of 04 and 05.
- **Same line:** the route of 01 → the services' routes (03) → the steps' route (04) → the road's
  lane markings (06) → the map's corridors (07) → the arrival (10) → the whole route (12).
- **Same light:** night (hero) → dawn (01) → day (02–03) → dusk in the bay (04) → green (05) →
  morning (06) → dusk and night (06 → 07) → day (08–11) → dawn (12).
- **Camera and scale:** close cargo (02) → medium truck (03) → wide bay (04) → truck close (05) →
  truck wide (06) → aerial and map (07).
- **No hard edges:** each act ends in the next one's light (04 → green, 05 → morning, 06 → dusk,
  07 → white from below, 09 → 10 soft gradients).

### Colour in the film

White and Soft White are the breathing space. Green is the story's signature: routes, progress,
origin, the dawn, the security atmosphere, the map. Red is the destination and the action only
(route ends, map destinations, the request). Carbon is the dramatic frame: the bay, the night map,
the last frame, the credits. No other hues; gradients only as light (dawn, glow, dusk).

### Type in the film

| Role | Utility | Size (phone → 1440) | Use |
| --- | --- | --- | --- |
| Statement | `cine-statement` | 42 → ≈ 93px (max 112) | the opening (01) and the close (12) |
| Act title | `cine-title` | 40 → ≈ 86px (often set smaller per act) | one per act |
| Step / scene heading | `cine-h3` | 30 → ≈ 56px | steps, modes, vehicles, stages |
| Figures | `cine-stat` | 52 → ≈ 82px | data markers |
| Giant word | `cine-giant` | 21vw | decorative, behind a scene (pinned only) |
| Body | `ed-lede`, `ed-body` | 15–19px | explanations |
| Technical | `ed-label`, `ed-meta` | 11–12px mono | act labels, indices, readouts, coordinates |

Saira at wide settings (`font-stretch` 112–125%) for the display voice; Archivo for reading; IBM
Plex Mono for the technical voice.

**Ink titles** (`InkTitle`): each line is set in `ink-muted` (≥ 3:1 on its surface, display sizes
only) and a darker copy is uncovered over it, left to right, as the act plays. Lines listed as
`muted` stay muted (the two-tone title). Text is never faded from invisible.

### Motion

- **One number per scene.** The `SceneDirector` writes `--p` (0 → 1); `seg` turns a share of it
  into `--t` / `--e` (eased) for an element; transforms, clips and opacity of pictures follow.
- **Steps** (`swap`): in a pinned act the items of each step share one place; the current one is
  shown, the others clipped and moved — time-based transitions triggered by the step, so text is
  never caught half-way.
- **Physical motion only:** the truck rolls (wheels turn with the scroll), accelerates, leaves;
  the camera pushes in, pulls back, pans; doors open; routes draw. No bounce, no floating loops; the
  only repeating motion is a destination ring that pulses three times when it arrives.
- **Visual silence:** after each pinned act a calmer frame (05 after 04, 08–11 after 07).
- **Reduced motion, no JavaScript, short screens:** nothing pins or scrubs; each act is a plain
  sequence at its final frame (all steps visible, titles inked, routes drawn).
- **Performance:** compositor properties only; the director works only for scenes near the
  viewport and never while the hero plays; no new library (Lenis and GSAP were already there; the
  film uses neither).

### Navigation in the film

The header keeps its behaviour (transparent over the hero, hidden scrolling down, back on the way
up). The **journey indicator** sits in the left margin on large screens (≥ 1280 × 640): one stop per
act — done green, current green with its number, next a hairline — names on hover or focus, the
shipment's state written vertically ("In viaggio"). Hidden over the hero.

### Rules that stay

- No card grids, no shadows as decoration; hairlines, mono labels, pill actions.
- Every fact on screen comes from the content files (docs/content-audit.md); act titles are
  narrative, never claims.
- Each photograph appears once; the truck cut-outs may recur (they are the protagonist).
- Every act keeps its anchor and its single h2; steps are real lists or articles.

## Text over cinematic media

Prefer composition first: place text where the scene is quiet. Then use a localised contrast
surface, or `scrim-bottom` / `scrim-top` in the surface's scrim colour. Use text shadow only as a
last resort. Text over motion must still meet 4.5:1 against the worst frame behind it.
