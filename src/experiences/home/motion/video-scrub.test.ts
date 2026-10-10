import { describe, expect, it } from "vitest";

import {
  fadeOut,
  frameAt,
  lastFrame,
  seekTime,
  timeForProgress,
  trackAt,
  type SeekableVideo,
  VideoScrubber,
  windowOpacity,
} from "./video-scrub";

const TIMING = { duration: 15.0417, fps: 24, holdStart: 0.03, holdEnd: 0.1 };

describe("progress → footage time", () => {
  it("holds the first frame, then the last, and maps linearly between", () => {
    expect(timeForProgress(0, TIMING)).toBe(0);
    expect(timeForProgress(0.03, TIMING)).toBe(0);
    expect(timeForProgress(0.9, TIMING)).toBeCloseTo(TIMING.duration, 6);
    expect(timeForProgress(1, TIMING)).toBeCloseTo(TIMING.duration, 6);
    expect(timeForProgress(0.465, TIMING)).toBeCloseTo(TIMING.duration / 2, 6);
  });

  it("clamps out-of-range progress", () => {
    expect(timeForProgress(-1, TIMING)).toBe(0);
    expect(timeForProgress(2, TIMING)).toBeCloseTo(TIMING.duration, 6);
  });
});

describe("frames", () => {
  it("never targets past the last decodable frame", () => {
    expect(lastFrame(TIMING.duration, 24)).toBe(360);
    expect(frameAt(TIMING.duration, TIMING)).toBe(360);
    expect(frameAt(999, TIMING)).toBe(360);
    expect(frameAt(-3, TIMING)).toBe(0);
    expect(seekTime(360, 24)).toBeLessThan(TIMING.duration);
  });

  it("seeks to the middle of a frame, which maps back to the same frame", () => {
    for (const frame of [0, 1, 47, 180, 359, 360]) {
      expect(frameAt(seekTime(frame, 24), TIMING)).toBe(frame);
    }
  });
});

describe("text cue opacity", () => {
  it("fades in and out around its window", () => {
    expect(windowOpacity(7, 7.4, 9.3, 0.35)).toBe(0);
    expect(windowOpacity(7.4, 7.4, 9.3, 0.35)).toBe(1);
    expect(windowOpacity(8, 7.4, 9.3, 0.35)).toBe(1);
    expect(windowOpacity(9.3, 7.4, 9.3, 0.35)).toBe(1);
    expect(windowOpacity(9.7, 7.4, 9.3, 0.35)).toBe(0);
    const mid = windowOpacity(7.225, 7.4, 9.3, 0.35);
    expect(mid).toBeGreaterThan(0.4);
    expect(mid).toBeLessThan(0.6);
  });

  it("an open-ended cue stays on to the end", () => {
    expect(windowOpacity(15, 11.2, Number.POSITIVE_INFINITY, 0.35)).toBe(1);
  });

  it("the headline fades out over its window", () => {
    expect(fadeOut(0, 1.3, 2)).toBe(1);
    expect(fadeOut(1.3, 1.3, 2)).toBe(1);
    expect(fadeOut(2, 1.3, 2)).toBe(0);
    expect(fadeOut(5, 1.3, 2)).toBe(0);
  });
});

describe("framing track", () => {
  const track = [
    [0, 66],
    [2, 66],
    [3, 10],
  ] as const;
  it("holds before and after its keys and interpolates between them", () => {
    expect(trackAt(-1, track)).toBe(66);
    expect(trackAt(1, track)).toBe(66);
    expect(trackAt(2.5, track)).toBe(38);
    expect(trackAt(9, track)).toBe(10);
  });
});

/** A paused video whose seeks complete when the test says so. */
function fakeVideo(readyState = 4) {
  const listeners = new Set<() => void>();
  const seeks: number[] = [];
  let time = 0;
  const video: SeekableVideo & { seeks: number[]; complete(): void } = {
    readyState,
    get currentTime() {
      return time;
    },
    set currentTime(value: number) {
      time = value;
      seeks.push(value);
    },
    addEventListener: (_type, listener) => listeners.add(listener),
    removeEventListener: (_type, listener) => listeners.delete(listener),
    seeks,
    complete: () => {
      for (const listener of [...listeners]) listener();
    },
  };
  return video;
}

function manualTimers() {
  const timers = new Map<number, () => void>();
  let id = 0;
  return {
    setTimer: (fn: () => void) => {
      timers.set(++id, fn);
      return id;
    },
    clearTimer: (handle: unknown) => {
      timers.delete(handle as number);
    },
    fireAll: () => {
      for (const [key, fn] of [...timers]) {
        timers.delete(key);
        fn();
      }
    },
    get count() {
      return timers.size;
    },
  };
}

describe("seek queue", () => {
  it("waits for the first decoded frame, then seeks to the latest target", () => {
    const video = fakeVideo(1);
    const scrubber = new VideoScrubber(video, { timing: TIMING });
    scrubber.setTarget(5);
    scrubber.enable();
    expect(video.seeks).toEqual([]); // metadata only: nothing to show yet
    (video as { readyState: number }).readyState = 2;
    scrubber.enable();
    expect(video.seeks).toEqual([seekTime(120, 24)]);
  });

  it("keeps one seek in flight and catches up to the newest target", () => {
    const video = fakeVideo();
    const scrubber = new VideoScrubber(video, { timing: TIMING });
    scrubber.setTarget(1);
    scrubber.enable();
    scrubber.setTarget(2);
    scrubber.setTarget(3);
    expect(video.seeks).toEqual([seekTime(24, 24)]);
    video.complete();
    expect(scrubber.frame).toBe(24);
    expect(video.seeks).toEqual([seekTime(24, 24), seekTime(72, 24)]); // straight to the newest
    video.complete();
    expect(scrubber.frame).toBe(72);
    expect(scrubber.settled).toBe(true);
  });

  it("follows direction changes and settles on the final position", () => {
    const video = fakeVideo();
    const scrubber = new VideoScrubber(video, { timing: TIMING });
    scrubber.enable();
    video.complete(); // the initial seek to the starting position
    for (const t of [4, 6, 5, 3, 3.5]) {
      scrubber.setTarget(t);
      video.complete();
    }
    expect(scrubber.frame).toBe(frameAt(3.5, TIMING));
    expect(scrubber.settled).toBe(true);
  });

  it("does not seek again for a target inside the current frame", () => {
    const video = fakeVideo();
    const scrubber = new VideoScrubber(video, { timing: TIMING });
    scrubber.setTarget(2);
    scrubber.enable();
    video.complete();
    scrubber.setTarget(2.01);
    expect(video.seeks.length).toBe(1);
  });

  it("retries a dropped seek", () => {
    const video = fakeVideo();
    const timers = manualTimers();
    const scrubber = new VideoScrubber(video, { timing: TIMING, ...timers });
    scrubber.setTarget(4);
    scrubber.enable();
    expect(video.seeks.length).toBe(1);
    timers.fireAll(); // no `seeked` arrived
    expect(video.seeks.length).toBe(2);
    video.complete();
    expect(scrubber.frame).toBe(96);
    expect(timers.count).toBe(0);
  });

  it("clamps to the loaded file's real duration", () => {
    const video = fakeVideo();
    const scrubber = new VideoScrubber(video, { timing: TIMING });
    scrubber.setTiming({ duration: 10, fps: 24 });
    scrubber.setTarget(14);
    scrubber.enable();
    expect(video.seeks.at(-1)).toBe(seekTime(239, 24));
  });

  it("stops listening when disposed", () => {
    const video = fakeVideo();
    const scrubber = new VideoScrubber(video, { timing: TIMING });
    scrubber.enable();
    scrubber.setTarget(1);
    scrubber.dispose();
    video.complete();
    expect(scrubber.frame).toBe(-1);
  });
});
