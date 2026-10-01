/**
 * Site header visibility, as a pure function of scroll position (unit-tested).
 *
 *   top    — at the top of the page: transparent over the first surface.
 *   shown  — scrolled, moving up (or held): a solid Carbon bar.
 *   hidden — scrolling down past the threshold: slid away, the page leads.
 *
 * Small movements (under `TOLERANCE`) never flip the state, so inertial
 * scrolling and trackpad jitter don't make the bar flicker.
 */
export type HeaderState = "top" | "shown" | "hidden";

export const TOP_THRESHOLD = 24;
export const HIDE_AFTER = 160;
export const TOLERANCE = 8;

export interface HeaderScroll {
  state: HeaderState;
  /** Scroll position the last direction change was measured from. */
  anchor: number;
}

export function nextHeaderState(previous: HeaderScroll, y: number): HeaderScroll {
  if (y <= TOP_THRESHOLD) return { state: "top", anchor: y };
  const delta = y - previous.anchor;
  if (Math.abs(delta) < TOLERANCE) {
    // Leaving the top always reveals the solid bar, even before a direction is known.
    return previous.state === "top" ? { state: "shown", anchor: previous.anchor } : previous;
  }
  if (delta > 0) return { state: y > HIDE_AFTER ? "hidden" : "shown", anchor: y };
  return { state: "shown", anchor: y };
}
