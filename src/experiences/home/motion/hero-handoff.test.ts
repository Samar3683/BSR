import { describe, expect, it } from "vitest";

import { handoffCheckpoint, ladderIndex } from "./hero-handoff";

describe("real-time handoff checkpoints", () => {
  it("H1: at the opening (progress ≤ 0.10), matching the poster", () => {
    expect(handoffCheckpoint(0, 0)).toBe("H1");
    expect(handoffCheckpoint(0.1, 0)).toBe("H1");
    expect(handoffCheckpoint(0.11, 10_000)).toBeNull();
  });

  it("H2: in the hold (0.36–0.42) only after 200 ms without scrolling", () => {
    expect(handoffCheckpoint(0.39, 199)).toBeNull();
    expect(handoffCheckpoint(0.39, 200)).toBe("H2");
    expect(handoffCheckpoint(0.36, 500)).toBe("H2");
    expect(handoffCheckpoint(0.42, 500)).toBe("H2");
  });

  it("never allows a takeover anywhere else", () => {
    for (const progress of [0.2, 0.3, 0.45, 0.6, 0.72, 0.97]) {
      expect(handoffCheckpoint(progress, 10_000)).toBeNull();
    }
  });
});

describe("still ladder", () => {
  it("maps progress to S1–S4", () => {
    expect(ladderIndex(0, 0.1)).toBe(0);
    expect(ladderIndex(0, 0.3)).toBe(1);
    expect(ladderIndex(0, 0.7)).toBe(2);
    expect(ladderIndex(0, 0.95)).toBe(3);
  });

  it("applies hysteresis around each switch point", () => {
    expect(ladderIndex(0, 0.245)).toBe(0); // not yet past 0.24 + 0.01
    expect(ladderIndex(0, 0.251)).toBe(1);
    expect(ladderIndex(1, 0.235)).toBe(1); // not yet below 0.24 − 0.01
    expect(ladderIndex(1, 0.229)).toBe(0);
  });

  it("jumps several rungs at once for fast scrolls", () => {
    expect(ladderIndex(3, 0.02)).toBe(0);
    expect(ladderIndex(0, 0.99)).toBe(3);
  });
});
