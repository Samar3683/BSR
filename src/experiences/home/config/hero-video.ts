import { assetUrl } from "@/config/assets";

import { heroContent } from "./hero-content";
import { HERO_VIDEO_MEDIA } from "./hero-video-media";

/*
 * The scroll-scrubbed video hero — the single place its media, scroll length,
 * framing and text cues are configured. Media facts (duration, frame rate,
 * size) are measured by scripts/prepare-hero-video.mjs (./hero-video-media.ts);
 * the runtime reads the real duration from the loaded file and uses these only
 * until it arrives.
 *
 * Cue times are in seconds of FOOTAGE, read from the actual 15 s video
 * (docs/hero-video.md): they stay right when the scroll length changes, and
 * need re-checking only if the footage is replaced.
 *
 *   0.0–2.0  departure from the dock (cab right, dock building left)
 *   2.0–4.5  tracking along the trailer — BSR wordmark at the LEFT of frame
 *   4.5–7.0  trailer wipe — the wordmark fills the frame
 *   7.0–9.5  empty motorway at sunrise
 *   9.5–11   the truck enters from the right
 *   11–15    wide: truck on the right, open sky and road on the left
 */

export interface HeroVideoCue {
  id: string;
  /** Footage seconds: fully visible from `from` to `to`, fading over `fade` either side. */
  from: number;
  to: number;
  label: string;
  text: string;
  /** Show the primary request link with the cue. */
  action?: boolean;
}

export const HERO_VIDEO = {
  src: {
    /** ≤ 1080 p, desktop and tablets. */
    full: assetUrl("video", "bsr-hero.mp4"),
    /** 720 p: compact layouts and slow connections (Network Information API). */
    compact: assetUrl("video", "bsr-hero-720.mp4"),
  },
  /** The encoded video's own first frame (scripts/prepare-hero-video.mjs). */
  poster: {
    src: assetUrl("images", "hero/bsr-hero-poster.jpg"),
    width: HERO_VIDEO_MEDIA.width,
    height: HERO_VIDEO_MEDIA.height,
  },
  media: HERO_VIDEO_MEDIA,
  /**
   * Scroll distance the hero stays pinned for (beyond its own viewport). About
   * 8 px of scroll per frame on a 900 px desktop: fine-grained scrubbing without
   * a long trudge. Reduced motion, no JavaScript and the static fallback use none.
   */
  scroll: { regular: "320svh", compact: "240svh" },
  /**
   * Progress held on the first and last frame (fractions of the pinned scroll): the
   * opening reads before anything moves, the ending holds while the hero releases.
   */
  hold: { start: 0.03, end: 0.1 },
  /** object-position for both the poster and the video (identical framing: no jump). */
  framing: {
    regular: "60% 50%",
    compact: "66% 50%",
    /**
     * Compact screens see about a quarter of the frame's width: the crop follows the
     * subject (footage s → horizontal object-position %, linear between keys). Read from
     * the footage: the cab (0–2 s), the trailer wordmark passing left (3–6.5 s), the
     * sunrise (8–9 s), the truck entering right (10 s) and its front (12 s →).
     */
    compactTrack: [
      [0, 66],
      [2.2, 66],
      [3.2, 10],
      [4.2, 16],
      [5.2, 27],
      [6.0, 24],
      [6.6, 48],
      [7.6, 62],
      [8.8, 76],
      [10.2, 86],
      [12, 62],
      [15.1, 60],
    ] as ReadonlyArray<readonly [number, number]>,
  },
  /** The headline block leaves before the trailer's wordmark passes under it (footage s). */
  copyFade: { from: 1.3, to: 2.0 },
  /** Fade length either side of a cue (footage s). */
  cueFade: 0.35,
  cues: [
    {
      id: "strada",
      from: 7.4,
      to: 9.3,
      ...heroContent.cues.road,
    },
    {
      id: "arrivo",
      from: 11.2,
      to: Number.POSITIVE_INFINITY,
      ...heroContent.cues.arrival,
      action: true,
    },
  ] satisfies HeroVideoCue[],
  /**
   * Loading: the poster stays until a decoded frame at the visitor's position is
   * presented. Without one in this time the hero settles as a static hero (and
   * releases its pinned scroll) instead of trapping the visitor on a still.
   */
  readyTimeoutMs: 10_000,
} as const;
