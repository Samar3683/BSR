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

## Page composition (below the hero)

One continuous transport story — cargo → request → planning → loading → transport → route →
delivery → trust → contact — told in photographs, type, data, route lines, motion and a human
contact. No WebGL, no pinning, no scroll hijacking, no snapping.

- **Order.** Hero → route transition → who BSR is → Servizi → Per chi lavoriamo → Come funziona →
  Flotta → Copertura → Sicurezza del carico → Clienti → Recensioni → Chi siamo → Preventivo (the
  request form) → FAQ → final call to action → compact footer.
- **One viewport per section.** 40–105 % of a 1440 × 900 viewport each (the two trust bands are
  short interludes). Every section says its purpose at once: a green eyebrow, a headline of at
  most two lines (`type-title` ≈ 52px, `type-title-lg` ≈ 60px for the company introduction and
  the close; 32–40px on phones), one supporting sentence (`type-lede`, 17–19px), then the visual.
- **A composition per chapter**, never the same card twice:

  | Section              | Composition                                                           |
  | -------------------- | --------------------------------------------------------------------- |
  | Who BSR is           | Promise + operational dashboard (figures on thin dividers)            |
  | Servizi              | Two split rows, photo ≈ 55% / promise ≈ 45%, mirrored, a route between |
  | Per chi lavoriamo    | Interactive rows beside one preview stage (accordion on phones)      |
  | Come funziona        | One wide photograph whose bottom edge is the 4-step progress route    |
  | Flotta               | Dominant stage, small tabs, details beside                           |
  | Copertura            | Facts beside the sequenced map, on Carbon                             |
  | Sicurezza del carico | Green editorial: one large photograph, principles on white rules      |
  | Clienti              | Trust statement, the sectors served as one route (logos when verified) |
  | Recensioni           | Real testimonials only; until then, a short invitation to talk        |
  | Chi siamo            | Documentary: large photograph, the person who answers, company facts  |
  | Preventivo           | Functional form: flat white panel, neutral fields, green in use       |
  | FAQ                  | Cinematic: motorway photograph fading into white, centred compact accordion, one open at a time (≈ 1 viewport) |
  | Final call to action | Full-bleed photograph, light Carbon scrim                             |
  | Footer               | Compact utility (≤ ⅓ viewport)                                        |

- **Surface rhythm.** Carbon hero and transition → Soft White (who BSR is) → White (services) →
  Warm White (sectors) → Soft White (journey) → White (fleet) → Carbon (coverage) → Green
  (security) → Warm White (clients) → White (reviews) → Soft White (who we are) → Warm White
  (request) → Soft White (FAQ) → photograph (close) → Carbon footer. No gradients between them.
- **Route motif — green is movement, red is arrival and action.** Each section owns its own
  piece: the transition draws Ritiro → Destinazione out of the hero; the dashboard's indicators
  switch on; the services are joined by Ritiro → In viaggio → Consegna; sector rows draw a green
  line; the journey fills along its photograph and ends on red; the map draws out of Carpi to red
  destinations; the clients' sectors run as one route; the close opens on a small route arriving
  on red; the header's solid bar carries a green rule ending on red.
- **CTA hierarchy.** Red only for the request: header, who BSR is, the reviews invitation, the
  close, the quick actions, the form's "Continua", each vehicle's request. The services' actions
  are outlined and turn red while the service is hovered or focused (red on touch screens).
  WhatsApp is outlined, or white on the close. The quick actions hide over `data-conversion`
  sections and the footer.
- **Media.** Every photograph is declared once in `src/config/site-media.ts` (by section, with
  alt text and a focal point per breakpoint) and appears once on the page — `site-media.test.ts`
  fails on a repeat, on a non-live livery, or on an unplaced photograph of the live set. Pictures
  are drawn by `MediaFrame` (frame → reveal → parallax → hover zoom → `MediaSlot`: responsive
  srcset, lazy loading, blur placeholder). Replacing the generated package with real BSR
  photography, or a picture with a video (`SlotMedia` `kind: "video"`: autoplay, muted, loop,
  playsInline, poster, reduced-motion fallback — not used yet), is an edit to that file only.
  Slots waiting for real photography: each sector's own preview (the four share one stage until
  then); planned shots — real van, rigid and articulated truck, loading, cargo, driver, warehouse,
  Italian motorway, the Carpi base, a consented portrait of the contact person (the current one
  is illustrative and captioned so).
- **Motion.** Transform, opacity and clip-path only; 150–250 ms for controls, 300–500 ms for
  images and rows, 500–900 ms for entries; no bounce or overshoot. GSAP stays inside the hero.
  - *Entries* (styles/motion.css, `RevealController`): one IntersectionObserver marks each
    `[data-reveal]` element as it enters; the reveal then plays to completion (never scrubbed,
    never left half-clipped) and replays after the element has left through the bottom — motion
    reverses, never sticks. `rise` for text, `left`/`right`/`bottom` clip reveals for pictures
    (one direction per section), `group` + the `pending:` variant for sequences (dashboard
    indicators, principles, routes). Hidden states apply only once the controller runs and only
    when motion is allowed; nothing is hidden without JavaScript or under reduced motion.
  - *Sequences*: the coverage map plays once (≈ 2.5 s): Carpi (pulses once) → Italy → cities →
    islands → European corridors → red destinations.
  - *Scroll-linked*: the journey's progress (one position read per frame, React state only on a
    step change); parallax ±3% on large screens only, never under reduced motion or on a
    low-power device (`html[data-motion-lite]`), nor while the hero is on screen
    (`html[data-hero-in-view]`: nothing below the hero may cost it frames); the hero transition's line.
  - *Stateful*: counters count up once (`CountUp`), the sector preview, the vehicle crossfade
    (500 ms, the new details fade in), the FAQ (exclusive `<details name>`, 360 ms, the plus
    turns half a revolution into a red minus), the quick actions.
- **Site header.** Fixed bar, `--header-height` (4.5rem). Transparent over the home hero (only
  when scripts run); elsewhere and once scrolled, solid White with dark text and the green → red
  route rule; hidden while scrolling down, back on scrolling up and on keyboard focus. The link
  of the section in view carries a green underline (`aria-current="location"`); sections with no
  link light nothing. Full navigation from `xl`, the menu below it.
- **Phones.** Headline, one sentence, the picture, the action. Split rows stack; the sector rows
  become an accordion (no hover-only content); the journey runs down the side; the dashboard is
  2 × 2; no parallax.

## Cinematic pass (second iteration — supersedes the table and header notes above)

The same story, directed more tightly: THE ROAD → THE LOAD → THE PEOPLE → THE SYSTEM → THE FLEET →
THE NETWORK → THE PROOF → THE PROMISE. Palette unchanged (Green is the brand, used much more; Red
is action only). Large type only at statement moments.

- **Type.** `type-statement` (≈ 56–72px) for each chapter's statement, `type-figure` (64–96px)
  for the trust numbers, `type-finale` (up to 96px) for the close. Everything else keeps the
  existing scale.
- **Compositions that changed.**

  | Section | Composition |
  | --- | --- |
  | Who BSR is | Soft White statement on a green marker; four figures that count up in sequence (200 ms apart) |
  | Servizi | Two transport lanes (`LaneTrack`): express (diagonal cut, speed stripe) and dedicated (inset frame); enter from opposite sides; hover/focus widens a lane ≈ 10 % and the other recedes; phones swipe with pagination |
  | Per chi lavoriamo | "The load": the stage bleeds to the right edge, opens like a bay door (`door` reveal), settles 1–2 % on scroll |
  | Come funziona | Signature: sticky stage left (one photograph panned per step, horizontal wipe, green route with a moving marker), four steps right; stacked on phones |
  | Flotta | Lateral mechanical track, swipe on phones |
  | Copertura | Carbon; routes draw in sequence, then a slow pulse on Carpi and destinations (`breathe`) |
  | Sicurezza | Green editorial: photograph bleeds left and rises across the carbon → green bridge, faint green grade |
  | Preventivo | Progressive disclosure (`BookingFlow`): service → route → sector, green progress line, red "Continua" |
  | Final CTA | Full-bleed, push-in, finale type, actions last |

- **Section bridges.** `SectionBridge` is a short gradient between two surfaces (white → carbon,
  carbon → green, green → warm white), so no section restarts the page.
- **Motion vocabulary** (styles/motion.css). Reveals: `rise`, `editorial` (slow, text wiped in
  line by line), `lane-left` / `lane-right`, `door`, `slide`, `left` / `right` / `bottom`,
  `group` + `pending:`. Utilities: `scroll-settle`, `scroll-push` (view-timeline, gated by
  `html:not([data-motion-lite]):not([data-hero-in-view])`), `breathe`, `stage-wipe`, `menu-in`.
  Text never fades; hidden states apply only once the controller runs and only when motion is
  allowed. No new library, no WebGL or canvas below the hero.
- **Header.** Transparent over the hero, then a compact carbon bar with blur and the green → red
  rule; the active link is green. The mobile menu is a full-screen green panel with a directional
  reveal (`menu-in`); Escape closes it.
- **Forms.** Closed steps are rendered closed from the server and are `invisible` + `inert`
  (so hydration never shifts the page); a `<noscript>` rule shows every step without JavaScript.
  Inputs are 48px tall, labels are always visible, errors are named and move focus to the first
  missing field.
- **Known limit.** `VehicleSelector` still renders the three vehicles stacked until the page is
  interactive, so the page height shrinks (≈ 4,400px) after hydration. Pre-dates this pass; a
  server-rendered tabbed layout would remove it.

## Text over cinematic media

Prefer composition first: place text where the scene is quiet. Then use a localised contrast
surface, or `scrim-bottom` / `scrim-top` in the surface's scrim colour. Use text shadow only as a
last resort. Text over motion must still meet 4.5:1 against the worst frame behind it.
