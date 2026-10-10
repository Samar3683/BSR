/**
 * Camera shots, defined relative to the truck (tractor root space) so every
 * composition holds wherever the truck actually is.
 *
 * Placement is spherical around `pivot`: azimuth measured from the truck's
 * forward axis (+Z) towards its left side (+X), elevation above the ground
 * plane. `lensShiftX/Y` move the image like a shift lens (fraction of the
 * frame), keeping perspective intact while the truck stays in its safe zone.
 *
 * Phase 2B: `opening` and `hero` are fitted to Styleframes 01/02 (a low,
 * level camera ≈ 0.6 m above the ground, ≈ 65 mm character, horizon low in frame, on the truck's right side with the cab front to
 * the right of the frame). One deliberate deviation: the styleframes were
 * composed without copy, and at their exact scale the trailer's rear third
 * sits under the headline. The fit keeps their viewing angle (the flank reads
 * about twice the width of the cab front) and scales the truck ≈ 80 % about
 * the cab-front corner, so the whole truck clears the text zone.
 * ⚠ The dock shots are matched against the real-scale placeholder rig;
 * re-verify against the production truck. Road and route shots are not yet
 * matched (Gates 3–4).
 */

import { ITALY_VIEW_AZIMUTH_DEG, ITALY_VIEW_CENTRE } from "../scenes/italy-network";

export type Vec3Tuple = readonly [number, number, number];

export interface ShotSpec {
  name: string;
  pivot: Vec3Tuple;
  azimuthDeg: number;
  elevationDeg: number;
  distance: number;
  /** Look-at point, relative to the pivot. */
  targetOffset: Vec3Tuple;
  /** Vertical field of view (degrees). */
  fov: number;
  lensShiftX: number;
  lensShiftY: number;
  /** Occlusion shots keep their framing in every bucket (coverage-critical). */
  occlusion?: boolean;
  /**
   * Blends into/out of this shot in log-distance (scale-invariant): used where
   * the camera travels from metres to hundreds of kilometres.
   */
  logBlend?: boolean;
}

/** Forward story path, in order. The master timeline blends `shotT` across these. */
export const FORWARD_SHOTS: readonly ShotSpec[] = [
  // Styleframe 01: quiet readiness, slightly closer than the reveal.
  {
    name: "opening",
    pivot: [3.63, 0.64, -1.56],
    azimuthDeg: -25.2,
    elevationDeg: 0,
    distance: 31.6,
    targetOffset: [0, 0, 0],
    fov: 20,
    lensShiftX: 0.37,
    lensShiftY: -0.23,
  },
  // Detail: the near (right) headlight as it activates.
  {
    name: "headlight",
    pivot: [-0.95, 0.95, 4.96],
    azimuthDeg: -24,
    elevationDeg: 2,
    distance: 2.4,
    targetOffset: [0, 0.05, 0],
    fov: 22,
    lensShiftX: 0.1,
    lensShiftY: 0,
  },
  // Detail: light rakes along the right flank towards the BSR identity.
  {
    name: "raking",
    pivot: [-1.35, 2.5, -1.0],
    azimuthDeg: -55,
    elevationDeg: 3,
    distance: 7,
    targetOffset: [0, 0.2, -2.6],
    fov: 26,
    lensShiftX: 0.1,
    lensShiftY: 0,
  },
  // Styleframe 02: the full-vehicle campaign frame (hold).
  {
    name: "hero",
    pivot: [3.4, 0.55, -1.55],
    azimuthDeg: -26.4,
    elevationDeg: 0,
    distance: 33.1,
    targetOffset: [0, 0, 0],
    fov: 20,
    lensShiftX: 0.35,
    lensShiftY: -0.23,
  },
  // Right-rear: from the hero frame the camera travels around the rear (never
  // across the departure path), then crosses behind the tail to the left side.
  {
    name: "rear-three-quarter",
    pivot: [0, 2.0, -6],
    azimuthDeg: -150,
    elevationDeg: 7,
    distance: 21,
    targetOffset: [0, 0, 0],
    fov: 34,
    lensShiftX: 0.06,
    lensShiftY: 0,
  },
  {
    name: "trailer-side",
    pivot: [1.3, 2.6, -6],
    azimuthDeg: 90,
    elevationDeg: 0,
    distance: 1.6,
    targetOffset: [0, 0, 0],
    fov: 38,
    lensShiftX: 0,
    lensShiftY: 0,
    occlusion: true,
  },
  // Styleframe 03: low tracking shot from the overtaking lane, sun down the road.
  {
    name: "road-tracking",
    pivot: [-1.39, 1.2, -3.58],
    azimuthDeg: 154.6,
    elevationDeg: 0,
    distance: 16.6,
    targetOffset: [0, 0, 0],
    fov: 31,
    lensShiftX: 0.25,
    lensShiftY: -0.13,
  },
  // Beat 5 — Reach: high behind the truck; the lane line, now green, runs
  // ahead to Verona while the other corridors leave Carpi (the truck) west
  // and south-east. A sliver of the sunrise horizon stays at the top.
  {
    name: "reach",
    pivot: [0, 0, 0],
    azimuthDeg: 173,
    elevationDeg: 34,
    distance: 304,
    targetOffset: [0, 0, 260],
    fov: 42,
    lensShiftX: 0.12,
    lensShiftY: 0,
    logBlend: true,
  },
  // Beat 6 — Italy network (Styleframe 04): a high oblique overview from the
  // south, map north up, Italy centre-right (the caption keeps the left).
  {
    name: "italy",
    pivot: [ITALY_VIEW_CENTRE[0], 0, ITALY_VIEW_CENTRE[1]],
    azimuthDeg: ITALY_VIEW_AZIMUTH_DEG,
    elevationDeg: 64,
    distance: 24000,
    targetOffset: [0, 0, 0],
    fov: 30,
    lensShiftX: 0.2,
    lensShiftY: 0,
    logBlend: true,
  },
];

export const SHOT_INDEX = Object.fromEntries(
  FORWARD_SHOTS.map((shot, index) => [shot.name, index]),
) as Record<string, number>;

/** Return path: along the trailer side (occluding), then towards the cab. */
export const RETURN_SHOTS = {
  trailerPass: {
    name: "trailer-pass",
    pivot: [1.3, 2.6, -5],
    azimuthDeg: 90,
    elevationDeg: 0,
    distance: 1.6,
    targetOffset: [0, 0, 0.4],
    fov: 38,
    lensShiftX: 0,
    lensShiftY: 0,
    occlusion: true,
  },
  trailerToCab: {
    name: "trailer-to-cab",
    pivot: [1.3, 2.3, 1.5],
    azimuthDeg: 78,
    elevationDeg: 2,
    distance: 4,
    targetOffset: [0, 0, 0.5],
    fov: 32,
    lensShiftX: 0.08,
    lensShiftY: 0,
  },
} as const satisfies Record<string, ShotSpec>;

export type AspectBucket = "ultrawide" | "wide" | "standard" | "narrow" | "portrait";

export function aspectBucket(aspect: number): AspectBucket {
  if (aspect >= 2) return "ultrawide";
  if (aspect >= 1.6) return "wide";
  if (aspect >= 1.3) return "standard";
  if (aspect >= 1) return "narrow";
  return "portrait";
}

export interface BucketAdjustment {
  fovScale: number;
  distanceScale: number;
  lensShiftXScale: number;
  lensShiftYOffset: number;
}

/**
 * Per-bucket framing adjustments. Occlusion shots ignore distance and lens
 * changes and cap their field of view so trailer coverage is preserved.
 */
export const BUCKET_ADJUSTMENTS: Record<AspectBucket, BucketAdjustment> = {
  ultrawide: { fovScale: 0.92, distanceScale: 1, lensShiftXScale: 0.9, lensShiftYOffset: 0 },
  wide: { fovScale: 1, distanceScale: 1, lensShiftXScale: 1, lensShiftYOffset: 0 },
  // Narrower frames keep the same left text zone, so the truck needs more room, not less shift.
  standard: { fovScale: 1.08, distanceScale: 1.15, lensShiftXScale: 1, lensShiftYOffset: 0 },
  narrow: { fovScale: 1.2, distanceScale: 1.4, lensShiftXScale: 1, lensShiftYOffset: 0 },
  // Portrait (phones' stills and clips, portrait tablets): the copy fills the lower ~70 %, so
  // the truck is lifted into the band above it (≈ 12–31 % of the height) and shifted right
  // enough to keep the trailer's wordmark in frame.
  portrait: { fovScale: 1.45, distanceScale: 1.5, lensShiftXScale: 0.32, lensShiftYOffset: 0.45 },
};

export const OCCLUSION_MAX_FOV = 55;
