import { HERO_MARKS } from "../config/hero-states";

/*
 * Handoff points and the still ladder. Real-time may take over only where a
 * still captured from the real-time scene matches it exactly; everywhere else
 * the ladder of stills continues for that pass through the hero.
 */

export const H1_MAX_PROGRESS = 0.1;
export const H2_IDLE_MS = 200;

export type HandoffCheckpoint = "H1" | "H2";

export function handoffCheckpoint(progress: number, idleMs: number): HandoffCheckpoint | null {
  if (progress <= H1_MAX_PROGRESS) return "H1";
  if (progress >= HERO_MARKS.holdStart && progress <= HERO_MARKS.holdEnd && idleMs >= H2_IDLE_MS) {
    return "H2";
  }
  return null;
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
