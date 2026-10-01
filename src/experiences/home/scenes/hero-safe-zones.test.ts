import { Matrix4, PerspectiveCamera, Vector3 } from "three";
import { describe, expect, it } from "vitest";

import { aspectBucket, SHOT_INDEX } from "../config/hero-shots";
import { forwardShotParams, shotPose } from "../motion/hero-camera";
import { applyCameraPose, rigMatrix } from "./hero-three-math";

/*
 * Composition rule from the approved creative specification: hero text never
 * covers the headlights, the cab front or the wordmark. Focal points of the
 * (placeholder) rig are projected for every framing bucket:
 *   landscape layouts → text zone is the left 42% of the frame
 *   portrait (compact) → text zone is the bottom 45% of the frame
 */
const FOCAL = {
  headlightLeft: [0.95, 0.95, 4.96],
  headlightRight: [-0.95, 0.95, 4.96],
  cabFront: [0, 2.5, 4.9],
  // The dock shots see the truck's right flank (−X).
  wordmarkLead: [-1.29, 2.85, -3.7],
  wordmarkCentre: [-1.29, 2.85, -6.4],
  trailerRear: [-1.28, 2.6, -11.6],
  trailerRearTop: [-1.28, 4.0, -11.65],
} as const;

type Focal = keyof typeof FOCAL;

/** Focal points that must stay clear of the text for each shot. */
const SHOT_FOCUS: Record<string, Focal[]> = {
  // Styleframe checkpoints: the whole truck, trailer rear included, stays clear of the copy.
  opening: ["headlightLeft", "headlightRight", "cabFront", "trailerRear", "trailerRearTop"],
  headlight: ["headlightRight"],
  raking: ["wordmarkLead"],
  hero: [
    "headlightLeft",
    "headlightRight",
    "cabFront",
    "wordmarkCentre",
    "trailerRear",
    "trailerRearTop",
  ],
};

const VIEWPORTS: Array<[number, number]> = [
  [2560, 1080],
  [1920, 1080],
  [1440, 900],
  [1440, 1050],
  [1280, 960],
  [1024, 1000],
  [820, 1180],
  [600, 900],
];

function project(shot: string, width: number, height: number, point: readonly number[]) {
  const camera = new PerspectiveCamera();
  const world = rigMatrix(new Matrix4(), 0, 0, 0);
  applyCameraPose(
    camera,
    shotPose(forwardShotParams(SHOT_INDEX[shot]!, aspectBucket(width / height))),
    world,
    width,
    height,
  );
  const v = new Vector3(point[0], point[1], point[2]).project(camera);
  return { x: (v.x + 1) / 2, y: (1 - v.y) / 2 };
}

describe("text safe zone (hero copy never covers the truck's focal points)", () => {
  for (const [width, height] of VIEWPORTS) {
    const portrait = width / height < 1;
    for (const [shot, focus] of Object.entries(SHOT_FOCUS)) {
      it(`${width}×${height} ${shot}`, () => {
        for (const name of focus) {
          const { x, y } = project(shot, width, height, FOCAL[name]);
          // In frame…
          expect(x, `${name} x`).toBeGreaterThanOrEqual(0);
          expect(x, `${name} x`).toBeLessThanOrEqual(1);
          expect(y, `${name} y`).toBeGreaterThanOrEqual(0);
          expect(y, `${name} y`).toBeLessThanOrEqual(1);
          // …and outside the text zone.
          if (portrait) expect(y, `${name} y`).toBeLessThanOrEqual(0.55);
          else expect(x, `${name} x`).toBeGreaterThanOrEqual(0.45);
        }
      });
    }
  }
});
