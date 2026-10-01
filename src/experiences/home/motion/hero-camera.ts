import { cubicBezier } from "@/lib/animation/cubic-bezier";
import { MOTION_EASE_CURVES } from "@/lib/animation/motion-tokens";

import { HERO_MARKS } from "../config/hero-states";
import {
  type AspectBucket,
  BUCKET_ADJUSTMENTS,
  FORWARD_SHOTS,
  OCCLUSION_MAX_FOV,
  RETURN_SHOTS,
  type ShotSpec,
  type Vec3Tuple,
} from "../config/hero-shots";

/*
 * Camera placement in truck space (pure math, no Three.js). The runtime
 * transforms the resulting pose by the truck's world pose.
 */

export type Vec3 = [number, number, number];

export interface ShotParams {
  pivot: Vec3;
  /** Radians. */
  azimuth: number;
  elevation: number;
  distance: number;
  targetOffset: Vec3;
  /** Vertical FOV, degrees. */
  fov: number;
  lensShiftX: number;
  lensShiftY: number;
  /** Blend distance geometrically (see ShotSpec.logBlend). */
  logBlend?: boolean;
}

export interface CameraPose {
  position: Vec3;
  target: Vec3;
  fov: number;
  lensShiftX: number;
  lensShiftY: number;
}

const DEG = Math.PI / 180;
const easeCinematic = cubicBezier(...MOTION_EASE_CURVES.cinematic);

const vec = (v: Vec3Tuple): Vec3 => [v[0], v[1], v[2]];
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const lerpVec = (a: Vec3, b: Vec3, t: number): Vec3 => [
  lerp(a[0], b[0], t),
  lerp(a[1], b[1], t),
  lerp(a[2], b[2], t),
];

/** Shot spec → parameters for an aspect bucket. */
export function shotParams(spec: ShotSpec, bucket: AspectBucket): ShotParams {
  const adjust = BUCKET_ADJUSTMENTS[bucket];
  if (spec.occlusion) {
    // Occlusion shots keep distance and centring; only the FOV widens (capped).
    return {
      pivot: vec(spec.pivot),
      azimuth: spec.azimuthDeg * DEG,
      elevation: spec.elevationDeg * DEG,
      distance: spec.distance,
      targetOffset: vec(spec.targetOffset),
      fov: Math.min(OCCLUSION_MAX_FOV, spec.fov * adjust.fovScale),
      lensShiftX: 0,
      lensShiftY: 0,
    };
  }
  return {
    pivot: vec(spec.pivot),
    azimuth: spec.azimuthDeg * DEG,
    elevation: spec.elevationDeg * DEG,
    distance: spec.distance * adjust.distanceScale,
    targetOffset: vec(spec.targetOffset),
    fov: spec.fov * adjust.fovScale,
    lensShiftX: spec.lensShiftX * adjust.lensShiftXScale,
    lensShiftY: spec.lensShiftY + adjust.lensShiftYOffset,
    ...(spec.logBlend ? { logBlend: true } : {}),
  };
}

/** Blends two shots around their (blended) pivots — arcs, never straight cuts through the truck. */
export function blendShots(a: ShotParams, b: ShotParams, t: number): ShotParams {
  let deltaAzimuth = b.azimuth - a.azimuth;
  if (deltaAzimuth > Math.PI) deltaAzimuth -= Math.PI * 2;
  if (deltaAzimuth < -Math.PI) deltaAzimuth += Math.PI * 2;
  // Scale-invariant blend (metres → kilometres): distance moves geometrically
  // and the pivot/look-at travel in proportion to it, so the rise reads as one
  // steady ascent instead of a jump.
  const log = (a.logBlend || b.logBlend) && a.distance > 0 && b.distance > 0;
  const distance = log ? a.distance * Math.pow(b.distance / a.distance, t) : lerp(a.distance, b.distance, t);
  const w = log && b.distance !== a.distance ? (distance - a.distance) / (b.distance - a.distance) : t;
  return {
    pivot: lerpVec(a.pivot, b.pivot, w),
    azimuth: a.azimuth + deltaAzimuth * t,
    elevation: lerp(a.elevation, b.elevation, t),
    distance,
    targetOffset: lerpVec(a.targetOffset, b.targetOffset, w),
    fov: lerp(a.fov, b.fov, t),
    lensShiftX: lerp(a.lensShiftX, b.lensShiftX, t),
    lensShiftY: lerp(a.lensShiftY, b.lensShiftY, t),
  };
}

/**
 * Forward story camera. `shotT` is written by the master timeline (already
 * eased); integer values are exact shots.
 */
export function forwardShotParams(shotT: number, bucket: AspectBucket): ShotParams {
  const last = FORWARD_SHOTS.length - 1;
  const clamped = Math.min(last, Math.max(0, shotT));
  const index = Math.min(last - 1, Math.floor(clamped));
  const t = clamped - index;
  return blendShots(
    shotParams(FORWARD_SHOTS[index]!, bucket),
    shotParams(FORWARD_SHOTS[index + 1]!, bucket),
    t,
  );
}

export interface ReturnKeyframe {
  progress: number;
  params: ShotParams;
}

/**
 * Return path R(p; p_rev), ordered from the return start (high progress) to
 * the return exit (0.44). The trailer-pass keyframe is the occluding pose.
 */
export function buildReturnPath(options: {
  returnFrom: number;
  occlusionAt: number;
  startParams: ShotParams;
  exitParams: ShotParams;
  bucket: AspectBucket;
}): ReturnKeyframe[] {
  const { returnFrom, occlusionAt, startParams, exitParams, bucket } = options;
  const exit = HERO_MARKS.returnExit;
  const cabAt = occlusionAt - 0.45 * (occlusionAt - exit);
  const keyframes: ReturnKeyframe[] = [{ progress: returnFrom, params: startParams }];
  if (occlusionAt < returnFrom) {
    keyframes.push({ progress: occlusionAt, params: shotParams(RETURN_SHOTS.trailerPass, bucket) });
  }
  keyframes.push({ progress: cabAt, params: shotParams(RETURN_SHOTS.trailerToCab, bucket) });
  keyframes.push({ progress: exit, params: exitParams });
  return keyframes;
}

export function returnShotParams(path: ReturnKeyframe[], progress: number): ShotParams {
  const first = path[0]!;
  const last = path[path.length - 1]!;
  if (progress >= first.progress) return first.params;
  if (progress <= last.progress) return last.params;
  for (let i = 0; i < path.length - 1; i++) {
    const from = path[i]!;
    const to = path[i + 1]!;
    // Exactly on a keyframe: return it verbatim (deterministic occluding pose).
    if (progress === to.progress) return to.params;
    if (progress <= from.progress && progress >= to.progress) {
      const span = from.progress - to.progress;
      const t = span <= 0 ? 1 : (from.progress - progress) / span;
      return blendShots(from.params, to.params, easeCinematic(t));
    }
  }
  return last.params;
}

/** Shot parameters → camera position/target in truck space. */
export function shotPose(params: ShotParams): CameraPose {
  const { pivot, azimuth, elevation, distance, targetOffset } = params;
  const horizontal = Math.cos(elevation) * distance;
  const position: Vec3 = [
    pivot[0] + Math.sin(azimuth) * horizontal,
    pivot[1] + Math.sin(elevation) * distance,
    pivot[2] + Math.cos(azimuth) * horizontal,
  ];
  const target: Vec3 = [
    pivot[0] + targetOffset[0],
    pivot[1] + targetOffset[1],
    pivot[2] + targetOffset[2],
  ];
  return {
    position,
    target,
    fov: params.fov,
    lensShiftX: params.lensShiftX,
    lensShiftY: params.lensShiftY,
  };
}
