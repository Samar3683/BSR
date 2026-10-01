import { assetUrl } from "@/config/assets";
import type { RealtimeQuality } from "@/lib/performance/quality";

/*
 * Hero asset manifest — the single place hero asset paths are declared.
 *
 * ⚠ DEVELOPMENT PLACEHOLDERS: every still and clip below is a generated,
 * clearly labelled placeholder (scripts/generate-hero-placeholders.mjs).
 * Real-time models are `null`, which makes the runtime build contract-
 * compliant placeholder geometry in code. Phase 2 replaces these entries with
 * approved production assets without code changes.
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
  const base = `fallback/hero/hero-${id.toLowerCase()}-${checkpoint}`;
  return {
    id,
    checkpoint,
    wide: {
      src: assetUrl("images", `${base}-wide.dev.png`),
      width: 2560,
      height: 1440,
      objectPosition: "62% 50%",
    },
    compact: {
      src: assetUrl("images", `${base}-compact.dev.png`),
      width: 1080,
      height: 1920,
      objectPosition: "50% 30%",
    },
    placeholder: true,
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

// Production clips will list AV1 (MP4) first and H.264 (MP4) as fallback.
export const HERO_CLIPS: Record<HeroClipId, HeroClip> = {
  A: {
    id: "A",
    sources: [
      { src: assetUrl("video", "hero/hero-clip-a.dev.webm"), type: 'video/webm; codecs="vp8"' },
    ],
    finalStill: "S2",
    placeholder: true,
  },
  B: {
    id: "B",
    sources: [
      { src: assetUrl("video", "hero/hero-clip-b.dev.webm"), type: 'video/webm; codecs="vp8"' },
    ],
    finalStill: "S4",
    placeholder: true,
  },
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
