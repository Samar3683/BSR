import { describe, expect, it } from "vitest";

import { classifyReadiness, FrameMonitor } from "./frame-monitor";

function feed(monitor: FrameMonitor, frameMs: number, seconds: number) {
  const verdicts: string[] = [];
  for (let t = 0; t <= seconds * 1000; t += frameMs) verdicts.push(monitor.record(frameMs));
  return verdicts;
}

describe("frame monitor", () => {
  it("stays quiet at 60 and at 30 fps (30 fps is fine for the cinematic)", () => {
    expect(feed(new FrameMonitor(), 16.7, 10)).toEqual(expect.not.arrayContaining(["downgrade", "critical"]));
    expect(feed(new FrameMonitor(), 33.3, 10)).toEqual(expect.not.arrayContaining(["downgrade", "critical"]));
  });

  it("20 fps exactly (vsync-quantised 50 ms) is not below 20 fps", () => {
    expect(feed(new FrameMonitor(), 50, 10)).toEqual(expect.not.arrayContaining(["downgrade", "critical"]));
  });

  it("sustained <20 fps downgrades after two consecutive slow windows", () => {
    const verdicts = feed(new FrameMonitor(), 55, 6);
    const first = verdicts.indexOf("downgrade");
    expect(first).toBeGreaterThan(0);
    expect(first * 55).toBeGreaterThanOrEqual(4000); // two windows of 2 s
    expect(verdicts).not.toContain("critical");
  });

  it("a single slow window (e.g. a hitch) does not downgrade", () => {
    const monitor = new FrameMonitor();
    const verdicts = [...feed(monitor, 60, 2.1), ...feed(monitor, 33.3, 4)];
    expect(verdicts).not.toContain("downgrade");
  });

  it("sustained <15 fps is critical", () => {
    expect(feed(new FrameMonitor(), 80, 5)).toContain("critical");
    expect(feed(new FrameMonitor(), 66.7, 10)).not.toContain("critical"); // exactly 15 fps
  });

  it("sparse samples (on-demand rendering between scroll inputs) never add up to a verdict", () => {
    const monitor = new FrameMonitor();
    // Eight slow samples spread over a long time: under the minimum sample count.
    const verdicts = Array.from({ length: 8 }, () => monitor.record(300));
    expect(verdicts).toEqual(Array(8).fill("ok"));
  });

  it("after a verdict the monitor starts over (new settings, new evidence)", () => {
    const monitor = new FrameMonitor();
    const verdicts = feed(monitor, 55, 4.2);
    expect(verdicts.filter((v) => v === "downgrade")).toHaveLength(1);
  });
});

describe("readiness check (a few frames behind the poster, no benchmark)", () => {
  it("needs ~30 fps (median) and a first frame within 100 ms", () => {
    expect(classifyReadiness({ firstSubmitMs: 20, intervalsMs: [16, 17, 16, 17, 16] })).toBe("pass");
    expect(classifyReadiness({ firstSubmitMs: 20, intervalsMs: [33, 34, 33, 33, 34] })).toBe("pass");
    expect(classifyReadiness({ firstSubmitMs: 20, intervalsMs: [50, 50, 50, 33, 50] })).toBe("fail");
    expect(classifyReadiness({ firstSubmitMs: 140, intervalsMs: [16, 17, 16, 17, 16] })).toBe("fail");
  });

  it("one hitch does not fail it", () => {
    expect(classifyReadiness({ firstSubmitMs: 20, intervalsMs: [16, 90, 17, 16, 17] })).toBe("pass");
  });
});
