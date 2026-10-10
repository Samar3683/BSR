import type { Page } from "@playwright/test";

/*
 * Shared helpers for the hero browser tests. They run against the production
 * test build (NEXT_PUBLIC_BSR_HERO_TEST_HOOKS=true), which exposes
 * window.__BSR_HERO_VIDEO__ (components/hero-video.tsx).
 */

export const HEADLINE = /Trasporti espressi e dedicati/;

export type HeroVideoSnapshot = {
  mode: "pending" | "video" | "static";
  reason: string | null;
  ready: boolean;
  src: string;
  frame: number;
  targetFrame: number;
  progress: { raw: number; displayed: number };
  heroScrollTriggers: number;
};

export function heroVideo(page: Page): Promise<HeroVideoSnapshot | null> {
  return page.evaluate(() => {
    const h = window.__BSR_HERO_VIDEO__;
    if (!h) return null;
    return {
      mode: h.mode,
      reason: h.reason,
      ready: h.ready,
      src: h.src,
      frame: h.frame,
      targetFrame: h.targetFrame,
      progress: h.progress,
      heroScrollTriggers: h.heroScrollTriggers,
    };
  });
}

/** Waits until the hero has settled on a path: the video revealed, or static. */
export async function waitForHeroVideo(page: Page): Promise<void> {
  await page.waitForFunction(
    () => window.__BSR_HERO_VIDEO__?.ready || window.__BSR_HERO_VIDEO__?.mode === "static",
    null,
    { timeout: 30_000 },
  );
}

/** Scrolls to hero progress p and waits until the displayed frame is the target. */
export async function scrubTo(page: Page, p: number): Promise<HeroVideoSnapshot> {
  await page.evaluate((p) => {
    const section = document.querySelector<HTMLElement>("[data-hero]")!;
    const range = section.offsetHeight - window.innerHeight;
    window.scrollTo({ top: section.offsetTop + p * range, behavior: "instant" });
  }, p);
  await page.waitForFunction(
    (p) => Math.abs((window.__BSR_HERO_VIDEO__?.progress.displayed ?? -1) - p) < 0.01,
    p,
  );
  await page.waitForFunction(() => {
    const h = window.__BSR_HERO_VIDEO__;
    return h !== undefined && h.frame === h.targetFrame;
  });
  return (await heroVideo(page))!;
}

export function heroHeightInViewports(page: Page): Promise<number> {
  return page.evaluate(
    () =>
      Math.round(
        (document.querySelector<HTMLElement>("[data-hero]")!.offsetHeight / innerHeight) * 100,
      ) / 100,
  );
}
