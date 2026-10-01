import { HERO_RIG } from "../config/hero-rig";

/*
 * Continuous, forward-only simulation. Pure functions over plain data:
 * no Three.js, no React, no GSAP. Story values (targets) come from the master
 * timeline; this module turns them into believable motion.
 *
 * Invariants (unit-tested):
 *   - dock distance D never decreases here (only the story control's
 *     concealed rebase may reset it)
 *   - speeds are never negative
 *   - wheel distance never decreases, so wheels never turn backwards
 */

/** Largest simulated step: prevents jumps after a pause or a slow frame. */
export const MAX_STEP_SECONDS = 1 / 30;

export function clampStep(seconds: number): number {
  if (!Number.isFinite(seconds) || seconds <= 0) return 0;
  return Math.min(seconds, MAX_STEP_SECONDS);
}

export interface DockKinematics {
  /** Distance along the dock exit path (m). Forward-only. */
  distance: number;
  /** m/s, ≥ 0. */
  speed: number;
  /** Decelerating, or held on the brakes short of where the story is. */
  braking: boolean;
}

export const PARKED: DockKinematics = { distance: 0, speed: 0, braking: false };

/**
 * Moves the truck towards the story's target distance using bounded
 * acceleration/braking. If the target falls behind the truck (the visitor
 * scrolled back) the truck brakes and holds — it never drives backwards.
 */
export function stepDock(state: DockKinematics, target: number, dt: number): DockKinematics {
  if (dt <= 0) return state;
  const { maxAcceleration, maxBraking, maxDockSpeed } = HERO_RIG;

  const remaining = target - state.distance;
  const stoppingDistance = (state.speed * state.speed) / (2 * maxBraking);

  let speed: number;
  let decelerating = false;
  if (remaining > stoppingDistance + 1e-3) {
    speed = Math.min(state.speed + maxAcceleration * dt, maxDockSpeed);
  } else {
    speed = Math.max(state.speed - maxBraking * dt, 0);
    decelerating = speed < state.speed;
  }

  const distance = state.distance + speed * dt;
  const held = speed === 0 && target < distance - 0.05;
  return { distance, speed, braking: decelerating || held };
}

/** Eases the road speed towards its target; never negative. */
export function stepRoadSpeed(speed: number, target: number, dt: number): number {
  if (dt <= 0) return speed;
  const blend = 1 - Math.exp(-dt / HERO_RIG.cruiseTimeConstant);
  return Math.max(0, speed + (Math.max(0, target) - speed) * blend);
}

/** Wheel angle for a travelled distance (rad), wrapped. */
export function wheelAngle(travelled: number, radius: number): number {
  return (travelled / radius) % (Math.PI * 2);
}

/** Wraps a flowing distance to a segment length so coordinates never drift. */
export function wrapOffset(offset: number, length: number): number {
  return ((offset % length) + length) % length;
}

export interface Spring {
  value: number;
  velocity: number;
}

/** Critically damped spring step (semi-implicit Euler; stable at clamped dt). */
export function stepSpring(spring: Spring, target: number, dt: number, omega: number): Spring {
  if (dt <= 0) return spring;
  const acceleration = -2 * omega * spring.velocity - omega * omega * (spring.value - target);
  const velocity = spring.velocity + acceleration * dt;
  return { value: spring.value + velocity * dt, velocity };
}

export function isSettled(spring: Spring, target: number): boolean {
  return Math.abs(spring.value - target) < 1e-5 && Math.abs(spring.velocity) < 1e-4;
}

// ---------------------------------------------------------------------------
// Dock exit path
// ---------------------------------------------------------------------------

export interface PathPose {
  x: number;
  z: number;
  /** Yaw about +Y; 0 faces +Z, negative turns right (towards −X). */
  heading: number;
  /** Front-wheel steer angle (rad). */
  steer: number;
  /** Trailer articulation relative to the tractor (rad). */
  articulation: number;
}

/** Truck pose as a function of dock distance — never of scroll progress. */
export function exitPathPose(distance: number): PathPose {
  const { exitStraight: s0, exitArcRadius: radius, exitArcAngle, wheelbase } = HERO_RIG;
  const d = Math.max(0, distance);
  const arcLength = radius * exitArcAngle;

  let x: number;
  let z: number;
  let heading: number;
  if (d <= s0) {
    x = 0;
    z = d;
    heading = 0;
  } else if (d <= s0 + arcLength) {
    const phi = (d - s0) / radius;
    x = -radius + radius * Math.cos(phi);
    z = s0 + radius * Math.sin(phi);
    heading = -phi;
  } else {
    const endX = -radius + radius * Math.cos(exitArcAngle);
    const endZ = s0 + radius * Math.sin(exitArcAngle);
    const beyond = d - s0 - arcLength;
    heading = -exitArcAngle;
    x = endX + Math.sin(heading) * beyond;
    z = endZ + Math.cos(heading) * beyond;
  }

  // Curvature eases in/out over a couple of metres so steering never snaps.
  const curvature = -smoothCurvatureWeight(d, s0, s0 + arcLength) / radius;
  const steer = Math.atan(wheelbase * curvature);
  const steadyArticulation = Math.asin(Math.min(1, HERO_RIG.trailerAxleDistance / radius));
  const articulation =
    steadyArticulation * articulationWeight(d, s0, s0 + arcLength, HERO_RIG.trailerAxleDistance);

  return { x, z, heading, steer, articulation };
}

function smoothstep(edge0: number, edge1: number, value: number): number {
  const t = Math.min(1, Math.max(0, (value - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function smoothCurvatureWeight(d: number, arcStart: number, arcEnd: number): number {
  const ramp = 2;
  return (
    smoothstep(arcStart - ramp, arcStart + ramp, d) *
    (1 - smoothstep(arcEnd - ramp, arcEnd + ramp, d))
  );
}

function articulationWeight(d: number, arcStart: number, arcEnd: number, length: number): number {
  return smoothstep(arcStart, arcStart + length, d) * (1 - smoothstep(arcEnd, arcEnd + length, d));
}
