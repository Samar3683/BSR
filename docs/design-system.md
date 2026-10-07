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

## Page composition (below the hero) — the editorial system

Phase 2B rebuilt everything below the locked hero as one continuous shipment story, told in twelve
marked chapters, a close and a compact footer. The principles borrowed from the reference research
(United Carriers and the supplied logistics references) are editorial composition, asymmetry,
controlled type, hairlines, technical labels, large photographic moments and restrained motion —
never their colours, layouts, wording or illustrations. BSR stays BSR: White dominates, Green is
route and state, Red is the request and the destination, Carbon is rare.

### Story and surfaces

| #  | Chapter (anchor)                   | Question it answers                     | Surface    | Composition                                                                                           |
| -- | ---------------------------------- | --------------------------------------- | ---------- | ----------------------------------------------------------------------------------------------------- |
| —  | Route transition                   | (out of the hero)                       | Carbon     | Ritiro → Destinazione drawn on a hairline, diagonal cut into White                                    |
| 01 | Chi è BSR (`bsr`)                  | What is BSR?                            | White      | Statement left; proof as technical data stacked right (count-up); route Carpi → Italia → Europa      |
| 02 | Servizi (`servizi`)                | How does BSR transport?                 | Soft White | Two service stories beside one stage that crossfades to the service in play; Ritiro → Consegna route  |
| 03 | Per chi lavoriamo (`settori`)      | Is BSR relevant to me?                  | White      | Large list (index, sector, line, arrow) beside a stage that reframes per row; accordion on phones    |
| 04 | Come funziona (`come-funziona`)    | What happens after I contact you?       | Soft White | One photograph band, one green route through four steps, driven by the scroll (no pinning)            |
| 05 | Flotta (`flotta`)                  | Which vehicle will handle it?           | White      | Photograph bleeding left, mono tabs with a sliding marker, verified figures only                      |
| 06 | Copertura (`copertura`)            | Where can you take it?                  | Carbon     | Reach as three figures, routes with indicative times, the BSR map played once                         |
| 07 | Sicurezza del carico (`sicurezza`) | Can I trust you with it?                | Soft White | Cargo photograph bleeding left; four principles on hairlines joined by a green route                  |
| 08 | Clienti (`clienti`)                | Who already works with you?             | White      | Statement and consent policy; hairline logo grid with corner ticks (empty, labelled, until approved)  |
| 09 | Recensioni (`recensioni`)          | What do customers say?                  | Soft White | Until consented reviews exist: "La prossima storia potrebbe essere la tua." + WhatsApp, request, call |
| 10 | Chi siamo (`chi-siamo`)            | Who is behind the service?              | White      | Three-line statement, titolare, channels as a technical list, company data; photograph bleeding right |
| 11 | Preventivo (`richiesta`)           | How do I request it?                    | Soft White | Three questions; quote starter: Partenza ● → Destinazione ◆, service pills, sector, red request       |
| 12 | Domande frequenti (`faq`)          | What am I still unsure about?           | White      | Label + question left, numbered list centre, contact prompt right; no photograph                      |
| —  | Close (`preventivo`)               | What should I do now?                   | Photograph | Departure at dawn under a controlled overlay; statement, red request, white WhatsApp, phone          |
| —  | Footer                             | Where is everything?                    | Carbon     | Brand, contacts, site, company data; ≈ ⅓ viewport                                                     |

### Grid, rhythm, height

- `ed-frame`: full width up to 110rem with an 18px → 64px page edge. `ed-grid`: 4 columns on phones,
  8 from `md`, 16 from `lg`. Content sits far left, centre-left or right; pictures may run to the
  viewport edge (`ed-bleed-l`, `ed-bleed-r`) — chapters clip horizontal overflow.
- `Chapter` (components/editorial/chapter.tsx) gives every chapter the same rhythm
  (`--spacing-chapter`) and opens it on the `ChapterMark`: a hairline whose green segment draws as
  the chapter arrives, "04 / 12", the chapter's name, and technical context on the right.
- Height at 1440 × 900 (measured): 0.46–1.06 viewport per chapter; footer 0.35. Tablets and phones
  may run taller, never by stacking desktop compositions blindly: phones lead with the headline,
  then the picture, then the detail.

### Type — three voices (styles/editorial.css)

| Voice     | Face           | Utilities                                                      | Use                                    |
| --------- | -------------- | -------------------------------------------------------------- | -------------------------------------- |
| Display   | Saira, capitals | `ed-statement` (≈ 68px), `ed-h2` (≈ 53px), `ed-h3` (≈ 33px), `ed-h4`, `ed-stat` | statements, headings, figures |
| Reading   | Archivo        | `ed-lede`, `ed-body` (15–17px), `ed-small` (14px)              | copy, forms                            |
| Technical | IBM Plex Mono  | `ed-label` (12px), `ed-meta` (11px), `ed-action` (12px)        | labels, indices, metadata, actions     |

The hero keeps its own `type-*` styles and fonts; the new faces are separate variables
(`--font-tech`, `--font-label`) so nothing in the locked hero changes. Saira is not preloaded.

### Lines, marks, actions

- Hairlines are 1px: `border-hairline` / `border-hairline-strong` resolve per surface
  (rgba(9,11,11,.10/.16) on light, rgba(255,255,255,.15/.24) on dark). `ed-ticks` draws corner
  ticks (logo grid only). Form controls keep `border-strong` for 3:1 non-text contrast.
- `Label`: mono capitals opened by a green dot (state, route) or a red diamond (destination).
- `RouteLine`: a hairline with a green line drawing over it, green nodes, a red destination.
- `ActionLink` / `ActionButton` (components/editorial/action.tsx): pills in mono capitals —
  `primary` red (one per region), `outline`, `inverse` (soft white over photographs or Carbon),
  `quiet` (text + arrow on a hairline). The hero keeps its own buttons.
- No card grids, no shadows; radius 0–4px except pills.

### Motion

Transform, clip-path and scale only for content; text never fades (axe checks contrast at load, and
a mid-fade state fails it). Reveals (`rise`, `left`, `right`, `bottom`, `group` + `pending:`) play
once per entry from the one IntersectionObserver (`RevealController`). Interaction: 180–300ms for
controls, 500–900ms for picture crossfades and route lines. The process journey reads the scroll
once per frame into `--p` (listener attached only near the chapter; nothing while the hero plays).
The coverage map plays once; nothing loops. Reduced motion: no parallax, no counting, no route
drawing, no crossfade — final states at once.

### Header and quick actions

Transparent over the hero; elsewhere and once scrolled back up a White bar (64px, hairline, light
blur) with mono navigation, a green underline on the chapter in view and a red pill. Without
JavaScript it is solid. Phones: logo, menu, request (the full-screen menu is green with mono
indices and pills). The quick actions are a White bar on phones (request + WhatsApp) and a small red
pill on desktop, hidden over the request, the close and the footer.

### Media

Every photograph is declared once in `src/config/site-media.ts` (11 in the live livery, all placed,
each once — `site-media.test.ts`). The FAQ no longer uses a photograph, so the red-livery exception
is gone. Media slots accept `kind: "video"` later without layout work. Slots waiting for real
photography: each sector's own picture (the four share one stage, reframed per row), real fleet,
loading, cargo, the Carpi base, a consented portrait (the current one is illustrative and captioned
so).

## Text over cinematic media

Prefer composition first: place text where the scene is quiet. Then use a localised contrast
surface, or `scrim-bottom` / `scrim-top` in the surface's scrim colour. Use text shadow only as a
last resort. Text over motion must still meet 4.5:1 against the worst frame behind it.
