/*
 * Approved hero budgets as plain data (hero technical specification section R,
 * with the review amendments). No imports: shared by the runtime, the unit
 * tests and the offline asset validator (scripts/validate-hero-model.mjs).
 *
 * "goal" is the target; "hard" fails review (and, at runtime, a production
 * asset over its hard limit is rejected — the hero falls back to stills).
 */

export type HeroBudgetTier = "high" | "medium" | "low";

const MB = 1024 * 1024;

/** Transfer budgets (bytes, as downloaded). */
export const HERO_TRANSFER_BUDGETS = {
  high: {
    firstReveal: { goal: 6.5 * MB, hard: 9 * MB },
    roadAddition: { goal: 4.5 * MB, hard: 6 * MB },
    total: { goal: 11 * MB, hard: 16 * MB },
  },
  medium: {
    firstReveal: { goal: 4 * MB, hard: 5.5 * MB },
    roadAddition: { goal: 2.8 * MB, hard: 3.5 * MB },
    total: { goal: 6.8 * MB, hard: 9 * MB },
  },
  low: {
    firstReveal: { goal: 2.5 * MB, hard: 3.5 * MB },
    roadAddition: { goal: 1.6 * MB, hard: 2.2 * MB },
    total: { goal: 4.1 * MB, hard: 5.7 * MB },
  },
  mobileClips: { goal: 1.8 * MB, hard: 2.5 * MB },
  stillWide: { goal: 200 * 1024 },
  stillCompact: { goal: 120 * 1024 },
} as const;

export interface Range {
  goal: number;
  hard: number;
}

export interface HeroGpuBudget {
  /** Per-asset triangle ranges: the hard value is the range's upper bound. */
  tractorTriangles: Range;
  trailerTriangles: Range;
  dockTriangles: Range;
  roadTriangles: Range;
  totalTriangles: Range;
  /** Including the shadow pass. */
  drawCalls: Range;
  truckMaterials: number;
  worldMaterials: number;
  /** Estimated GPU texture memory (bytes). */
  textureBytes: Range;
  punctualLights: number;
  shadowCasters: number;
}

export const HERO_GPU_BUDGETS: Record<HeroBudgetTier, HeroGpuBudget> = {
  high: {
    tractorTriangles: { goal: 200_000, hard: 250_000 },
    trailerTriangles: { goal: 60_000, hard: 80_000 },
    dockTriangles: { goal: 150_000, hard: 200_000 },
    roadTriangles: { goal: 150_000, hard: 150_000 },
    totalTriangles: { goal: 450_000, hard: 600_000 },
    drawCalls: { goal: 100, hard: 150 },
    truckMaterials: 15,
    worldMaterials: 15,
    textureBytes: { goal: 120 * MB, hard: 160 * MB },
    punctualLights: 5,
    shadowCasters: 1,
  },
  medium: {
    tractorTriangles: { goal: 100_000, hard: 120_000 },
    trailerTriangles: { goal: 32_000, hard: 40_000 },
    dockTriangles: { goal: 80_000, hard: 100_000 },
    roadTriangles: { goal: 80_000, hard: 80_000 },
    totalTriangles: { goal: 250_000, hard: 300_000 },
    drawCalls: { goal: 70, hard: 100 },
    truckMaterials: 12,
    worldMaterials: 12,
    textureBytes: { goal: 70 * MB, hard: 96 * MB },
    punctualLights: 4,
    shadowCasters: 1,
  },
  low: {
    tractorTriangles: { goal: 50_000, hard: 60_000 },
    trailerTriangles: { goal: 16_000, hard: 20_000 },
    dockTriangles: { goal: 40_000, hard: 50_000 },
    roadTriangles: { goal: 40_000, hard: 40_000 },
    totalTriangles: { goal: 120_000, hard: 150_000 },
    drawCalls: { goal: 45, hard: 60 },
    // "≤ 18 total" in the specification, split between truck and world: the model
    // contract alone requires 10 distinct truck slots (+ graphite for chassis/trim).
    truckMaterials: 11,
    worldMaterials: 7,
    textureBytes: { goal: 36 * MB, hard: 48 * MB },
    punctualLights: 2,
    shadowCasters: 0,
  },
};
