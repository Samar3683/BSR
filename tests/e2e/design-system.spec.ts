import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";

/**
 * Design-system foundation checks against the developer preview, which
 * renders every primitive and state on every surface. Automated checks cover
 * a subset of accessibility; manual review of the preview is still required.
 */
const PREVIEW = "/dev/design-system";

// Read immediately after focusing, without retrying: the focus indicator must
// appear in its final state at once (it is excluded from transitions).
async function focusedRing(page: Page) {
  return page.evaluate(() => {
    const style = getComputedStyle(document.activeElement as Element);
    return {
      outlineStyle: style.outlineStyle,
      outlineWidth: style.outlineWidth,
      outlineColor: style.outlineColor,
    };
  });
}

test("has no automatically detectable WCAG 2.2 A/AA violations on any surface", async ({
  page,
}) => {
  // A full axe scan of the whole preview is slow when the suite's software-WebGL
  // hero tests share the CPU; the budget covers that, the assertion is unchanged.
  test.setTimeout(60_000);
  await page.goto(PREVIEW);

  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();

  expect(results.violations).toEqual([]);
});

test("focus ring is visible and adapts to dark and light surfaces", async ({ page, isMobile }) => {
  test.skip(isMobile, "Keyboard focus is verified on desktop.");
  await page.goto(PREVIEW);

  const darkButton = page.locator('[data-surface="carbon"] button').first();
  const lightButton = page.locator('[data-surface="soft-white"] button').first();

  await darkButton.focus();
  await page.keyboard.press("Shift+Tab");
  await page.keyboard.press("Tab");
  await expect(darkButton).toBeFocused();
  const dark = await focusedRing(page);

  await lightButton.focus();
  await page.keyboard.press("Shift+Tab");
  await page.keyboard.press("Tab");
  await expect(lightButton).toBeFocused();
  const light = await focusedRing(page);

  for (const ring of [dark, light]) {
    expect(ring.outlineStyle).toBe("solid");
    expect(ring.outlineWidth).toBe("2px");
  }
  // Soft white on dark surfaces, carbon on light surfaces.
  expect(dark.outlineColor).toBe("rgb(247, 247, 242)");
  expect(light.outlineColor).toBe("rgb(9, 11, 11)");
});

test("interactive controls meet the 44px touch target on touch devices", async ({
  page,
  isMobile,
}) => {
  test.skip(!isMobile, "Touch targets are verified on the mobile project.");
  await page.goto(PREVIEW);

  const targets = page.locator(
    "main button, main select, main input:not([type=checkbox]):not([type=radio]), main label:has(input[type=checkbox]), main label:has(input[type=radio])",
  );
  const heights = await targets.evaluateAll((elements) =>
    elements
      .filter((element) => (element as HTMLElement).offsetParent !== null)
      .map((element) => ({
        html: element.outerHTML.slice(0, 80),
        height: Math.round(element.getBoundingClientRect().height),
      })),
  );

  expect(heights.length).toBeGreaterThan(20);
  expect(heights.filter(({ height }) => height < 44)).toEqual([]);
});

test("layout does not overflow horizontally", async ({ page }) => {
  await page.goto(PREVIEW);

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});

test("reduced motion removes travel but keeps the state change", async ({ browser }) => {
  const context = await browser.newContext({ reducedMotion: "reduce" });
  const page = await context.newPage();
  await page.goto(PREVIEW);

  const dot = page.locator("[data-easing-demo]").first();
  await expect(dot).toHaveCSS("transition-duration", "0s");

  await page.getByLabel("Run easing demo (800ms each)").check();
  const { left, trackWidth } = await dot.evaluate((element) => ({
    left: element.getBoundingClientRect().right,
    trackWidth: element.parentElement!.getBoundingClientRect().right,
  }));
  expect(Math.round(left)).toBe(Math.round(trackWidth));

  await context.close();
});
