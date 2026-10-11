import { mkdirSync } from "node:fs";

import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import { expectNoHorizontalOverflow, login, stack, uid, userClient } from "./support";
import { USERS } from "./users";

const WCAG = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
const PAGES = [
  "/admin",
  "/admin/orders",
  "/admin/orders/new",
  "/admin/dispatch",
  "/admin/calendar?view=month",
  "/admin/calendar?view=week&group=driver",
  "/admin/calendar?view=agenda",
  "/admin/vehicles",
  "/admin/drivers",
  "/admin/customers",
  "/admin/reports",
  "/admin/audit",
  "/admin/settings/fields",
  "/admin/settings/entities",
  "/admin/settings/administrators",
];

async function settle(page: Page) {
  await expect(page.locator(".a-loading, [aria-busy='true']")).toHaveCount(0, { timeout: 20_000 });
}

test.describe("admin UI quality", () => {
  test.beforeAll(async () => {
    // A little real data so tables, calendars and charts render populated.
    const { client } = await userClient(USERS.admin);
    const s = uid();
    const customer = await client
      .from("customers")
      .insert({ attributes: { company_name: `Layout Customer ${s}` } })
      .select("id")
      .single();
    const start = new Date(Date.now() + 26 * 3_600_000).toISOString();
    const end = new Date(Date.now() + 30 * 3_600_000).toISOString();
    await client.from("orders").insert({
      customer_id: customer.data!.id,
      pickup_at: start,
      delivery_at: end,
      attributes: {
        pickup_address: { line1: "Via Larga 1", city: "Milano" },
        delivery_address: { line1: "Via Stretta 2", city: "Genova" },
      },
    });
    expect(stack.url).toBeTruthy();
  });

  test("has no automatically detectable WCAG 2.2 A/AA violations", async ({ page }) => {
    // 17 full-page axe scans: more than the default per-test budget.
    test.setTimeout(240_000);
    await page.goto("/admin/login");
    const login0 = await new AxeBuilder({ page }).withTags(WCAG).analyze();
    expect(login0.violations).toEqual([]);
    await login(page, USERS.admin);
    for (const path of PAGES) {
      await page.goto(path);
      await settle(page);
      const results = await new AxeBuilder({ page }).withTags(WCAG).analyze();
      expect(results.violations, path).toEqual([]);
    }
    await page.goto("/admin/settings/fields");
    await page.getByRole("button", { name: "New field" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    const dialog = await new AxeBuilder({ page }).include(".a-dialog").withTags(WCAG).analyze();
    expect(dialog.violations).toEqual([]);
  });

  for (const width of [1440, 1024, 820, 390]) {
    test(`fits a ${width}px viewport without horizontal page scrolling`, async ({ page }) => {
      await page.setViewportSize({ width, height: width >= 1024 ? 900 : 844 });
      mkdirSync("test-results/admin-screens", { recursive: true });
      await login(page, USERS.admin);
      const sidebar = page.locator(".a-sidebar");
      if (width <= 820) {
        // Off-canvas navigation behind the menu button.
        await expect(sidebar).not.toBeInViewport();
        await page.getByRole("button", { name: "Open navigation" }).click();
        await expect(sidebar).toBeInViewport();
        await page.keyboard.press("Escape");
        await expect(sidebar).not.toBeInViewport();
      } else {
        await expect(sidebar).toBeInViewport();
        await expect(page.getByRole("link", { name: "Orders" }).first()).toBeVisible();
      }
      for (const path of PAGES) {
        await page.goto(path);
        await settle(page);
        await expectNoHorizontalOverflow(page);
        await page.screenshot({
          path: `test-results/admin-screens/${width}-${path.replace(/[/?=&]+/g, "_")}.png`,
        });
      }
      // Dialogs and the field builder fit too.
      await page.goto("/admin/settings/fields");
      await page.getByRole("button", { name: "New field" }).click();
      const dialog = page.getByRole("dialog");
      await expect(dialog).toBeVisible();
      const box = await dialog.boundingBox();
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(width);
      await page.screenshot({ path: `test-results/admin-screens/${width}-field-editor.png` });
    });
  }
});

test.describe("public site isolation", () => {
  test("the public site loads no admin code, styles, cookies or backend calls", async ({
    page,
    baseURL,
  }) => {
    await login(page, USERS.admin);
    const backendCalls: string[] = [];
    page.on("request", (request) => {
      if (request.url().startsWith(stack.url)) backendCalls.push(request.url());
    });
    const response = await page.goto("/");
    expect(response?.status()).toBe(200);
    await expect(page.locator("h1").first()).toBeVisible();
    await expect(page.locator(".adm")).toHaveCount(0);
    // The admin session cookie is not sent outside /admin.
    expect(response?.request().headers().cookie ?? "").not.toContain("bsr-admin-auth");
    const cookies = await page.context().cookies(`${baseURL}/`);
    expect(cookies.some((c) => c.name.startsWith("bsr-admin-auth"))).toBe(false);
    // No admin rules in the page's stylesheets.
    const adminRules = await page.evaluate(() =>
      Array.from(document.styleSheets).reduce((n, sheet) => {
        try {
          return n + Array.from(sheet.cssRules).filter((r) => r.cssText.includes(".adm ")).length;
        } catch {
          return n;
        }
      }, 0),
    );
    expect(adminRules).toBe(0);
    await page.waitForTimeout(500);
    expect(backendCalls).toEqual([]);
    // None of the scripts the public page loads contain the admin data layer.
    const scripts = await page.evaluate(() =>
      Array.from(document.querySelectorAll<HTMLScriptElement>("script[src]")).map((s) => s.src),
    );
    expect(scripts.length).toBeGreaterThan(0);
    for (const src of scripts) {
      const code = await (await page.request.get(src)).text();
      for (const marker of [
        "GoTrueClient",
        "PostgrestClient",
        "QueryClientProvider",
        "bsr-admin-auth",
      ]) {
        expect(code.includes(marker), `${marker} in ${src}`).toBe(false);
      }
    }
  });
});
