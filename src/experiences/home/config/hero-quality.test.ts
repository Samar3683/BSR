import { describe, expect, it } from "vitest";

import { HERO_LADDER, MIN_RENDER_DPR, resolveDpr, startLevel, WEAK_GPU_START } from "./hero-quality";

describe("quality ladder (step-down only)", () => {
  it("runs HIGH → MEDIUM → LOW → LOW at reduced render scale, each step cheaper", () => {
    expect(HERO_LADDER.map((s) => s.level)).toEqual([
      "high",
      "medium",
      "low",
      "low-scaled-1",
      "low-scaled-2",
      "low-scaled-3",
    ]);
    for (let i = 1; i < HERO_LADDER.length; i++) {
      const [prev, next] = [HERO_LADDER[i - 1]!, HERO_LADDER[i]!];
      expect(next.dpr).toBeLessThanOrEqual(prev.dpr);
      expect(next.maxPixels).toBeLessThanOrEqual(prev.maxPixels);
      expect(next.shadowMapSize).toBeLessThanOrEqual(prev.shadowMapSize);
      expect(next.roadLayers).toBeLessThanOrEqual(prev.roadLayers);
      expect(Number(next.bloom)).toBeLessThanOrEqual(Number(prev.bloom));
      // Every step changes something (no no-op levels).
      expect(next).not.toEqual(prev);
    }
  });

  it("tiers start at their own level; weak GPUs start at a reduced render scale", () => {
    expect(HERO_LADDER[startLevel("high")]!.level).toBe("high");
    expect(HERO_LADDER[startLevel("medium")]!.level).toBe("medium");
    expect(HERO_LADDER[startLevel("low")]!.level).toBe("low");
    expect(HERO_LADDER[startLevel("low", { reducedScale: true })]!.level).toBe(WEAK_GPU_START);
  });
});

describe("render scale", () => {
  it("unscaled levels use the device ratio up to the level's cap", () => {
    expect(resolveDpr(HERO_LADDER[0]!, 1920, 1080, 1.25)).toBe(1.25);
    expect(resolveDpr(HERO_LADDER[0]!, 1920, 1080, 3)).toBe(2);
    expect(resolveDpr(HERO_LADDER[2]!, 1920, 1080, 2)).toBe(1.25);
  });

  it("scaled levels hold a pixel budget, so small windows stay sharp", () => {
    const scaled = HERO_LADDER.find((s) => s.level === "low-scaled-2")!;
    const dpr = resolveDpr(scaled, 1920, 1080, 1.25);
    expect(1920 * dpr * 1080 * dpr).toBeLessThanOrEqual(scaled.maxPixels * 1.02);
    expect(dpr).toBeLessThan(1);
    // A small window within budget keeps the device ratio (capped by the level).
    expect(resolveDpr(scaled, 800, 600, 1)).toBe(1);
  });

  it("never drops below the minimum render ratio", () => {
    expect(resolveDpr(HERO_LADDER.at(-1)!, 3840, 2160, 1)).toBe(MIN_RENDER_DPR);
  });
});
