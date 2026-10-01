import { describe, expect, it } from "vitest";

import { HERO_MARKS } from "../config/hero-states";
import {
  gateProgress,
  INITIAL_STORY_CONTROL,
  returnOcclusionProgress,
  type StoryControlState,
  stepStoryControl,
} from "./hero-story-control";

const COVERED = 1;
const EXPOSED = 0.4;

function run(state: StoryControlState, progress: number, dockDistance: number, coverage: number) {
  return stepStoryControl(state, { progress, dockDistance, coverage });
}

describe("world switching (trailer wipe)", () => {
  it("switches dock → road only at the switch point and under trailer cover", () => {
    const state = { ...INITIAL_STORY_CONTROL, peak: 0.59 };
    expect(run(state, 0.61, 5, EXPOSED).switchedTo).toBeNull();
    expect(run(state, 0.59, 5, COVERED).switchedTo).toBeNull();
    const switched = run(state, HERO_MARKS.wipeSwitchForward, 5, COVERED);
    expect(switched.switchedTo).toBe("road");
    expect(switched.rebase).toBe(false);
  });

  it("switching back to the dock re-bases the truck to the bay under cover (never drives back)", () => {
    const road: StoryControlState = { ...INITIAL_STORY_CONTROL, world: "road", peak: 0.7 };
    expect(run(road, 0.598, 22, COVERED).switchedTo).toBeNull(); // hysteresis band
    expect(run(road, 0.59, 22, EXPOSED).switchedTo).toBeNull();
    const back = run(road, HERO_MARKS.wipeSwitchBack, 22, COVERED);
    expect(back.switchedTo).toBe("dock");
    expect(back.rebase).toBe(true);
    expect(back.state).toMatchObject({ mode: "return", rebased: true, returnEntry: "road" });
  });
});

describe("return mode (scroll-back through the departure)", () => {
  const rolling: StoryControlState = { ...INITIAL_STORY_CONTROL, peak: 0.55 };

  it("does not start while the truck is still parked", () => {
    expect(run(rolling, 0.5, 0, EXPOSED).state.mode).toBe("forward");
  });

  it("starts when progress drops below its peak with the truck away from the bay", () => {
    const { state, rebase } = run(rolling, 0.53, 3, EXPOSED);
    expect(state.mode).toBe("return");
    expect(state.returnFrom).toBe(0.53);
    expect(state.returnOcclusionAt).toBeCloseTo(returnOcclusionProgress(0.53));
    expect(rebase).toBe(false);
  });

  it("re-bases only while the trailer covers ≥ 92% of the frame", () => {
    let { state } = run(rolling, 0.53, 3, EXPOSED);
    const exposed = run(state, 0.5, 3, 0.91);
    expect(exposed.rebase).toBe(false);
    const covered = run(exposed.state, state.returnOcclusionAt, 3, 0.92);
    expect(covered.rebase).toBe(true);
    state = covered.state;
    expect(run(state, 0.47, 0, COVERED).rebase).toBe(false); // only once
  });

  it("stays in return mode while the visitor rests mid-return", () => {
    const { state } = run(rolling, 0.53, 3, EXPOSED);
    expect(run(state, 0.53, 3, EXPOSED).state.mode).toBe("return");
  });

  it("ends at the return exit and when scrolling forward past its start", () => {
    const { state } = run(rolling, 0.53, 3, EXPOSED);
    expect(run(state, HERO_MARKS.returnExit, 0, EXPOSED).state.mode).toBe("forward");
    expect(run(state, 0.54, 3, EXPOSED).state.mode).toBe("forward");
  });
});

describe("occlusion gates", () => {
  it("holds the story at the forward switch point for a frame when a scroll would jump across it", () => {
    expect(gateProgress(INITIAL_STORY_CONTROL, 0.55, 0.7)).toBe(HERO_MARKS.wipeSwitchForward);
    expect(gateProgress(INITIAL_STORY_CONTROL, 0.4, 0.5)).toBe(0.5);
  });

  it("holds at the reverse switch point when leaving the road world", () => {
    const road = { ...INITIAL_STORY_CONTROL, world: "road" as const };
    expect(gateProgress(road, 0.7, 0.3)).toBe(HERO_MARKS.wipeSwitchBack);
  });

  it("holds at the return occlusion point until the re-base has happened", () => {
    const returning: StoryControlState = {
      ...INITIAL_STORY_CONTROL,
      mode: "return",
      returnFrom: 0.55,
      returnOcclusionAt: returnOcclusionProgress(0.55),
      rebased: false,
    };
    expect(gateProgress(returning, 0.54, 0.4)).toBeCloseTo(returning.returnOcclusionAt);
    expect(gateProgress({ ...returning, rebased: true }, 0.54, 0.4)).toBe(0.4);
  });
});
