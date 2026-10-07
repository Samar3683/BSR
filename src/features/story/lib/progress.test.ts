import { describe, expect, it } from "vitest";

import {
  parseRange,
  pinnedProgress,
  readingStep,
  scrollForStep,
  stepAt,
  viewProgress,
} from "./progress";

describe("scene progress", () => {
  it("runs a pinned track from its top at the viewport top to its bottom at the viewport bottom", () => {
    expect(pinnedProgress(100, 3000, 1000)).toBe(0);
    expect(pinnedProgress(0, 3000, 1000)).toBe(0);
    expect(pinnedProgress(-1000, 3000, 1000)).toBe(0.5);
    expect(pinnedProgress(-2000, 3000, 1000)).toBe(1);
    expect(pinnedProgress(-5000, 3000, 1000)).toBe(1);
  });

  it("never divides by a track no taller than the viewport", () => {
    expect(pinnedProgress(10, 800, 1000)).toBe(0);
    expect(pinnedProgress(-10, 800, 1000)).toBe(1);
  });

  it("runs a scrolling block from entering at the bottom to leaving at the top", () => {
    expect(viewProgress(1000, 1000, 1000)).toBe(0);
    expect(viewProgress(0, 1000, 1000)).toBe(0.5);
    expect(viewProgress(-1000, 1000, 1000)).toBe(1);
  });

  it("spreads steps evenly over their range, the last one held to the end", () => {
    expect(stepAt(0, 4)).toBe(0);
    expect(stepAt(0.26, 4)).toBe(1);
    expect(stepAt(0.99, 4)).toBe(3);
    expect(stepAt(1, 4)).toBe(3);
    expect(stepAt(0.1, 4, 0.2, 0.8)).toBe(0);
    expect(stepAt(0.5, 4, 0.2, 0.8)).toBe(2);
    expect(stepAt(0.9, 4, 0.2, 0.8)).toBe(3);
    expect(stepAt(0.5, 1)).toBe(0);
  });

  it("reads a plain list by the last item past the reading line", () => {
    expect(readingStep([900, 1400, 1900], 500)).toBe(0);
    expect(readingStep([100, 400, 900], 500)).toBe(1);
    expect(readingStep([-900, -400, 100], 500)).toBe(2);
  });

  it("jumps to the middle of a step's share of the range", () => {
    // Track at 1000, 4000 tall, viewport 1000: 3000px of travel.
    expect(scrollForStep(1000, 4000, 1000, 0, 2)).toBe(1000 + 0.25 * 3000);
    expect(scrollForStep(1000, 4000, 1000, 1, 2, 0.2, 0.8)).toBeCloseTo(1000 + 0.65 * 3000);
  });

  it("parses a step range, falling back to the whole scene", () => {
    expect(parseRange("0.2 0.9")).toEqual([0.2, 0.9]);
    expect(parseRange("0.1,0.6")).toEqual([0.1, 0.6]);
    expect(parseRange(undefined)).toEqual([0, 1]);
    expect(parseRange("0.9 0.2")).toEqual([0, 1]);
  });
});
