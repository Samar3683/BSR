export const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";
export const FULL_MOTION_QUERY = "(prefers-reduced-motion: no-preference)";

/**
 * Imperative read of the user's motion preference for non-React code
 * (GSAP setup, render loops). React components should use `useReducedMotion`.
 *
 * Outside the browser the preference is unknown, so this errs on the side of
 * reduced motion.
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return true;
  return window.matchMedia(REDUCED_MOTION_QUERY).matches;
}
