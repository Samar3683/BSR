/*
 * Scroll → video frame, for the scroll-scrubbed hero. Pure timing functions plus
 * a small seek queue; no React, no GSAP, no DOM beyond the video element's own
 * interface, so the rules are unit-tested (video-scrub.test.ts).
 *
 * Seeking model: the video is never played. Each scroll position maps to one
 * frame; at most one seek is in flight, the latest requested frame is kept, and
 * every completed seek catches up to it. A seek that never completes (some
 * browsers drop seeks under load) is retried by a watchdog, so the displayed
 * frame always converges on the target once scrolling stops.
 */

export interface ScrubTiming {
  /** Seconds (the loaded file's real duration once known). */
  duration: number;
  fps: number;
  /** Fractions of the pinned scroll held on the first / last frame. */
  holdStart: number;
  holdEnd: number;
}

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

/** Footage time (s) shown at scroll progress p (0–1), with holds at both ends. */
export function timeForProgress(p: number, timing: ScrubTiming): number {
  const span = 1 - timing.holdStart - timing.holdEnd;
  const t = span <= 0 ? clamp01(p) : clamp01((p - timing.holdStart) / span);
  return t * Math.max(0, timing.duration);
}

/** Index of the last decodable frame (never past the end of the stream). */
export function lastFrame(duration: number, fps: number): number {
  return Math.max(0, Math.round(duration * fps) - 1);
}

/** The frame on screen at footage time t, clamped to the stream. */
export function frameAt(time: number, timing: Pick<ScrubTiming, "duration" | "fps">): number {
  const frame = Math.floor(Math.max(0, time) * timing.fps + 1e-6);
  return Math.min(frame, lastFrame(timing.duration, timing.fps));
}

/**
 * The seek position for a frame: its middle, never its exact start — a seek to a
 * frame boundary can land on the previous frame through rounding, and a seek to
 * the very end of the stream can show nothing at all.
 */
export function seekTime(frame: number, fps: number): number {
  return (frame + 0.5) / fps;
}

/** Smoothstep opacity of a window [from, to] with `fade` seconds either side. */
export function windowOpacity(time: number, from: number, to: number, fade: number): number {
  if (time < from - fade || time > to + fade) return 0;
  const rise = fade > 0 ? clamp01((time - (from - fade)) / fade) : 1;
  const fall = fade > 0 && Number.isFinite(to) ? clamp01((to + fade - time) / fade) : 1;
  const x = Math.min(rise, fall);
  return x * x * (3 - 2 * x);
}

/** Opacity of the headline block: 1 until `from`, 0 from `to` (footage s). */
export function fadeOut(time: number, from: number, to: number): number {
  const x = clamp01((time - from) / Math.max(1e-6, to - from));
  return 1 - x * x * (3 - 2 * x);
}

/** Piecewise-linear value of a [time, value] track (held before the first and after the last key). */
export function trackAt(time: number, track: ReadonlyArray<readonly [number, number]>): number {
  if (track.length === 0) return Number.NaN;
  if (time <= track[0]![0]) return track[0]![1];
  for (let i = 1; i < track.length; i++) {
    const [t1, v1] = track[i]!;
    if (time <= t1) {
      const [t0, v0] = track[i - 1]!;
      return v0 + ((v1 - v0) * (time - t0)) / Math.max(1e-6, t1 - t0);
    }
  }
  return track[track.length - 1]![1];
}

/** The part of HTMLVideoElement the scrubber uses (a fake in tests). */
export interface SeekableVideo {
  currentTime: number;
  readonly readyState: number;
  addEventListener(type: "seeked", listener: () => void): void;
  removeEventListener(type: "seeked", listener: () => void): void;
}

/** HTMLMediaElement.HAVE_CURRENT_DATA: a frame at the current position is decoded. */
const HAVE_CURRENT_DATA = 2;

export interface ScrubberOptions {
  timing: Pick<ScrubTiming, "duration" | "fps">;
  /** A seek completed: `frame` is now the current frame. */
  onSeeked?: (frame: number) => void;
  /** Retry a seek after this long without `seeked`. */
  watchdogMs?: number;
  setTimer?: (fn: () => void, ms: number) => unknown;
  clearTimer?: (handle: unknown) => void;
}

export class VideoScrubber {
  private timing: Pick<ScrubTiming, "duration" | "fps">;
  private targetFrame = 0;
  /** Frame of the seek in flight (−1: none). */
  private pending = -1;
  /** Frame of the last completed seek (−1: none yet). */
  private current = -1;
  private enabled = false;
  private disposed = false;
  private watchdog: unknown = null;
  private readonly options: Required<Omit<ScrubberOptions, "onSeeked" | "timing">> &
    Pick<ScrubberOptions, "onSeeked">;

  constructor(
    private readonly video: SeekableVideo,
    options: ScrubberOptions,
  ) {
    this.timing = options.timing;
    this.options = {
      onSeeked: options.onSeeked,
      watchdogMs: options.watchdogMs ?? 1200,
      setTimer: options.setTimer ?? ((fn, ms) => setTimeout(fn, ms)),
      clearTimer: options.clearTimer ?? ((handle) => clearTimeout(handle as number)),
    };
    video.addEventListener("seeked", this.handleSeeked);
  }

  /** The loaded file's real duration (and frame rate) replace the configured ones. */
  setTiming(timing: Pick<ScrubTiming, "duration" | "fps">): void {
    this.timing = timing;
    this.targetFrame = Math.min(this.targetFrame, lastFrame(timing.duration, timing.fps));
  }

  /** Starts seeking once the video can show a frame (before that, targets are kept). */
  enable(): void {
    this.enabled = true;
    this.pump();
  }

  /** Requests the frame at footage time t; coalesced with any seek in flight. */
  setTarget(time: number): void {
    this.targetFrame = frameAt(time, this.timing);
    this.pump();
  }

  get frame(): number {
    return this.current;
  }

  get target(): number {
    return this.targetFrame;
  }

  /** The displayed frame is the requested one and nothing is in flight. */
  get settled(): boolean {
    return this.pending < 0 && this.current === this.targetFrame;
  }

  dispose(): void {
    this.disposed = true;
    this.clearWatchdog();
    this.video.removeEventListener("seeked", this.handleSeeked);
  }

  private pump(): void {
    if (this.disposed || !this.enabled || this.pending >= 0) return;
    if (this.video.readyState < HAVE_CURRENT_DATA && this.current < 0) {
      // Not even the first frame yet: `enable` is called again on loadeddata.
      return;
    }
    if (this.current === this.targetFrame) return;
    this.pending = this.targetFrame;
    this.video.currentTime = seekTime(this.pending, this.timing.fps);
    this.clearWatchdog();
    this.watchdog = this.options.setTimer(() => {
      // Dropped seek: forget it and ask again for the latest target.
      this.watchdog = null;
      this.pending = -1;
      this.current = -1;
      this.pump();
    }, this.options.watchdogMs);
  }

  private readonly handleSeeked = (): void => {
    if (this.disposed || this.pending < 0) return;
    this.clearWatchdog();
    this.current = this.pending;
    this.pending = -1;
    this.options.onSeeked?.(this.current);
    this.pump(); // catch up with the newest target
  };

  private clearWatchdog(): void {
    if (this.watchdog !== null) this.options.clearTimer(this.watchdog);
    this.watchdog = null;
  }
}
