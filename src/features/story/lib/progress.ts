/*
 * The scroll math of the film below the hero — pure functions, shared by the
 * scene director (components/scene-director.tsx) and its tests.
 *
 * Every scene state is a function of the scroll position alone (never of
 * the scroll's history), so a fast scroll, a reverse scroll, a jump from the
 * navigation or a reload mid-page always lands on the same, complete frame.
 */

export const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

/**
 * A pinned scene: its track is taller than the viewport and its stage sticks
 * while the track scrolls past. 0 when the track's top reaches the top of the
 * viewport, 1 when its bottom reaches the bottom.
 */
export function pinnedProgress(top: number, height: number, viewport: number): number {
  const run = height - viewport;
  if (run <= 0) return top <= 0 ? 1 : 0;
  return clamp01(-top / run);
}

/**
 * A scene that scrolls normally: 0 as its top enters at the bottom of the
 * viewport, 1 as its bottom leaves at the top.
 */
export function viewProgress(top: number, height: number, viewport: number): number {
  return clamp01((viewport - top) / (viewport + height));
}

/** The step shown at progress `p`, for `count` steps spread over [from, to]. */
export function stepAt(p: number, count: number, from = 0, to = 1): number {
  if (count <= 1) return 0;
  const t = clamp01((p - from) / Math.max(to - from, 1e-6));
  // A hair of tolerance: a progress exactly on a boundary belongs to the next step.
  return Math.min(count - 1, Math.floor(t * count + 1e-9));
}

/**
 * A scene laid out as a plain list (reduced motion, no pinning on this
 * screen): the current step is the last whose top has passed the reading
 * line; before the first has, the first.
 */
export function readingStep(tops: readonly number[], line: number): number {
  let step = 0;
  tops.forEach((top, i) => {
    if (top <= line) step = i;
  });
  return step;
}

/**
 * The scroll position (page Y) at which a pinned scene shows step `index` —
 * the middle of that step's share of the range — for the scene's jump
 * controls.
 */
export function scrollForStep(
  trackTop: number,
  trackHeight: number,
  viewport: number,
  index: number,
  count: number,
  from = 0,
  to = 1,
): number {
  const p = from + ((index + 0.5) / Math.max(count, 1)) * (to - from);
  return trackTop + p * Math.max(trackHeight - viewport, 0);
}

/** Parses a scene's `data-step-range` ("0.2 0.9") into [from, to]. */
export function parseRange(value: string | undefined): [number, number] {
  const [from, to] = (value ?? "").split(/[\s,]+/).map(Number);
  return Number.isFinite(from) && Number.isFinite(to) && to! > from! ? [from!, to!] : [0, 1];
}
