import { assetUrl } from "@/config/assets";
import type { RealtimeQuality } from "@/lib/performance/quality";

import { HERO_CAPTURES } from "./hero-captures";

/*
 * Hero asset manifest — the single place hero asset paths are declared.
 *
 * Stills and phone clips are captured from the real-time scene itself
 * (scripts/capture-hero-stills.mjs): the poster and the ladder show exactly
 * the frames the real-time hero takes over from. Re-capture them whenever the
 * scene, the truck or the camera changes; the script also writes the hashed file
 * names (./hero-captures.ts) read here. Real-time models are the production
 * GLBs below; a `null` model makes the runtime build contract-compliant
 * placeholder geometry in code (tests, missing assets).
 */

export type HeroStillId = "S1" | "S2" | "S3" | "S4";

export interface HeroStillCrop {
  src: string;
  width: number;
  height: number;
  /** CSS object-position keeping the truck in its safe zone under cover-cropping. */
  objectPosition: string;
}

export interface HeroStill {
  id: HeroStillId;
  checkpoint: "opening" | "hold" | "road" | "route";
  /** Wide / standard layouts (landscape art direction). */
  wide: HeroStillCrop;
  /** Compact layout (portrait art direction). */
  compact: HeroStillCrop;
  placeholder: boolean;
}

function still(id: HeroStillId, checkpoint: HeroStill["checkpoint"]): HeroStill {
  const files = HERO_CAPTURES.stills[id];
  return {
    id,
    checkpoint,
    wide: {
      src: assetUrl("images", `fallback/hero/${files.wide}`),
      width: 2560,
      height: 1440,
      objectPosition: "62% 50%",
    },
    compact: {
      src: assetUrl("images", `fallback/hero/${files.compact}`),
      width: 1080,
      height: 1920,
      // Captured in the portrait framing bucket: centred, the truck stays clear of the copy.
      objectPosition: "50% 50%",
    },
    placeholder: false,
  };
}

/** S1 is the poster (LCP); S1–S4 form the still ladder. */
export const HERO_STILLS: readonly HeroStill[] = [
  still("S1", "opening"),
  still("S2", "hold"),
  still("S3", "road"),
  still("S4", "route"),
];

/** Media query selecting the compact (portrait) crop — mirrors the compact layout. */
export const COMPACT_MEDIA_QUERY = "(max-width: 47.99rem)";

export type HeroClipId = "A" | "B";

export interface HeroClip {
  id: HeroClipId;
  /** Ordered: the browser picks the first playable source. */
  sources: ReadonlyArray<{ src: string; type: string }>;
  /** Still shown once the clip has played, been skipped or been cancelled. */
  finalStill: HeroStillId;
  placeholder: boolean;
}

/** Portrait 720 × 1280, 30 fps, rendered from the real-time scene: AV1 first, H.264 fallback. */
function clip(id: HeroClipId) {
  const files = HERO_CAPTURES.clips[id];
  return [
    { src: assetUrl("video", `hero/${files.av1}`), type: 'video/mp4; codecs="av01.0.05M.08"' },
    { src: assetUrl("video", `hero/${files.h264}`), type: 'video/mp4; codecs="avc1.640032"' },
  ];
}

export const HERO_CLIPS: Record<HeroClipId, HeroClip> = {
  // S1 (opening) → S2 (reveal hold).
  A: { id: "A", sources: clip("A"), finalStill: "S2", placeholder: false },
  // S2 (hold) → departure → road → S4 (Italy).
  B: { id: "B", sources: clip("B"), finalStill: "S4", placeholder: false },
};

export interface HeroModelSet {
  tractor: string | null;
  trailer: string | null;
  dock: string | null;
  roadKit: string | null;
}

/**
 * Per-tier model URLs (GLB + Meshopt + KTX2; see docs/hero-asset-pipeline.md).
 * `null` = build the development placeholder for that element. Production
 * assets are validated with `pnpm assets:validate-model` before they go here.
 */
function truck(tier: RealtimeQuality): HeroModelSet {
  return {
    tractor: assetUrl("models", `truck/bsr-tractor-${tier}.glb`),
    trailer: assetUrl("models", `truck/bsr-trailer-${tier}.glb`),
    dock: null,
    roadKit: assetUrl("models", `road/bsr-roadkit-${tier}.glb`),
  };
}

// Production truck (tractor + trailer, approved livery) and road kit; the dock is still procedural.
export const HERO_MODELS: Record<RealtimeQuality, HeroModelSet> = {
  high: truck("high"),
  medium: truck("medium"),
  low: truck("low"),
};

/** Approved transfer budgets live with the GPU budgets (shared with the asset validator). */
export { HERO_TRANSFER_BUDGETS } from "./hero-budgets";
