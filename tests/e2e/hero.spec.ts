import { expect, test } from "@playwright/test";

import {
  HEADLINE,
  heroHeightInViewports,
  heroVideo,
  scrubTo,
  waitForHeroVideo,
} from "./hero-helpers";

/*
 * The scroll-scrubbed video hero (components/hero-video.tsx): semantic shell,
 * scrubbing and held frames, copy and cues, fallbacks. Runs against the
 * production test build (window.__BSR_HERO_VIDEO__).
 */

const OLD_RENDERER = /\.(glb|ktx2|hdr)(\?|$)|basis_transcoder|hero-clip|fallback\/hero/;

test.describe("semantic shell (no JavaScript required)", () => {
  test("the server HTML has the hero content, actions and poster — and no player", async ({
    request,
  }) => {
    const html = await (await request.get("/")).text();
    // One H1 in three set lines (spans), read as one sentence.
    const h1 = html.match(/<h1[^>]*id="hero-title"[^>]*>([\s\S]*?)<\/h1>/)?.[1] ?? "";
    expect(
      h1
        .replace(/<[^>]+>/g, "")
        .replace(/\s+/g, " ")
        .trim(),
    ).toBe("Trasporti espressi e dedicati. Tutta Italia.");
    expect(html).toContain('href="/preventivo"');
    expect(html).toContain('href="https://wa.me/393279427723"');
    expect(html).toMatch(/<img[^>]*bsr-hero-poster[^>]*>/);
    expect(html).toMatch(
      /<img[^>]*fetchPriority="high"[^>]*bsr-hero-poster|bsr-hero-poster[^>]*fetchPriority="high"/i,
    );
    expect(html).not.toContain("<video");
    expect(html).not.toContain("<canvas");
  });

  test("without JavaScript: one static viewport, the copy, no cues", async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1, name: HEADLINE })).toBeVisible();
    const heroSection = page.locator("[data-hero]");
    await expect(
      heroSection.getByRole("link", { name: /Richiedi un preventivo/ }).first(),
    ).toHaveAttribute("href", "/preventivo");
    await expect(heroSection.getByRole("link", { name: /WhatsApp/ })).toBeVisible();
    expect(await heroHeightInViewports(page)).toBe(1);
    await expect(page.locator("[data-hero-cue]").first()).toBeHidden();
    await context.close();
  });

  test("hero text receives pointer input, not the footage behind it", async ({ page }) => {
    await page.goto("/");
    await waitForHeroVideo(page);
    await page.getByRole("heading", { level: 1, name: HEADLINE }).click({ timeout: 5000 });
    await page
      .locator("[data-hero]")
      .getByText(/Un unico referente/)
      .click({ timeout: 5000 });
  });
});

test.describe("scroll scrubbing", () => {
  test("loads the video at once, nothing of the old renderer, one ScrollTrigger", async ({
    page,
    isMobile,
  }) => {
    const media: string[] = [];
    page.on("request", (r) => {
      if (/\.mp4|\.glb|\.ktx2|\.hdr|basis_transcoder|hero-clip|fallback\/hero/.test(r.url())) {
        media.push(r.url());
      }
    });
    await page.goto("/");
    await waitForHeroVideo(page);
    const state = (await heroVideo(page))!;
    expect(state.mode).toBe("video");
    expect(state.ready).toBe(true);
    expect(state.heroScrollTriggers).toBe(1);
    expect(state.src).toBe(
      isMobile ? "/assets/video/bsr-hero-720.mp4" : "/assets/video/bsr-hero.mp4",
    );
    expect(media.filter((url) => OLD_RENDERER.test(url))).toEqual([]);
    await expect(page.locator("[data-hero] video")).toHaveCount(1);
    await expect(page.locator("canvas")).toHaveCount(0);
  });

  test("forward, back and direction changes all settle on the scroll position's frame", async ({
    page,
  }) => {
    await page.goto("/");
    await waitForHeroVideo(page);
    const frames: number[] = [];
    for (const p of [0.2, 0.55, 0.35, 0.8, 0.1, 0.97, 0]) {
      const state = await scrubTo(page, p);
      expect(state.frame).toBe(state.targetFrame);
      frames.push(state.frame);
    }
    // Forward advances, backward reverses, the ends hold the first and last frames.
    expect(frames[1]).toBeGreaterThan(frames[0]!);
    expect(frames[2]).toBeLessThan(frames[1]!);
    expect(frames[5]).toBe(360);
    expect(frames[6]).toBe(0);
    // The video itself never plays.
    expect(
      await page.locator("[data-hero] video").evaluate((v: HTMLVideoElement) => v.paused),
    ).toBe(true);
  });

  test("the copy leaves with the footage; keyboard focus brings it back", async ({ page }) => {
    await page.goto("/");
    await waitForHeroVideo(page);
    const cta = page
      .locator("[data-hero-copy]")
      .getByRole("link", { name: /Richiedi un preventivo/ });
    const copyOpacity = () =>
      page.locator("[data-hero-copy]").evaluate((el) => getComputedStyle(el).opacity);
    await expect(cta).toBeVisible();
    await scrubTo(page, 0.5);
    await expect.poll(copyOpacity).toBe("0");
    await expect(cta).toHaveCSS("pointer-events", "none");
    await expect(page.getByRole("heading", { level: 1, name: HEADLINE })).toBeAttached();
    await cta.focus();
    await expect.poll(copyOpacity).toBe("1");
    await cta.blur();
    await scrubTo(page, 0);
    await expect.poll(copyOpacity).toBe("1");
    await expect(cta).toHaveCSS("pointer-events", "auto");
  });

  test("cues appear on their scenes; hidden ones are inert", async ({ page }) => {
    await page.goto("/");
    await waitForHeroVideo(page);
    const road = page.locator('[data-hero-cue="strada"]');
    const arrival = page.locator('[data-hero-cue="arrivo"]');
    await expect(road).toHaveJSProperty("inert", true);
    await expect(arrival).toHaveJSProperty("inert", true);
    await scrubTo(page, 0.55); // ≈ 8.3 s: the empty motorway
    await expect(road).toHaveCSS("opacity", "1");
    await expect(road).toHaveJSProperty("inert", false);
    await expect(road.getByText("Dal ritiro alla destinazione.")).toBeVisible();
    await scrubTo(page, 0.97); // the ending
    await expect(road).toHaveJSProperty("inert", true);
    await expect(arrival).toHaveCSS("opacity", "1");
    await expect(arrival.getByRole("link", { name: /Richiedi un preventivo/ })).toHaveAttribute(
      "href",
      "/preventivo",
    );
  });
});

test.describe("fallbacks", () => {
  test("reduced motion: a static hero, no video download, no pinned scroll", async ({
    browser,
  }) => {
    const context = await browser.newContext({ reducedMotion: "reduce" });
    const page = await context.newPage();
    const videos: string[] = [];
    page.on("request", (r) => /\.mp4/.test(r.url()) && videos.push(r.url()));
    await page.goto("/");
    await waitForHeroVideo(page);
    expect((await heroVideo(page))!.reason).toBe("reduced-motion");
    expect(await heroHeightInViewports(page)).toBe(1);
    await page.waitForTimeout(1000);
    expect(videos).toEqual([]);
    await expect(page.locator("[data-hero] video")).toHaveCount(0);
    await context.close();
  });

  test("a missing video: the static hero, released scroll, no broken player", async ({ page }) => {
    await page.route(/\.mp4/, (route) => route.fulfill({ status: 404, body: "" }));
    await page.goto("/");
    await waitForHeroVideo(page);
    const state = (await heroVideo(page))!;
    expect(state.mode).toBe("static");
    expect(state.reason).toBe("error");
    expect(await heroHeightInViewports(page)).toBe(1);
    await expect(page.locator("[data-hero] video")).toHaveCount(0);
    await expect(page.getByRole("heading", { level: 1, name: HEADLINE })).toBeVisible();
    await expect(page.locator("[data-hero-cue]").first()).toBeHidden();
  });
});
