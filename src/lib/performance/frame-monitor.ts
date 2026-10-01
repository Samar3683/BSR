/*
 * Real-frame monitoring for adaptive quality. Only frames that were actually
 * rendered are recorded (idle, not-rendered frames never count). Decisions
 * only ever step quality down.
 *
 * Thresholds are frame rates held over a window (median frame interval), not
 * single frames: ~30 fps is fine for a cinematic scene, sustained <20 fps
 * steps quality down, sustained <15 fps is critical. Intervals are quantised
 * to the display refresh (16.7 / 33.3 / 50 / 66.7 ms at 60 Hz), so each limit
 * carries 1 ms of tolerance: exactly 20 fps is not "below 20 fps".
 *
 * Windows are measured in rendered time — the sum of recorded frame intervals,
 * with a minimum sample count — not wall-clock time. Callers record only
 * back-to-back frames (on-demand rendering idles between scroll inputs), so a
 * few sparse samples must never add up to a verdict; a saturated GPU fills a
 * 2 s window in 2 s, exactly as specified.
 */

export interface FrameMonitorOptions {
  /** A window is slow when its median frame interval exceeds this (default: below 20 fps). */
  slowFrameMs?: number;
  /** Consecutive slow windows before a downgrade. */
  strikes?: number;
  /** Median frame interval treated as critical (default: below 15 fps). */
  criticalFrameMs?: number;
  /** How long critical performance must persist (ms of rendered time). */
  criticalForMs?: number;
  /** Rendered time per window (ms). */
  windowMs?: number;
  /** Samples a window needs before it is judged. */
  minSamples?: number;
}

export type FrameVerdict = "ok" | "downgrade" | "critical";

export const SLOW_FRAME_MS = 1000 / 20 + 1;
export const CRITICAL_FRAME_MS = 1000 / 15 + 1;

export class FrameMonitor {
  private readonly slowFrameMs: number;
  private readonly windowMs: number;
  private readonly strikes: number;
  private readonly criticalFrameMs: number;
  private readonly criticalForMs: number;
  private readonly minSamples: number;

  private samples: number[] = [];
  private sampledMs = 0;
  private slowWindows = 0;
  private criticalMs = 0;
  lastMedian = 0;

  constructor(options: FrameMonitorOptions = {}) {
    this.slowFrameMs = options.slowFrameMs ?? SLOW_FRAME_MS;
    this.windowMs = options.windowMs ?? 2000;
    this.strikes = options.strikes ?? 2;
    this.criticalFrameMs = options.criticalFrameMs ?? CRITICAL_FRAME_MS;
    this.criticalForMs = options.criticalForMs ?? 2000;
    this.minSamples = options.minSamples ?? 10;
  }

  /** Records one back-to-back frame interval (ms). */
  record(frameMs: number): FrameVerdict {
    if (!Number.isFinite(frameMs) || frameMs <= 0) return "ok";
    this.samples.push(frameMs);
    this.sampledMs += frameMs;
    if (this.sampledMs < this.windowMs || this.samples.length < this.minSamples) return "ok";

    const sorted = [...this.samples].sort((a, b) => a - b);
    const median = percentile(sorted, 0.5);
    const span = this.sampledMs;
    this.lastMedian = median;
    this.resetWindow();

    if (median > this.criticalFrameMs) {
      this.criticalMs += span;
      if (this.criticalMs >= this.criticalForMs) {
        this.reset();
        return "critical";
      }
    } else {
      this.criticalMs = 0;
    }

    if (median > this.slowFrameMs) {
      this.slowWindows++;
      if (this.slowWindows >= this.strikes) {
        this.reset();
        return "downgrade";
      }
    } else {
      this.slowWindows = 0;
    }
    return "ok";
  }

  /** Forget partial data (e.g. after a pause) without resetting strikes. */
  resetWindow(): void {
    this.samples = [];
    this.sampledMs = 0;
  }

  /** Start over (after a quality change: the old frames describe the old settings). */
  reset(): void {
    this.resetWindow();
    this.slowWindows = 0;
    this.criticalMs = 0;
  }
}

function percentile(sorted: number[], q: number): number {
  if (sorted.length === 0) return 0;
  const index = Math.min(sorted.length - 1, Math.floor(q * sorted.length));
  return sorted[index]!;
}

/*
 * Readiness check before real-time takes over, behind the poster: a few
 * frames, no sustained rendering. The first frame includes remaining GPU
 * uploads, so it gets a larger allowance. The rest must hold ~30 fps (median):
 * the handoff scene is ~25% cheaper than the heaviest ones, so 30 fps here
 * keeps the whole story at or above 20 fps. One hitch does not fail it.
 */
export interface ReadinessSample {
  firstSubmitMs: number;
  intervalsMs: readonly number[];
}

export const READINESS_FRAMES = 6;
export const READINESS_LIMITS = { firstSubmitMs: 100, frameMs: 40 } as const;

export function classifyReadiness(sample: ReadinessSample, relax = 1): "pass" | "fail" {
  if (sample.firstSubmitMs > READINESS_LIMITS.firstSubmitMs * relax) return "fail";
  const median = percentile([...sample.intervalsMs].sort((a, b) => a - b), 0.5);
  return median <= READINESS_LIMITS.frameMs * relax ? "pass" : "fail";
}
