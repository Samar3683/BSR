import { describe, expect, it } from "vitest";

import {
  HIDE_AFTER,
  type HeaderScroll,
  nextHeaderState,
  TOLERANCE,
  TOP_THRESHOLD,
} from "./header-state";

const run = (positions: number[], start: HeaderScroll = { state: "top", anchor: 0 }) =>
  positions.reduce<HeaderScroll[]>(
    (out, y) => [...out, nextHeaderState(out.at(-1) ?? start, y)],
    [],
  );

describe("site header state", () => {
  it("is transparent at the top of the page", () => {
    expect(nextHeaderState({ state: "hidden", anchor: 900 }, 0).state).toBe("top");
    expect(nextHeaderState({ state: "shown", anchor: 400 }, TOP_THRESHOLD).state).toBe("top");
  });

  it("hides while scrolling down past the threshold and returns (solid) on scroll up", () => {
    const states = run([40, 120, HIDE_AFTER + 50, 600, 900, 880, 850, 800]).map((s) => s.state);
    expect(states.slice(0, 2)).toEqual(["shown", "shown"]);
    expect(states.slice(2, 5)).toEqual(["hidden", "hidden", "hidden"]);
    expect(states.at(-1)).toBe("shown");
  });

  it("ignores jitter below the tolerance", () => {
    const hidden: HeaderScroll = { state: "hidden", anchor: 1000 };
    expect(nextHeaderState(hidden, 1000 - (TOLERANCE - 1)).state).toBe("hidden");
    const shown: HeaderScroll = { state: "shown", anchor: 1000 };
    expect(nextHeaderState(shown, 1000 + (TOLERANCE - 1)).state).toBe("shown");
  });

  it("never hides near the top, even when scrolling down", () => {
    expect(nextHeaderState({ state: "shown", anchor: 30 }, HIDE_AFTER - 10).state).toBe("shown");
  });
});
