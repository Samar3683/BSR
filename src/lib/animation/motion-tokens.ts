/**
 * Motion tokens for GSAP. Mirrors `--duration-*` and `--ease-*` in
 * src/styles/tokens.css (parity is enforced by src/styles/tokens.test.ts),
 * so DOM transitions and GSAP timelines share one motion language.
 *
 * Character: weighted, precise, controlled. No overshoot, bounce or springs.
 */

/** Durations in seconds (GSAP's unit). */
export const MOTION_DURATION = {
  instant: 0.1,
  fast: 0.16,
  normal: 0.24,
  slow: 0.4,
  cinematic: 0.8,
} as const;

export type MotionEaseName = "ui" | "enter" | "exit" | "cinematic" | "mechanical";

/** Cubic-bézier control points: [x1, y1, x2, y2]. */
export const MOTION_EASE_CURVES: Record<MotionEaseName, readonly [number, number, number, number]> =
  {
    ui: [0.2, 0, 0, 1],
    enter: [0.16, 1, 0.3, 1],
    exit: [0.7, 0, 0.84, 0],
    cinematic: [0.65, 0, 0.35, 1],
    mechanical: [0.77, 0, 0.175, 1],
  };

/** GSAP ease names registered via CustomEase in ./gsap.ts. */
export const MOTION_EASE: Record<MotionEaseName, string> = {
  ui: "bsr-ui",
  enter: "bsr-enter",
  exit: "bsr-exit",
  cinematic: "bsr-cinematic",
  mechanical: "bsr-mechanical",
};

/**
 * Motion categories. Sections pick a category instead of inventing timings,
 * so similar transitions behave identically across the site. Scroll-linked
 * motion (scrub) takes its pacing from the user and ignores `duration`.
 */
export const MOTION_PRESET = {
  /** Hover, press, toggle — frequent, must never feel slow. */
  micro: { duration: MOTION_DURATION.fast, ease: MOTION_EASE.ui },
  /** Panels, menus, dialogs, tab changes. */
  uiEnter: { duration: MOTION_DURATION.normal, ease: MOTION_EASE.enter },
  uiExit: { duration: MOTION_DURATION.fast, ease: MOTION_EASE.exit },
  /** Content arriving in view: headings, copy, media. */
  reveal: { duration: MOTION_DURATION.slow, ease: MOTION_EASE.enter },
  /** Scene/section changes. */
  section: { duration: MOTION_DURATION.cinematic, ease: MOTION_EASE.cinematic },
  /** Machinery: doors, loading bays, vehicles — decisive start and stop. */
  mechanical: { duration: MOTION_DURATION.cinematic, ease: MOTION_EASE.mechanical },
} as const;
