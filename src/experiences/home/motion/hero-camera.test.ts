import { describe, expect, it } from "vitest";

import { HERO_MARKS } from "../config/hero-states";
import { aspectBucket, FORWARD_SHOTS, RETURN_SHOTS, SHOT_INDEX } from "../config/hero-shots";
import {
  blendShots,
  buildReturnPath,
  forwardShotParams,
  returnShotParams,
  shotParams,
  shotPose,
} from "./hero-camera";
import { returnOcclusionProgress } from "./hero-story-control";

describe("aspect buckets", () => {
  it("classifies canvas aspect ratios", () => {
    expect(aspectBucket(21 / 9)).toBe("ultrawide");
    expect(aspectBucket(16 / 9)).toBe("wide");
    expect(aspectBucket(4 / 3)).toBe("standard");
    expect(aspectBucket(1.1)).toBe("narrow");
    expect(aspectBucket(9 / 16)).toBe("portrait");
  });
});

describe("shot blending", () => {
  it("returns the exact shots at integer positions", () => {
    const hero = forwardShotParams(SHOT_INDEX.hero!, "wide");
    expect(hero.distance).toBe(FORWARD_SHOTS[SHOT_INDEX.hero!]!.distance);
    expect(forwardShotParams(-5, "wide")).toEqual(forwardShotParams(0, "wide"));
  });

  it("arcs around the pivot instead of cutting straight through (distance stays in range)", () => {
    const a = forwardShotParams(SHOT_INDEX.hero!, "wide");
    const b = forwardShotParams(SHOT_INDEX["rear-three-quarter"]!, "wide");
    for (let t = 0; t <= 1; t += 0.1) {
      const blended = blendShots(a, b, t);
      expect(blended.distance).toBeGreaterThanOrEqual(Math.min(a.distance, b.distance) - 1e-9);
      const pose = shotPose(blended);
      const d = Math.hypot(
        pose.position[0] - blended.pivot[0],
        pose.position[1] - blended.pivot[1],
        pose.position[2] - blended.pivot[2],
      );
      expect(d).toBeCloseTo(blended.distance, 6);
    }
  });

  it("occlusion shots keep centred framing in every bucket", () => {
    for (const bucket of ["ultrawide", "wide", "standard", "narrow", "portrait"] as const) {
      const params = shotParams(RETURN_SHOTS.trailerPass, bucket);
      expect(params.lensShiftX).toBe(0);
      expect(params.distance).toBe(RETURN_SHOTS.trailerPass.distance);
    }
  });
});

describe("return path R(p; p_rev)", () => {
  const bucket = "wide" as const;
  const returnFrom = 0.55;
  const startParams = forwardShotParams(4.6, bucket);
  const exitParams = forwardShotParams(3.25, bucket);
  const path = buildReturnPath({
    returnFrom,
    occlusionAt: returnOcclusionProgress(returnFrom),
    startParams,
    exitParams,
    bucket,
  });

  it("starts exactly where the camera was (no jump when the return begins)", () => {
    expect(returnShotParams(path, returnFrom)).toEqual(startParams);
  });

  it("passes through the occluding trailer pass", () => {
    const occluding = returnShotParams(path, returnOcclusionProgress(returnFrom));
    expect(occluding).toEqual(shotParams(RETURN_SHOTS.trailerPass, bucket));
  });

  it("ends on the forward path at the return exit (no jump when the return ends)", () => {
    expect(returnShotParams(path, HERO_MARKS.returnExit)).toEqual(exitParams);
  });

  it("is continuous: halving the sampling step halves the largest camera step (no jumps)", () => {
    const largestStep = (step: number) => {
      let previous = shotPose(returnShotParams(path, returnFrom)).position;
      let largest = 0;
      for (let p = returnFrom; p >= HERO_MARKS.returnExit; p -= step) {
        const position = shotPose(returnShotParams(path, p)).position;
        largest = Math.max(
          largest,
          Math.hypot(
            position[0] - previous[0],
            position[1] - previous[1],
            position[2] - previous[2],
          ),
        );
        previous = position;
      }
      return largest;
    };
    expect(largestStep(0.0005) / largestStep(0.001)).toBeLessThan(0.6);
  });
});
