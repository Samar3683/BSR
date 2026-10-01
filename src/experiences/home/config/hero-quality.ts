import type { QualityProfile, RealtimeQuality } from "@/lib/performance/quality";

/**
 * Hero rendering settings. Geometry detail is fixed for a page view (the world
 * is built once for the starting tier); runtime adaptation only moves down the
 * quality ladder (never up).
 */
export interface HeroQualitySettings {
  /** Ladder level name (debug panel, tests). */
  level: HeroLevelName;
  tier: RealtimeQuality;
  /** Device-pixel-ratio cap. */
  dpr: number;
  /**
   * Render-scale cap: drawing-buffer pixels. Below the device ratio the canvas
   * is rendered smaller and upscaled by the browser (Infinity = no cap).
   */
  maxPixels: number;
  /** Photographic response: restrained bloom + the ACES output stage. */
  bloom: boolean;
  shadowMapSize: 0 | 512 | 1024 | 2048;
  atmosphere: boolean;
  dewStreak: boolean;
  roadLayers: 2 | 3 | 4;
  pointer: boolean;
}

export interface HeroTierProfile {
  renderer: QualityProfile;
  settings: HeroQualitySettings;
}

const HIGH: HeroQualitySettings = {
  level: "high",
  tier: "high",
  dpr: 2,
  maxPixels: Infinity,
  bloom: true,
  shadowMapSize: 2048,
  atmosphere: true,
  dewStreak: true,
  roadLayers: 4,
  pointer: true,
};
const MEDIUM: HeroQualitySettings = {
  level: "medium",
  tier: "medium",
  dpr: 1.5,
  maxPixels: Infinity,
  bloom: true,
  shadowMapSize: 1024,
  atmosphere: false,
  dewStreak: true,
  roadLayers: 3,
  pointer: true,
};
const LOW: HeroQualitySettings = {
  level: "low",
  tier: "low",
  dpr: 1.25,
  maxPixels: Infinity,
  bloom: false,
  shadowMapSize: 0,
  atmosphere: false,
  dewStreak: false,
  roadLayers: 2,
  pointer: false,
};

export const HERO_TIER_PROFILES: Record<RealtimeQuality, HeroTierProfile> = {
  high: { renderer: { maxDpr: 2, antialias: true, powerPreference: "high-performance" }, settings: HIGH },
  medium: { renderer: { maxDpr: 1.5, antialias: true, powerPreference: "high-performance" }, settings: MEDIUM },
  // MSAA stays on at this low pixel density: aliased truck edges read as broken.
  low: { renderer: { maxDpr: 1.25, antialias: true, powerPreference: "default" }, settings: LOW },
};

/**
 * The quality ladder, best first: HIGH → MEDIUM → LOW → LOW at reduced render
 * scale (three pixel budgets) → stills. Each step is a settings change on the
 * already-built world (no rebuild, no hitch). Budgets are drawing-buffer
 * pixels, so a small window keeps its sharpness while a large one is scaled.
 * The last level is the floor: only there does sustained <15 fps hand over to
 * stills.
 */
export const HERO_LADDER: readonly HeroQualitySettings[] = [
  HIGH,
  MEDIUM,
  LOW,
  { ...LOW, level: "low-scaled-1", maxPixels: 1_400_000 },
  { ...LOW, level: "low-scaled-2", maxPixels: 1_000_000 },
  { ...LOW, level: "low-scaled-3", maxPixels: 700_000 },
];

export type HeroLevelName = "high" | "medium" | "low" | "low-scaled-1" | "low-scaled-2" | "low-scaled-3";

/** Lowest pixel ratio ever used (the image turns to mush below this). */
export const MIN_RENDER_DPR = 0.5;

/** Ladder index a tier starts at; weak GPUs start at a reduced render scale. */
export function startLevel(tier: RealtimeQuality, options: { reducedScale?: boolean } = {}): number {
  if (options.reducedScale) return HERO_LADDER.findIndex((s) => s.level === WEAK_GPU_START);
  return HERO_LADDER.findIndex((s) => s.tier === tier);
}

/**
 * Starting level for weak integrated GPUs: the sharpest level that holds ~30 fps in
 * every scene on the reference Intel UHD 620 (measured: 30–46 fps at 1920×1080).
 */
export const WEAK_GPU_START: HeroLevelName = "low-scaled-1";

/**
 * Pixel ratio for a level at a canvas size: the device ratio, capped by the
 * level's ratio and by its pixel budget, never below MIN_RENDER_DPR.
 */
export function resolveDpr(
  settings: Pick<HeroQualitySettings, "dpr" | "maxPixels">,
  cssWidth: number,
  cssHeight: number,
  deviceRatio: number,
): number {
  const cap = Math.min(deviceRatio || 1, settings.dpr);
  const area = Math.max(1, cssWidth * cssHeight);
  const budget = Number.isFinite(settings.maxPixels) ? Math.sqrt(settings.maxPixels / area) : cap;
  return Math.round(Math.max(MIN_RENDER_DPR, Math.min(cap, budget)) * 100) / 100;
}
