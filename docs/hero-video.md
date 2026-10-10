# Video hero

The home hero is one photorealistic video (Higgsfield, 15 s) scrubbed by the scroll: scrolling
down advances it, scrolling up reverses it, and stopping holds the frame. The headline and
actions are HTML over the footage. It replaces the visible Three.js hero; that code is no longer
mounted (see "Old renderer" below).

## Files

| Path                                                                   | Role                                                                     |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `public/assets/video/bsr-hero-source.mp4`                              | Source footage. Never modified by the tooling.                           |
| `public/assets/video/bsr-hero.mp4`                                     | Scrub file, ≤ 1080 p (desktop, tablets)                                  |
| `public/assets/video/bsr-hero-720.mp4`                                 | Scrub file, 720 p (compact layouts, 3G)                                  |
| `public/assets/images/hero/bsr-hero-poster.jpg`                        | First frame of the encoded file: poster and LCP                          |
| `scripts/prepare-hero-video.mjs`                                       | Encodes the above and writes `config/hero-video-media.ts`                |
| `src/experiences/home/config/hero-video.ts`                            | **The configuration**: sources, scroll length, holds, framing, cue times |
| `src/experiences/home/config/hero-content.ts`                          | Hero copy, including the cue lines                                       |
| `src/experiences/home/motion/video-scrub.ts`                           | Progress → frame mapping and the seek queue (unit-tested)                |
| `src/experiences/home/components/hero-video.tsx`                       | Client island: loading, ScrollTrigger, reveal, fallbacks                 |
| `src/experiences/home/components/hero-section.tsx` + `hero.module.css` | Server shell and layout                                                  |

## Replacing or re-encoding the footage

Put the new source at `public/assets/video/bsr-hero-source.mp4` (any format ffmpeg reads), then:

```bash
pnpm assets:hero-video          # = node scripts/prepare-hero-video.mjs
```

Requirements: `ffmpeg` and `ffprobe` on the PATH, ffmpeg with `libx264` (macOS:
`brew install ffmpeg`). The script prints the source's duration, size, frame rate and codec,
never upscales, and writes:

- H.264 High, yuv420p, BT.709-tagged, **no audio**, `+faststart`, CRF 23 (1080 p) / 24 (720 p);
- a **closed 12-frame GOP** (0.5 s at 24 fps), no scene-cut keyframes;
- the poster from the encoded file's first frame (so the handoff never shifts colour or framing);
- `config/hero-video-media.ts` (duration, fps, frames, sizes).

Why this GOP: every scroll position is a seek, often backwards, and a seek decodes from the
previous keyframe. Measured in Chromium on an M3 Pro (fully buffered, seek → frame presented):

| Encode                           | Size    | Reverse scrub p50 / max | Random jump p50 / max |
| -------------------------------- | ------- | ----------------------- | --------------------- |
| Source (2 keyframes in 15 s)     | 27.2 MB | 158 / 210 ms            | 102 / 200 ms          |
| 1080 p, GOP 12, CRF 23 (shipped) | 8.1 MB  | 16.6 / 17.5 ms          | 16.7 / 17.5 ms        |
| 1080 p, GOP 24                   | 7.5 MB  | 16.7 / 19.3 ms          | 16.7 / 17.5 ms        |
| 1080 p, all-intra                | 17.0 MB | 16.7 / 43.8 ms          | 16.7 / 17.5 ms        |
| 720 p, GOP 12, CRF 24 (shipped)  | 3.3 MB  | 16.7 / 17.6 ms          | 16.6 / 18.1 ms        |

A fast desktop cannot tell GOP 12 from 24; 12 bounds the work per seek on slower phone decoders
(≤ 11 frames). All-intra doubles the size for no measured gain.

After replacing the footage, **re-read it and re-time** `cues`, `copyFade` and
`framing.compactTrack` in `config/hero-video.ts` — they are in seconds of footage.

## Footage map (current file)

| Footage s  | Scene                                                | Text                                                                             |
| ---------- | ---------------------------------------------------- | -------------------------------------------------------------------------------- |
| 0–2.0      | Departure from the dock, cab on the right            | Headline, lead, actions (fade out 1.3–2.0 s)                                     |
| 2.0–4.5    | Tracking along the trailer, BSR wordmark at the left | none — the wordmark would sit under the headline                                 |
| 4.5–7.0    | Trailer wipe, the wordmark fills the frame           | none                                                                             |
| 7.4–9.3    | Empty motorway, sunrise                              | "In viaggio — Dal ritiro alla destinazione."                                     |
| 9.5–11     | The truck enters from the right                      | none                                                                             |
| 11.2 → end | Wide: truck right, sky and road left                 | "Italia · Europa — In tutta Italia e sulle principali tratte europee." + request |

The footage shows morning light rather than blue hour, and has no map; the coverage map below
the hero is unchanged.

## How scrubbing works

- **One progress value**: one ScrollTrigger on the section (`top top` → `bottom bottom`) feeds the
  existing `ProgressController` (jump catch-up ≤ 350 ms). It runs on the GSAP ticker, the page's
  only animation clock; Lenis already smooths the wheel, so nothing else is eased on top.
- **Progress → frame**: the first 3 % and last 10 % hold the first and last frames; between them,
  time is linear. Targets are whole frames, seeked at the frame's middle and never past the last
  decodable frame (`seekTime`, `lastFrame`).
- **Seek queue** (`VideoScrubber`): the video is paused, muted, `playsInline` and never plays. At
  most one seek is in flight; the newest target is kept and every completed seek (`seeked`)
  catches up to it, so fast scrolls and direction changes never queue up and the frame converges
  on the scroll position when scrolling stops. A dropped seek is retried after 1.2 s.
- **Per frame** only DOM writes when a value changes: `--hero-copy-opacity`, `--hero-scrim`, cue
  opacity and `inert`, and on compact screens `--hero-framing`. No React state.
- **Off screen** the update stops — after one last update, so the video is left on the right
  frame.

## Loading and reveal

The poster and the HTML are server-rendered; the video starts loading as soon as the island
hydrates (no `window.load` or idle wait), `preload="auto"`. It is revealed only after the first
completed seek **to the visitor's current position** has been presented
(`requestVideoFrameCallback` where it exists, two animation frames after `seeked` otherwise — never
rVFC alone, which some engines do not fire for paused seeks). A reload or scroll mid-hero therefore
never shows frame 0 first. Cues stay hidden until the video is revealed. A muted play/pause primes
browsers that do not decode a paused video until it has played.

## Fallbacks — the static hero

One viewport, the poster and the copy, no pinned scroll, no cues:

| Condition                                                                | How                                                                  |
| ------------------------------------------------------------------------ | -------------------------------------------------------------------- |
| No JavaScript                                                            | `<noscript>` rule in the hero                                        |
| `prefers-reduced-motion: reduce`                                         | CSS (no video element, no download); also when it turns on mid-visit |
| Save-Data, 2G                                                            | detected before loading — nothing downloaded                         |
| Missing file, decode error                                               | `error` → static                                                     |
| No frame within 10 s (`readyTimeoutMs`) — slow network, blocked playback | timeout → static                                                     |

Switching to static releases the pinned distance without moving what the visitor sees: past the
hero the page keeps its place; inside the hero the visitor lands on the static hero.

## Layout

- **Wide** (≥ 48rem and wider than 4:5): footage fills the stage (`object-position 60% 50%`);
  copy and cues on the left over a scrim that follows their opacity; a top shade protects the
  header and a bottom edge fades into Carbon for the section that follows.
- **Compact** (narrower, or portrait tablets): a full portrait crop would put the truck behind
  the headline, so the footage sits in a band above the copy (height = screen − copy, measured
  by a ResizeObserver). Once the headline has left, the band opens to the full screen (one
  560 ms transition) and the cues sit at the bottom. Compact screens see about a quarter of the
  frame's width, so the crop follows the subject (`framing.compactTrack`): the cab, then the
  trailer wordmark through the wipe, the sunrise, the truck's front.

## Validation (10 October 2026, M3 Pro, `next start` production build)

- Unit: `video-scrub.test.ts` (timing, clamps, seek queue, retries, direction changes).
- E2E (`tests/e2e/hero.spec.ts`, desktop + Pixel 7 emulation): shell without JS, scrubbing and
  held frames, copy/cue behaviour and `inert`, no old-renderer requests, reduced motion, missing
  video. Full suite 112 passed, 3 consecutive runs.
- Scripted browser checks (Chromium on the GPU): held frame correct after slow, fast, reverse,
  six direction changes, End/Home (8/8); frame time p99 16.8 ms while scrubbing; one
  ScrollTrigger; no `.glb`/KTX2/three.js chunk loaded; scroll before the video was ready → revealed
  directly at the visitor's frame (one seek); mid-page reload → same position and frame; resize
  between layouts; missing video at load, mid-hero and after the hero; never-arriving video →
  static after 10 s; Save-Data; React Strict Mode (`next dev`): one trigger, one video, no errors.
- WebKit (Playwright 27.2, macOS media stack — the Safari engine, not Safari): held frame
  correct after 11/11 gestures. Headless WebKit frame times (p99 75 ms) are not representative of
  Safari on a device.
- `next start` serves the MP4 as `video/mp4` with `Accept-Ranges: bytes` (206 for ranges).

Not verified: Safari and iOS on real devices (iOS Low Power Mode may refuse the priming play →
static fallback after 10 s), Android Chrome on a device, the production host's MIME type and
range support (check `curl -I` and a `Range` request on the deployed URL).

## Old renderer

`HeroCinematic` and everything only it used (the Three.js scene, runtime, frame driver, still
ladder, phone clips, `hero-assets.ts`, the GLB/KTX2 assets under `public/assets/models` and
`textures`, `public/assets/images/fallback/hero`, `public/assets/video/hero`,
`scripts/capture-hero-stills.mjs`) is no longer imported by the page: nothing of it is downloaded.
It is kept in the repository until the video hero is approved; deleting it is a separate change.
