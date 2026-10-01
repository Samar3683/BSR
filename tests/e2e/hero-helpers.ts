import type { Page } from "@playwright/test";

/*
 * Shared helpers for the hero browser tests. They run against the production
 * test build (NEXT_PUBLIC_BSR_HERO_TEST_HOOKS=true), which exposes
 * window.__BSR_HERO__ and the ?hero-* overrides.
 */

export const REALTIME = "/?hero-path=realtime&hero-allow-software&hero-tier=low";

/**
 * Headless Chromium has no GPU; software WebGL (SwiftShader) needs this flag.
 * Only suites that deliberately exercise rendering opt in — without it the
 * browser behaves like a real machine without hardware WebGL.
 */
export const SOFTWARE_WEBGL = { launchOptions: { args: ["--enable-unsafe-swiftshader"] } };
export const HEADLINE = /Trasporti espressi e dedicati/;

export type Snapshot = {
  path: string;
  realtime: string;
  phase: string | null;
  ladderIndex: number;
  scrollTriggers: number;
  media: {
    active: { clip: string; userPaused: boolean } | null;
    played: { A: boolean; B: boolean };
  };
  metrics: {
    storyProgress: number;
    world: string;
    mode: string;
    dockDistance: number;
    dockSpeed: number;
    roadSpeed: number;
  } | null;
  audit: {
    violations: string[];
    rebases: Array<{ progress: number; coverage: number }>;
    switches: Array<{ to: string; progress: number; coverage: number }>;
  } | null;
};

export async function hero(page: Page): Promise<Snapshot> {
  return page.evaluate(() => {
    const h = window.__BSR_HERO__!;
    return {
      path: h.path,
      realtime: h.realtime,
      phase: h.phase,
      ladderIndex: h.ladderIndex,
      scrollTriggers: h.heroScrollTriggers,
      media: h.media,
      metrics: h.runtime?.metrics() ?? null,
      audit: h.runtime?.audit ?? null,
    };
  });
}

export async function waitForHero(page: Page) {
  await page.waitForFunction(() => window.__BSR_HERO__ && window.__BSR_HERO__.path !== "pending");
}

export async function waitForRealtime(page: Page, status: "active" | "failed" = "active") {
  try {
    await page.waitForFunction((s) => window.__BSR_HERO__?.realtime === s, status, {
      timeout: 45_000,
    });
  } catch (error) {
    // Say where it stopped (loading, compiling, a readiness failure…), not just "timeout".
    const state = await page
      .evaluate(() => {
        const h = window.__BSR_HERO__;
        return h && { realtime: h.realtime, phase: h.phase, failure: h.failure, tier: h.tier };
      })
      .catch(() => null);
    throw new Error(`real-time never became "${status}": ${JSON.stringify(state)}`, {
      cause: error,
    });
  }
}

/** Scrolls so the hero story sits at `progress` (0–1). */
export async function scrollHero(page: Page, progress: number) {
  await page.evaluate((p) => {
    const section = document.querySelector<HTMLElement>("[data-hero]")!;
    const range = section.offsetHeight - window.innerHeight;
    window.scrollTo({ top: section.offsetTop + p * range, behavior: "instant" });
  }, progress);
}

/** Scrolls gradually (like a visitor), one frame-ish step at a time. */
export async function glideHero(page: Page, from: number, to: number, steps = 24) {
  for (let i = 1; i <= steps; i++) {
    await scrollHero(page, from + ((to - from) * i) / steps);
    await page.waitForTimeout(60);
  }
}
