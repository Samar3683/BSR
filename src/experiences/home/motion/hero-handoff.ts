import { HERO_MARKS } from "../config/hero-states";

/*
 * Handoff points and the still ladder. Real-time may take over only where a
 * still captured from the real-time scene matches it: the opening (S1), the
 * reveal hold (S2), and — once the road world is loaded — the open road (S3)
 * and the Italy overview (S4), each close to the still's own checkpoint, so a
 * visitor who arrives mid-story (refresh, anchor, late loading) is not left on
 * stills. Everywhere else the ladder of stills continues for that pass.
 */

export const H1_MAX_PROGRESS = 0.1;
export const H2_IDLE_MS = 200;
/** The road-tracking shot (0.64–0.80, S3 at 0.77): truck and camera framed as in S3. */
export const H3_WINDOW = [0.64, 0.8] as const;
/** Italy-overview window around the S4 checkpoint (0.97): the camera is at rest. */
export const H4_WINDOW = [0.95, 1] as const;

export type HandoffCheckpoint = "H1" | "H2" | "H3" | "H4";

export function handoffCheckpoint(
  progress: number,
  idleMs: number,
  roadReady = false,
): HandoffCheckpoint | null {
  if (progress <= H1_MAX_PROGRESS) return "H1";
  if (idleMs < H2_IDLE_MS) return null;
  if (progress >= HERO_MARKS.holdStart && progress <= HERO_MARKS.holdEnd) return "H2";
  if (!roadReady) return null;
  if (progress >= H3_WINDOW[0] && progress <= H3_WINDOW[1]) return "H3";
  if (progress >= H4_WINDOW[0] && progress <= H4_WINDOW[1]) return "H4";
  return null;
}

/** Real-time may stay in validation only while the story is still at a handoff point. */
export function withinHandoffWindow(progress: number, roadReady: boolean): boolean {
  return handoffCheckpoint(progress, Number.POSITIVE_INFINITY, roadReady) !== null;
}

/** Ladder switch points: S1 | S2 | S3 | S4. */
export const LADDER_THRESHOLDS = [0.24, 0.52, 0.86] as const;
/** Total hysteresis band around each switch point. */
export const LADDER_HYSTERESIS = 0.02;

/**
 * Ladder index (0 = S1 … 3 = S4) with hysteresis: moving up requires passing
 * threshold + h/2, moving down requires falling below threshold − h/2.
 */
export function ladderIndex(current: number, progress: number): number {
  const half = LADDER_HYSTERESIS / 2;
  let index = Math.min(3, Math.max(0, current));
  while (index < 3 && progress >= LADDER_THRESHOLDS[index]! + half) index++;
  while (index > 0 && progress < LADDER_THRESHOLDS[index - 1]! - half) index--;
  return index;
}
