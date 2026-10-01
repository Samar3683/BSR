/**
 * Physical parameters of the hero rig and its dock exit path. Units: metres,
 * seconds, radians. Coordinate contract: +Y up, +Z forward (glTF), the truck's
 * left side is +X. The tractor root sits at ground level under the rear axle.
 */
export const HERO_RIG = {
  /**
   * Exit path: straight run, then a right-hand arc (towards −X). In Phase 1
   * the straight extends past the wipe pose, so the trailer is aligned with
   * the tractor when it covers the frame (coverage shots are tractor-relative).
   * Turning before the wipe needs trailer-relative occlusion shots — a Phase 2
   * decision against the styleframes.
   */
  exitStraight: 30,
  exitArcRadius: 24,
  exitArcAngle: (40 * Math.PI) / 180,
  /** Dock distance at the wipe pose (where the dock and road worlds align). */
  wipeDistance: 22,

  /** Forward-only departure kinematics (visual tuning values). */
  maxAcceleration: 1.3,
  maxBraking: 2.6,
  maxDockSpeed: 7,

  /**
   * Visual cruise speed on the road: approximately 20–22 m/s, tuned for
   * believable heavy-vehicle movement and camera perception.
   */
  cruiseSpeed: 21,
  cruiseTimeConstant: 0.6,

  /** Tractor wheelbase and kingpin-to-trailer-axle distance (articulation). */
  wheelbase: 3.6,
  trailerAxleDistance: 9.7,

  /** Suspension/micro-motion limits. */
  maxBodyPitch: (0.6 * Math.PI) / 180,
  maxBodyRoll: (0.4 * Math.PI) / 180,
  maxHeave: 0.015,
  springFrequency: 7,
} as const;
