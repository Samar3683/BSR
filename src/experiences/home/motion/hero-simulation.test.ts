import { describe, expect, it } from "vitest";

import { HERO_RIG } from "../config/hero-rig";
import {
  clampStep,
  exitPathPose,
  MAX_STEP_SECONDS,
  PARKED,
  stepDock,
  stepRoadSpeed,
  stepSpring,
  wrapOffset,
} from "./hero-simulation";

/** Deterministic pseudo-random sequence for property-style tests. */
function sequence(seed: number) {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

describe("dock kinematics (forward-only)", () => {
  it("never decreases distance and never produces negative speed, whatever the target does", () => {
    const random = sequence(7);
    let state = PARKED;
    for (let step = 0; step < 5000; step++) {
      // Targets jump forwards and backwards, like a visitor scrubbing both ways.
      const target = random() * HERO_RIG.wipeDistance;
      const next = stepDock(state, target, random() * MAX_STEP_SECONDS);
      expect(next.distance).toBeGreaterThanOrEqual(state.distance);
      expect(next.speed).toBeGreaterThanOrEqual(0);
      state = next;
    }
  });

  it("brakes and holds when the target falls behind the truck", () => {
    let state = PARKED;
    for (let i = 0; i < 120; i++) state = stepDock(state, 20, 1 / 60);
    const reached = state.distance;
    expect(reached).toBeGreaterThan(0);
    for (let i = 0; i < 600; i++) state = stepDock(state, 0, 1 / 60);
    expect(state.speed).toBe(0);
    expect(state.distance).toBeGreaterThanOrEqual(reached);
    expect(state.braking).toBe(true);
  });

  it("stays parked (no brake lights) while the target is the bay", () => {
    const state = stepDock(PARKED, 0, 1 / 60);
    expect(state).toEqual({ distance: 0, speed: 0, braking: false });
  });

  it("respects acceleration and speed limits", () => {
    let state = PARKED;
    for (let i = 0; i < 60; i++) {
      const next = stepDock(state, 1000, 1 / 60);
      expect(next.speed - state.speed).toBeLessThanOrEqual(HERO_RIG.maxAcceleration / 60 + 1e-9);
      expect(next.speed).toBeLessThanOrEqual(HERO_RIG.maxDockSpeed);
      state = next;
    }
  });
});

describe("road and wheels", () => {
  it("road speed eases towards the target and is never negative", () => {
    let speed = 0;
    for (let i = 0; i < 600; i++) speed = stepRoadSpeed(speed, HERO_RIG.cruiseSpeed, 1 / 60);
    expect(speed).toBeCloseTo(HERO_RIG.cruiseSpeed, 1);
    expect(stepRoadSpeed(3, -50, 1 / 30)).toBeGreaterThanOrEqual(0);
  });

  it("clamps simulation steps so pauses never cause jumps", () => {
    expect(clampStep(5)).toBe(MAX_STEP_SECONDS);
    expect(clampStep(-1)).toBe(0);
    expect(clampStep(Number.NaN)).toBe(0);
  });

  it("wraps flowing offsets into the segment length", () => {
    expect(wrapOffset(125, 50)).toBeCloseTo(25);
    expect(wrapOffset(-10, 50)).toBeCloseTo(40);
  });

  it("critically damped springs settle without overshooting far", () => {
    let spring = { value: 0, velocity: 0 };
    let maxValue = 0;
    for (let i = 0; i < 600; i++) {
      spring = stepSpring(spring, 1, 1 / 60, HERO_RIG.springFrequency);
      maxValue = Math.max(maxValue, spring.value);
    }
    expect(spring.value).toBeCloseTo(1, 3);
    expect(maxValue).toBeLessThan(1.05);
  });
});

describe("dock exit path", () => {
  it("is continuous: no jumps in position or heading along the path", () => {
    let previous = exitPathPose(0);
    for (let d = 0.1; d <= 60; d += 0.1) {
      const pose = exitPathPose(d);
      expect(Math.hypot(pose.x - previous.x, pose.z - previous.z)).toBeLessThan(0.11);
      expect(Math.abs(pose.heading - previous.heading)).toBeLessThan(0.02);
      expect(Math.abs(pose.steer - previous.steer)).toBeLessThan(0.02);
      previous = pose;
    }
  });

  it("starts straight in the bay and turns right (towards −X)", () => {
    const parked = exitPathPose(0);
    expect(parked).toMatchObject({ x: 0, z: 0, heading: 0 });
    expect(parked.steer).toBeCloseTo(0, 6);
    const inArc = exitPathPose(HERO_RIG.exitStraight + 8);
    expect(inArc.x).toBeLessThan(0);
    expect(inArc.heading).toBeLessThan(0);
    expect(inArc.steer).toBeLessThan(0);
  });
});
