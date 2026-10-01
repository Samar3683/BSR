import {
  Box3,
  type Material,
  Matrix4,
  type Mesh,
  type Object3D,
  PerspectiveCamera,
  Vector3,
} from "three";
import { describe, expect, it } from "vitest";

import { HERO_MARKS } from "../config/hero-states";
import { HERO_RIG } from "../config/hero-rig";
import { type AspectBucket, FORWARD_SHOTS, RETURN_SHOTS, SHOT_INDEX } from "../config/hero-shots";
import {
  buildReturnPath,
  forwardShotParams,
  returnShotParams,
  shotParams,
  shotPose,
} from "../motion/hero-camera";
import { exitPathPose } from "../motion/hero-simulation";
import { COVERAGE_THRESHOLD, returnOcclusionProgress } from "../motion/hero-story-control";
import { applyCameraPose, rigMatrix, trailerCoverage } from "./hero-three-math";
import { createPlaceholderTractor, createPlaceholderTrailer } from "./placeholder-truck";
import {
  assembleTruckRig,
  contractViolations,
  MATERIAL_SLOTS,
  missingNodes,
  TRACTOR_REQUIRED_NODES,
  TRAILER_REQUIRED_NODES,
} from "./truck-contract";

/** Representative viewports for every framing bucket. */
const VIEWPORTS: Record<AspectBucket, Array<[number, number]>> = {
  ultrawide: [
    [2560, 1080],
    [3440, 1440],
  ],
  wide: [
    [1920, 1080],
    [1440, 900],
  ],
  standard: [
    [1440, 1050],
    [1280, 960],
  ],
  narrow: [
    [1180, 1000],
    [1024, 1000],
  ],
  portrait: [
    [820, 1180],
    [600, 900],
  ],
};

function renameMaterial(root: Object3D, from: string, to: string) {
  root.traverse((object) => {
    const material = (object as Mesh).material as Material | undefined;
    if (material && !Array.isArray(material) && material.name === from) material.name = to;
  });
}

function placeholderRig() {
  return assembleTruckRig(createPlaceholderTractor(), createPlaceholderTrailer());
}

function coverageFor(
  params: ReturnType<typeof shotParams>,
  distance: number,
  width: number,
  height: number,
) {
  const rig = placeholderRig();
  const pose = exitPathPose(distance);
  const world = rigMatrix(new Matrix4(), pose.x, pose.z, pose.heading);
  rig.root.matrixAutoUpdate = false;
  rig.root.matrix.copy(world);
  rig.root.updateMatrixWorld(true);
  const camera = new PerspectiveCamera();
  applyCameraPose(camera, shotPose(params), world, width, height);
  return trailerCoverage(camera, rig.trailerBody, rig.trailerBodyBox);
}

describe("placeholder truck implements the model contract", () => {
  it("exposes every required node", () => {
    expect(missingNodes(createPlaceholderTractor(), TRACTOR_REQUIRED_NODES)).toEqual([]);
    expect(missingNodes(createPlaceholderTrailer(), TRAILER_REQUIRED_NODES)).toEqual([]);
  });

  it("binds wheels (with measured radii), steering, lights and the trailer body", () => {
    const rig = placeholderRig();
    expect(rig.steerNodes).toHaveLength(2);
    expect(rig.wheels).toHaveLength(10);
    for (const wheel of rig.wheels) {
      expect(wheel.radius).toBeGreaterThan(0.3);
      expect(wheel.radius).toBeLessThan(0.7);
    }
    expect(rig.lightMaterials.head.length).toBeGreaterThan(0);
    expect(rig.lightMaterials.tail.length).toBeGreaterThan(0);
    expect(rig.lightMaterials.brake.length).toBeGreaterThan(0);
    expect(rig.headlights).toHaveLength(2);
    expect(rig.trailerBodyBox.isEmpty()).toBe(false);
  });

  it("attaches the trailer at the fifth wheel (kingpin origin)", () => {
    const rig = placeholderRig();
    expect(rig.trailerRoot.parent?.name).toBe("Trailer");
    expect(rig.trailerRoot.parent?.parent?.name).toBe("Hitch_FifthWheel");
  });

  it("rejects assets that break the contract", () => {
    const tractor = createPlaceholderTractor();
    tractor.getObjectByName("Hitch_FifthWheel")!.name = "Hitch";
    expect(() => assembleTruckRig(tractor, createPlaceholderTrailer())).toThrow(/Hitch_FifthWheel/);
  });

  it("rejects assets missing a required material slot", () => {
    const tractor = createPlaceholderTractor();
    renameMaterial(tractor, MATERIAL_SLOTS.glass, "Glass.001");
    expect(contractViolations(tractor, createPlaceholderTrailer())).toEqual([
      `tractor material ${MATERIAL_SLOTS.glass}`,
    ]);
    expect(() => assembleTruckRig(tractor, createPlaceholderTrailer())).toThrow(/MAT_Glass/);
  });

  it("accepts the box-trailer alternative to the curtain body", () => {
    const trailer = createPlaceholderTrailer();
    renameMaterial(trailer, MATERIAL_SLOTS.curtain, MATERIAL_SLOTS.boxPanel);
    expect(contractViolations(createPlaceholderTractor(), trailer)).toEqual([]);
  });
});

describe("camera clearance (the camera never passes through the truck)", () => {
  const rig = placeholderRig();
  rig.root.updateMatrixWorld(true);
  // Truck-space bounds (the rig sits at the origin), with a 0.25 m margin.
  const bounds = new Box3().setFromObject(rig.root).expandByScalar(0.25);
  const outside = (position: [number, number, number]) =>
    !bounds.containsPoint(new Vector3(...position));

  for (const bucket of ["ultrawide", "wide", "standard", "narrow", "portrait"] as const) {
    it(`${bucket}: forward path, every shot and every blend`, () => {
      for (let shotT = 0; shotT <= FORWARD_SHOTS.length - 1; shotT += 0.01) {
        const pose = shotPose(forwardShotParams(shotT, bucket));
        expect(outside(pose.position), `shotT ${shotT.toFixed(2)}`).toBe(true);
      }
    });

    it(`${bucket}: return path, from the wipe back to the parked composition`, () => {
      const returnFrom = HERO_MARKS.wipeSwitchForward;
      const path = buildReturnPath({
        returnFrom,
        occlusionAt: returnOcclusionProgress(returnFrom),
        startParams: forwardShotParams(SHOT_INDEX["trailer-side"]!, bucket),
        exitParams: forwardShotParams(SHOT_INDEX.hero! + 0.2, bucket),
        bucket,
      });
      for (let p = returnFrom; p >= HERO_MARKS.returnExit; p -= 0.001) {
        const pose = shotPose(returnShotParams(path, p));
        expect(outside(pose.position), `progress ${p.toFixed(3)}`).toBe(true);
      }
    });
  }
});

describe("trailer coverage for concealed changes (≥ 92% in every bucket)", () => {
  for (const [bucket, viewports] of Object.entries(VIEWPORTS) as Array<
    [AspectBucket, Array<[number, number]>]
  >) {
    for (const [width, height] of viewports) {
      it(`${bucket} ${width}×${height}: forward wipe pose`, () => {
        const params = forwardShotParams(SHOT_INDEX["trailer-side"]!, bucket);
        expect(coverageFor(params, HERO_RIG.wipeDistance, width, height)).toBeGreaterThanOrEqual(
          COVERAGE_THRESHOLD,
        );
      });

      it(`${bucket} ${width}×${height}: return trailer pass (truck anywhere on its departure)`, () => {
        const params = shotParams(RETURN_SHOTS.trailerPass, bucket);
        for (const distance of [0.1, 3, 12, HERO_RIG.wipeDistance]) {
          expect(coverageFor(params, distance, width, height)).toBeGreaterThanOrEqual(
            COVERAGE_THRESHOLD,
          );
        }
      });
    }
  }

  it("non-occluding shots do not accidentally register as covered", () => {
    const hero = forwardShotParams(SHOT_INDEX.hero!, "wide");
    expect(coverageFor(hero, 0, 1920, 1080)).toBeLessThan(0.5);
  });

  it("occlusion shots are the only ones reaching the threshold on the forward path", () => {
    for (let index = 0; index < FORWARD_SHOTS.length; index++) {
      const coverage = coverageFor(forwardShotParams(index, "wide"), 0, 1920, 1080);
      const expected = FORWARD_SHOTS[index]!.occlusion === true;
      expect(coverage >= COVERAGE_THRESHOLD).toBe(expected);
    }
  });

  it("the wipe switch point sits on the occluding shot", () => {
    expect(HERO_MARKS.wipeSwitchForward).toBeGreaterThanOrEqual(HERO_MARKS.wipeStart);
    expect(HERO_MARKS.wipeSwitchBack).toBeGreaterThanOrEqual(HERO_MARKS.wipeStart);
  });
});
