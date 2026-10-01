import { describe, expect, it } from "vitest";

import { HERO_CHECKPOINTS, HERO_STATES } from "../config/hero-states";
import { HERO_RIG } from "../config/hero-rig";
import { SHOT_INDEX } from "../config/hero-shots";
import { buildHeroTimeline, createStoryValues } from "./hero-timeline";

describe("master narrative timeline", () => {
  it("has duration 1 and one label per approved state", () => {
    const values = createStoryValues();
    const timeline = buildHeroTimeline(values);
    expect(timeline.duration()).toBe(1);
    for (const state of HERO_STATES) {
      expect(timeline.labels[state.name]).toBeCloseTo(state.start);
    }
  });

  it("produces the expected story values at each checkpoint", () => {
    const values = createStoryValues();
    const timeline = buildHeroTimeline(values);

    timeline.progress(HERO_CHECKPOINTS.opening);
    expect(values.shotT).toBe(SHOT_INDEX.opening);
    expect(values.headlights).toBe(0);

    timeline.progress(HERO_CHECKPOINTS.hold);
    expect(values.shotT).toBe(SHOT_INDEX.hero);
    expect(values.headlights).toBe(1);
    expect(values.dockTarget).toBe(0);

    timeline.progress(0.6);
    expect(values.shotT).toBe(SHOT_INDEX["trailer-side"]);
    expect(values.dockTarget).toBe(HERO_RIG.wipeDistance);

    timeline.progress(HERO_CHECKPOINTS.road);
    expect(values.shotT).toBe(SHOT_INDEX["road-tracking"]);
    expect(values.cruiseTarget).toBe(HERO_RIG.cruiseSpeed);

    timeline.progress(1);
    expect(values.shotT).toBe(SHOT_INDEX.italy);
    expect(values.routeBlend).toBe(1);
    expect(values.mapBlend).toBe(1);
    expect(values.europeBlend).toBe(1);
  });

  it("is a pure function of progress: scrubbing back restores earlier values", () => {
    const values = createStoryValues();
    const timeline = buildHeroTimeline(values);
    timeline.progress(0.3);
    const snapshot = { ...values };
    timeline.progress(0.95);
    timeline.progress(0.1);
    timeline.progress(0.3);
    expect(values).toEqual(snapshot);
  });

  it("keeps the truck parked (target 0) until the roll starts", () => {
    const values = createStoryValues();
    const timeline = buildHeroTimeline(values);
    for (const p of [0, 0.2, 0.42, 0.48, 0.5]) {
      timeline.progress(p);
      expect(values.dockTarget).toBe(0);
    }
  });
});
