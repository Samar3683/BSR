import { describe, expect, it } from "vitest";

import { HERO_STATES, heroStateAt } from "../config/hero-states";
import { JUMP_CATCH_UP_MS, ProgressController } from "./hero-progress";

describe("hero states", () => {
  it("cover 0–1 contiguously in the approved order", () => {
    expect(HERO_STATES.map((state) => state.name)).toEqual([
      "clarity",
      "detail",
      "reveal",
      "departure",
      "road",
      "route",
    ]);
    expect(HERO_STATES[0]!.start).toBe(0);
    expect(HERO_STATES.at(-1)!.end).toBe(1);
    for (let i = 1; i < HERO_STATES.length; i++) {
      expect(HERO_STATES[i]!.start).toBe(HERO_STATES[i - 1]!.end);
    }
  });

  it("maps progress to states at the boundaries", () => {
    expect(heroStateAt(0)).toBe("clarity");
    expect(heroStateAt(0.12)).toBe("detail");
    expect(heroStateAt(0.419)).toBe("reveal");
    expect(heroStateAt(0.6)).toBe("road");
    expect(heroStateAt(1)).toBe("route");
    expect(heroStateAt(-3)).toBe("clarity");
  });
});

describe("progress controller", () => {
  it("passes small changes straight through", () => {
    const controller = new ProgressController();
    controller.setRaw(0.05, 0);
    expect(controller.displayed).toBe(0.05);
    controller.setRaw(0.2, 16);
    expect(controller.displayed).toBe(0.2);
  });

  it("catches up after a jump within 350 ms, then equals raw", () => {
    const controller = new ProgressController();
    controller.setRaw(0.9, 0);
    expect(controller.displayed).toBe(0);
    controller.update(JUMP_CATCH_UP_MS / 2);
    expect(controller.displayed).toBeGreaterThan(0);
    expect(controller.displayed).toBeLessThan(0.9);
    controller.update(JUMP_CATCH_UP_MS);
    expect(controller.displayed).toBe(0.9);
    expect(controller.isCatchingUp).toBe(false);
  });

  it("overwrites a running catch-up instead of queueing a second one", () => {
    const controller = new ProgressController();
    controller.setRaw(0.9, 0);
    controller.update(100);
    controller.setRaw(0.1, 120); // jump back while still catching up
    controller.update(120 + JUMP_CATCH_UP_MS);
    expect(controller.displayed).toBe(0.1);
    expect(controller.isCatchingUp).toBe(false);
  });

  it("keeps the original deadline when small changes arrive during a catch-up", () => {
    const controller = new ProgressController();
    controller.setRaw(0.8, 0);
    controller.setRaw(0.82, 100);
    controller.update(JUMP_CATCH_UP_MS);
    expect(controller.displayed).toBe(0.82);
  });

  it("reports idle time since the last scroll change", () => {
    const controller = new ProgressController();
    controller.setRaw(0.4, 1000);
    expect(controller.idleMs(1150)).toBe(150);
  });
});
