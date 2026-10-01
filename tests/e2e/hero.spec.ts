import { expect, test } from "@playwright/test";

import { glideHero, HEADLINE, hero, REALTIME, scrollHero, waitForHero } from "./hero-helpers";

/*
 * Hero Phase 1 — shell, layout vs rendering path, reduced motion, no-WebGL
 * and phone media. No software WebGL here: the browser behaves like a machine
 * without hardware WebGL.
 */

test.describe("semantic shell (no JavaScript required)", () => {
  test("the server HTML contains the hero content, actions and poster", async ({ request }) => {
    const html = await (await request.get("/")).text();
    expect(html).toMatch(/<h1[^>]*id="hero-title"[^>]*>Trasporti espressi e dedicati/);
    expect(html).toContain('href="/preventivo"');
    expect(html).toContain('href="https://wa.me/393279427723"');
    expect(html).toMatch(
      /<img[^>]*fetchPriority="high"[^>]*data-still="S1"|<img[^>]*data-still="S1"[^>]*fetchPriority="high"/i,
    );
    expect(html).not.toContain("<canvas");
  });

  test("works with JavaScript disabled", async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1, name: HEADLINE })).toBeVisible();
    const heroSection = page.locator("[data-hero]");
    await expect(heroSection.getByRole("link", { name: /Richiedi un preventivo/ })).toHaveAttribute(
      "href",
      "/preventivo",
    );
    await expect(heroSection.getByRole("link", { name: /WhatsApp/ })).toBeVisible();
    await expect(page.locator('img[data-still="S1"]')).toBeVisible();
    await context.close();
  });

  test("hero text receives pointer input (selectable), not the visual stage behind it", async ({
    page,
  }) => {
    await page.goto("/");
    await waitForHero(page);
    // Playwright's actionability check fails if another layer intercepts the pointer.
    await page.getByRole("heading", { level: 1, name: HEADLINE }).click({ timeout: 5000 });
    await page
      .locator("[data-hero]")
      .getByText(/Un unico referente/)
      .click({ timeout: 5000 });
  });

  test("the copy stays through the reveal and leaves during the departure", async ({ page }) => {
    await page.goto("/");
    await waitForHero(page);
    const cta = page.locator("[data-hero]").getByRole("link", { name: /Richiedi un preventivo/ });
    await scrollHero(page, 0.3);
    await expect(cta).toBeVisible();
    const copyOpacity = () =>
      cta.evaluate((el) => getComputedStyle(el.closest("[data-hero] > div > div")!).opacity);
    await scrollHero(page, 0.7);
    // Faded: invisible and ignoring the pointer, but still in the accessibility tree.
    await expect.poll(copyOpacity).toBe("0");
    await expect(cta).toHaveCSS("pointer-events", "none");
    await expect(page.getByRole("heading", { level: 1, name: HEADLINE })).toBeAttached();
    // Keyboard focus brings it back, so focus is never on something invisible.
    await cta.focus();
    await expect.poll(copyOpacity).toBe("1");
    await cta.blur();
    await scrollHero(page, 0.2);
    await expect.poll(copyOpacity).toBe("1");
    await expect(cta).toHaveCSS("pointer-events", "auto");
  });

  test("the state 5 line is semantic by default (in the accessibility tree)", async ({ page }) => {
    await page.goto("/");
    const line = page.getByText("Dal ritiro alla destinazione.");
    await expect(line).toHaveCount(1);
    expect(await line.evaluate((el) => el.closest('[aria-hidden="true"]') === null)).toBe(true);
  });
});

test.describe("rendering path vs layout mode", () => {
  test("a phone selects the media path", async ({ page, isMobile }) => {
    test.skip(!isMobile, "Phone form factor comes from the mobile project.");
    await page.goto("/");
    await waitForHero(page);
    expect((await hero(page)).path).toBe("media");
  });

  test("without hardware WebGL the desktop hero falls back to stills", async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, "Phones use the media path, which needs no WebGL.");
    await page.goto("/");
    await waitForHero(page);
    expect((await hero(page)).path).toBe("fallback");
    await expect(page.locator("[data-hero] canvas")).toHaveCount(0);
  });
});

test.describe("reduced motion and no-WebGL paths", () => {
  test("reduced motion downloads no cinematic assets and uses the still ladder", async ({
    browser,
  }) => {
    const context = await browser.newContext({ reducedMotion: "reduce" });
    const page = await context.newPage();
    const heavy: string[] = [];
    page.on("response", async (response) => {
      const url = response.url();
      if (/\.(webm|mp4|glb|ktx2)(\?|$)/.test(url)) heavy.push(url);
      if (
        url.endsWith(".js") &&
        (await response.text().catch(() => "")).includes("WebGLRenderer")
      ) {
        heavy.push(url);
      }
    });
    await page.goto(REALTIME.replace("hero-path=realtime&", ""));
    await waitForHero(page);
    expect((await hero(page)).path).toBe("reduced");
    await glideHero(page, 0, 0.95, 10);
    await expect(page.locator('img[data-still="S4"]')).toHaveCSS("opacity", "1", {
      timeout: 10_000,
    });
    await page.waitForTimeout(1500);
    expect(heavy).toEqual([]);
    await expect(page.locator("[data-hero] canvas")).toHaveCount(0);
    await context.close();
  });

  test("no WebGL: poster + ladder, never an error or a blank canvas", async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, "Desktop fallback path.");
    await page.addInitScript(() => {
      const getContext = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (
        this: HTMLCanvasElement,
        ...args: Parameters<typeof getContext>
      ) {
        return args[0] === "webgl" || args[0] === "webgl2" ? null : getContext.apply(this, args);
      } as typeof getContext;
    });
    await page.goto("/?hero-allow-software");
    await waitForHero(page);
    expect((await hero(page)).path).toBe("fallback");
    await scrollHero(page, 0.7);
    await expect(page.locator('img[data-still="S3"]')).toHaveCSS("opacity", "1", {
      timeout: 10_000,
    });
    await expect(page.locator("[data-hero] canvas")).toHaveCount(0);
    await expect(page.getByRole("heading", { level: 1, name: HEADLINE })).toBeAttached();
  });
});

test.describe("development tooling", () => {
  test("debug checkpoint jumps are not overridden by an in-flight smooth scroll", async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, "Wheel-driven smooth scrolling is a desktop interaction.");
    await page.goto("/?hero-debug");
    await waitForHero(page);
    await expect(page.locator("html")).toHaveClass(/\blenis\b/);
    await page.mouse.move(200, 200);
    // Start a smooth wheel gesture, then jump while it is still interpolating.
    await expect(async () => {
      await page.mouse.wheel(0, 400);
      await expect(page.locator("html")).toHaveClass(/\blenis-smooth\b/, { timeout: 250 });
    }).toPass();
    // Direct DOM click: no actionability wait, so the jump lands mid-interpolation.
    await page.getByRole("button", { name: "◎ road" }).evaluate((button) => {
      (button as HTMLButtonElement).click();
    });
    await page.waitForTimeout(1200);
    expect((await hero(page)).metrics).toBeNull(); // fallback path: no runtime
    const progress = await page.evaluate(() => window.__BSR_HERO__!.progress.raw);
    expect(progress).toBeCloseTo(0.77, 1);
  });
});

test.describe("phone media path", () => {
  test.skip(({ isMobile }) => !isMobile, "Phone-only path.");
  test.setTimeout(60_000);

  test("a fast fling never queues clips and lands on the final still", async ({ page }) => {
    await page.goto("/");
    await page.waitForFunction(() => window.__BSR_HERO__?.media.active?.clip === "A", null, {
      timeout: 20_000,
    });
    await scrollHero(page, 0.95);
    await expect.poll(async () => (await hero(page)).media.active).toBeNull();
    const state = await hero(page);
    expect(state.media.played).toEqual({ A: true, B: true });
    expect(state.ladderIndex).toBe(3);
    // Nothing plays behind the still.
    expect(await page.$$eval("video", (videos) => videos.every((v) => v.paused))).toBe(true);
  });

  test("the pause control is operable while a clip plays", async ({ page }) => {
    await page.goto("/");
    await page.waitForFunction(() => window.__BSR_HERO__?.media.active?.clip === "A", null, {
      timeout: 20_000,
    });
    await page.getByRole("button", { name: /pausa/ }).click();
    await expect
      .poll(async () => (await hero(page)).media.active)
      .toMatchObject({ userPaused: true });
    await expect(page.getByRole("button", { name: /Riproduci/ })).toBeVisible();
  });

  test("going offscreen stops the clip; returning shows a still, never a replay", async ({
    page,
  }) => {
    await page.goto("/");
    await page.evaluate(() => {
      const spacer = document.createElement("div");
      spacer.style.height = "3000px";
      document.querySelector("main")!.append(spacer);
    });
    await page.waitForFunction(() => window.__BSR_HERO__?.media.active?.clip === "A", null, {
      timeout: 20_000,
    });
    await page.evaluate(() =>
      window.scrollTo({ top: document.body.scrollHeight, behavior: "instant" }),
    );
    await expect.poll(async () => (await hero(page)).media.active).toBeNull();
    await scrollHero(page, 0.05);
    await page.waitForTimeout(1500);
    const state = await hero(page);
    expect(state.media.active).toBeNull();
    expect(state.ladderIndex).toBe(1); // S2: chapter A's final still
  });
});
