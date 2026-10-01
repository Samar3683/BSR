import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

/**
 * Foundation smoke tests: document structure, keyboard entry point,
 * progressive enhancement and motion preference. Automated axe checks catch
 * only a subset of accessibility issues; manual evaluation is still required.
 */

test("exposes a language, a main landmark and a top-level heading", async ({ page }) => {
  await page.goto("/");

  await expect(page.locator("html")).toHaveAttribute("lang", /\S+/);
  await expect(page.getByRole("main")).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});

test("skip link is the first tab stop and moves focus to the main content", async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, "Keyboard entry point is verified on desktop.");
  await page.goto("/");

  await page.keyboard.press("Tab");
  const skipLink = page.getByRole("link", { name: /contenuto principale/i });
  await expect(skipLink).toBeFocused();

  await page.keyboard.press("Enter");
  await expect(page.getByRole("main")).toBeFocused();
});

test("has no automatically detectable WCAG 2.2 A/AA violations", async ({ page }) => {
  await page.goto("/");

  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();

  expect(results.violations).toEqual([]);
});

test.describe("without WebGL", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      const getContext = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (
        this: HTMLCanvasElement,
        ...args: Parameters<typeof getContext>
      ) {
        const [contextId] = args;
        if (contextId === "webgl" || contextId === "webgl2") return null;
        return getContext.apply(this, args);
      } as typeof getContext;
    });
  });

  test("keeps content available and mounts no canvas", async ({ page }) => {
    await page.goto("/");

    await expect(page.locator("html")).toHaveAttribute("data-experience-quality", "fallback");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.locator("canvas")).toHaveCount(0);
  });
});

test.describe("motion preference", () => {
  test("smooth scrolling is not started under reduced motion", async ({ browser }) => {
    const context = await browser.newContext({ reducedMotion: "reduce" });
    const page = await context.newPage();
    await page.goto("/");

    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("data-experience-quality", /\S+/);
    await expect(page.locator("html")).not.toHaveClass(/\blenis\b/);

    await context.close();
  });

  test("smooth scrolling starts when motion is acceptable", async ({ browser }) => {
    const context = await browser.newContext({ reducedMotion: "no-preference" });
    const page = await context.newPage();
    await page.goto("/");

    await expect(page.locator("html")).toHaveClass(/\blenis\b/);

    await context.close();
  });

  test("keyboard scrolling is not overridden by an in-flight smooth scroll", async ({
    browser,
    isMobile,
  }) => {
    test.skip(isMobile, "Wheel and keyboard input are desktop interactions.");
    const context = await browser.newContext({ reducedMotion: "no-preference" });
    const page = await context.newPage();
    await page.goto("/");
    await expect(page.locator("html")).toHaveClass(/\blenis\b/);

    // The foundation shell is one viewport tall; add scrollable length.
    await page.evaluate(() => {
      const spacer = document.createElement("div");
      spacer.style.height = "4000px";
      document.body.append(spacer);
    });
    await page.mouse.move(200, 200);

    // Lenis re-measures the page on a debounced resize observer, so retry the
    // wheel until it is interpolating a gesture (it marks <html> meanwhile).
    await expect(async () => {
      await page.mouse.wheel(0, 1200);
      await expect(page.locator("html")).toHaveClass(/\blenis-smooth\b/, { timeout: 250 });
    }).toPass();
    await page.keyboard.press("End");

    const maxScroll = await page.evaluate(
      () => document.documentElement.scrollHeight - window.innerHeight,
    );
    await expect.poll(() => page.evaluate(() => Math.round(window.scrollY))).toBe(maxScroll);

    await context.close();
  });
});
