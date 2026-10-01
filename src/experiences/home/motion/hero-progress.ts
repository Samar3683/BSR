import { cubicBezier } from "@/lib/animation/cubic-bezier";
import { MOTION_EASE_CURVES } from "@/lib/animation/motion-tokens";

import { clamp01 } from "../config/hero-states";

/** A progress change larger than this in one update is treated as a jump. */
export const JUMP_THRESHOLD = 0.2;
/** Maximum catch-up duration after a jump (approved ≤ 350 ms). */
export const JUMP_CATCH_UP_MS = 350;

const easeUi = cubicBezier(...MOTION_EASE_CURVES.ui);

/**
 * Raw scroll progress → displayed story progress.
 *
 * Small changes pass straight through (Lenis already smooths the scroll).
 * Large jumps (Home/End, anchors, scrollbar drags) catch up over at most
 * 350 ms; a newer jump overwrites the old target, so nothing ever queues.
 * At rest, displayed === raw.
 */
export class ProgressController {
  raw = 0;
  displayed = 0;
  private lastRawChangeAt = Number.NEGATIVE_INFINITY;
  private catchUp: { from: number; to: number; startedAt: number } | null = null;

  setRaw(value: number, now: number): void {
    const next = clamp01(value);
    if (next === this.raw) return;
    this.raw = next;
    this.lastRawChangeAt = now;

    // During a catch-up, compare against where it is heading, not where the
    // displayed value currently lags.
    const reference = this.catchUp ? this.catchUp.to : this.displayed;
    if (Math.abs(next - reference) > JUMP_THRESHOLD) {
      this.catchUp = { from: this.displayed, to: next, startedAt: now };
    } else if (this.catchUp) {
      // Keep the running catch-up (so its deadline holds) but aim at the new value.
      this.catchUp.to = next;
    } else {
      this.displayed = next;
    }
  }

  /** Advances an active catch-up. Returns true if `displayed` changed. */
  update(now: number): boolean {
    if (!this.catchUp) return false;
    const { from, to, startedAt } = this.catchUp;
    const t = Math.min(1, (now - startedAt) / JUMP_CATCH_UP_MS);
    const previous = this.displayed;
    this.displayed = from + (to - from) * easeUi(t);
    if (t >= 1) {
      this.displayed = this.raw;
      this.catchUp = null;
    }
    return this.displayed !== previous;
  }

  /** Jumps straight to the raw value (resume after pause, checkpoints). */
  snap(): void {
    this.displayed = this.raw;
    this.catchUp = null;
  }

  get isCatchingUp(): boolean {
    return this.catchUp !== null;
  }

  /** Time since the raw scroll progress last changed. */
  idleMs(now: number): number {
    return now - this.lastRawChangeAt;
  }
}
