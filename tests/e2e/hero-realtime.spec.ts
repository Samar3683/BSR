import { expect, test } from "@playwright/test";

import {
  glideHero,
  HEADLINE,
  hero,
  REALTIME,
  scrollHero,
  SOFTWARE_WEBGL,
  waitForHero,
  waitForRealtime,
} from "./hero-helpers";

/*
 * Hero Phase 1 — suites that deliberately exercise rendering. Headless
 * Chromium has no GPU, so this file opts into software WebGL (file-level:
 * launch options force a dedicated worker).
 *
 * Software WebGL rasterises on the CPU, so these tests run in order (one worker
 * per project) instead of competing with each other: they verify logic, and
 * parallel CPU rendering only makes their timing noisy.
 */
test.use(SOFTWARE_WEBGL);
test.describe.configure({ mode: "default" });

test.describe("rendering path vs layout mode (WebGL available)", () => {
  test("a short desktop window stays a real-time candidate", async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 1280, height: 560 } });
    const page = await context.newPage();
    await page.goto("/?hero-allow-software");
    await waitForHero(page);
    expect((await hero(page)).path).toBe("realtime");
    await context.close();
  });
});

test.describe("real-time path", () => {
  test.skip(({ isMobile }) => isMobile, "Real-time is a desktop/tablet path.");
  test.use({ viewport: { width: 800, height: 450 } });
  test.setTimeout(120_000);

  test("one canvas, one hero ScrollTrigger, and handoff only at the opening", async ({ page }) => {
    await page.goto(REALTIME);
    await waitForRealtime(page);
    const state = await hero(page);
    expect(state.scrollTriggers).toBe(1);
    await expect(page.locator("[data-hero] canvas")).toHaveCount(1);
    expect(state.metrics?.storyProgress).toBeLessThanOrEqual(0.1);
  });

  test("the truck never drives backwards; concealed re-bases happen only under ≥ 92% cover", async ({
    page,
  }) => {
    // 64 scripted scroll steps, each sampled: long under CPU rasterisation.
    test.setTimeout(180_000);
    await page.goto(REALTIME);
    await waitForRealtime(page);

    let minSpeed = Number.POSITIVE_INFINITY;
    const sample = async () => {
      const m = (await hero(page)).metrics!;
      minSpeed = Math.min(minSpeed, m.dockSpeed, m.roadSpeed);
    };
    // Forward into the departure, back out, forward through the wipe, back again.
    for (const [from, to] of [
      [0, 0.56],
      [0.56, 0.47],
      [0.47, 0.75],
      [0.75, 0.3],
    ] as const) {
      for (let i = 1; i <= 16; i++) {
        await scrollHero(page, from + ((to - from) * i) / 16);
        await page.waitForTimeout(90);
        await sample();
      }
      await page.waitForTimeout(600);
    }

    const state = await hero(page);
    expect(state.realtime).toBe("active");
    expect(minSpeed).toBeGreaterThanOrEqual(0);
    expect(state.audit!.violations).toEqual([]);
    expect(state.audit!.rebases.length).toBeGreaterThan(0);
    for (const rebase of state.audit!.rebases) expect(rebase.coverage).toBeGreaterThanOrEqual(0.92);
    for (const change of state.audit!.switches)
      expect(change.coverage).toBeGreaterThanOrEqual(0.92);
    // Back before the departure: parked in the bay, forward mode.
    expect(state.metrics).toMatchObject({ world: "dock", mode: "forward", dockDistance: 0 });
  });

  test("late readiness: real-time never takes over mid-story, only at a matching checkpoint", async ({
    page,
  }) => {
    await page.goto(`${REALTIME}&hero-delay=2500`);
    await waitForHero(page);
    await glideHero(page, 0, 0.7, 12);
    await page.waitForFunction(() => window.__BSR_HERO__?.phase === "dormant", null, {
      timeout: 45_000,
    });
    await page.waitForTimeout(1500);
    let state = await hero(page);
    expect(state.realtime).not.toBe("active");
    expect(state.ladderIndex).toBe(2);
    await expect(page.locator("[data-hero-canvas]")).toHaveCSS("opacity", "0");

    await scrollHero(page, 0);
    await waitForRealtime(page);
    state = await hero(page);
    expect(state.metrics!.storyProgress).toBeLessThanOrEqual(0.1);
  });

  test("context loss falls back quietly to the stills", async ({ page }) => {
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    await page.goto(REALTIME);
    await waitForRealtime(page);
    await page.evaluate(() => window.__BSR_HERO__!.runtime!.simulateContextLoss());
    await waitForRealtime(page, "failed");
    await expect(page.locator("[data-hero] canvas")).toHaveCount(0);
    await expect(page.locator('img[data-still="S1"]')).toBeVisible();
    await expect(page.getByRole("heading", { level: 1, name: HEADLINE })).toBeVisible();
    expect(pageErrors).toEqual([]);
  });

  test("asset failure falls back quietly to the stills", async ({ page }) => {
    await page.goto(`${REALTIME}&hero-fail=assets`);
    await waitForRealtime(page, "failed");
    await expect(page.locator("[data-hero] canvas")).toHaveCount(0);
    await expect(page.locator('img[data-still="S1"]')).toBeVisible();
  });

  test("client-side navigation away and back leaves no duplicates", async ({ page }) => {
    await page.goto(REALTIME);
    await waitForRealtime(page);
    await page
      .locator("[data-hero]")
      .getByRole("link", { name: /Richiedi un preventivo/ })
      .click();
    await page.waitForURL("**/preventivo");
    await page.goBack();
    await waitForRealtime(page);
    expect((await hero(page)).scrollTriggers).toBe(1);
    await expect(page.locator("canvas")).toHaveCount(1);
  });
});
