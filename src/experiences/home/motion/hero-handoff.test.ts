import { describe, expect, it } from "vitest";

import { handoffCheckpoint, ladderIndex, withinHandoffWindow } from "./hero-handoff";

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

  it("H3/H4: on the open road and the Italy overview, once the road world is loaded", () => {
    expect(handoffCheckpoint(0.77, 500, true)).toBe("H3");
    expect(handoffCheckpoint(0.97, 500, true)).toBe("H4");
    expect(handoffCheckpoint(1, 500, true)).toBe("H4");
    expect(handoffCheckpoint(0.77, 199, true)).toBeNull();
    // Without the road world there is nothing to show there.
    expect(handoffCheckpoint(0.77, 10_000, false)).toBeNull();
    expect(handoffCheckpoint(0.97, 10_000, false)).toBeNull();
  });

  it("never allows a takeover anywhere else", () => {
    for (const progress of [0.2, 0.3, 0.45, 0.6, 0.62, 0.85, 0.92]) {
      expect(handoffCheckpoint(progress, 10_000, true)).toBeNull();
    }
  });

  it("keeps validation only inside a handoff window", () => {
    expect(withinHandoffWindow(0.05, false)).toBe(true);
    expect(withinHandoffWindow(0.39, false)).toBe(true);
    expect(withinHandoffWindow(0.77, true)).toBe(true);
    expect(withinHandoffWindow(0.77, false)).toBe(false);
    expect(withinHandoffWindow(0.5, true)).toBe(false);
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
