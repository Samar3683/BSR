import { expect, test } from "@playwright/test";

import { fillDateTime, login, romeDate, uid } from "./support";
import { USERS } from "./users";

/** Workflow improvements: search, quick create, timeline, week grid, rules, language. */

test("global search finds records and opens them", async ({ page }) => {
  const s = uid();
  const name = `Quick Search ${s}`;
  await login(page, USERS.admin, "/admin/customers/new");
  await page.getByLabel("Company name").fill(name);
  await page.getByRole("button", { name: "Create customer" }).click();
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();

  await page.goto("/admin");
  await page.keyboard.press("Control+k");
  const dialog = page.getByRole("dialog", { name: "Search" });
  await dialog.getByRole("combobox").fill(name);
  await dialog.getByRole("option", { name: new RegExp(name) }).click();
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
});

test("an order form can create its customer on the spot and save another", async ({ page }) => {
  const s = uid();
  const company = `Inline Customer ${s}`;
  const day = romeDate(3);
  await login(page, USERS.admin, "/admin/orders/new");

  // Section headings, 15-minute steps and the Italy default.
  await expect(page.getByRole("heading", { name: "Schedule" })).toBeVisible();
  await expect(page.getByLabel("Pickup time")).toHaveAttribute("step", "900");
  await page.getByRole("combobox", { name: "Customer" }).click();
  await page.getByRole("option", { name: /Create new/ }).click();
  const quick = page.getByRole("dialog", { name: /New customer/ });
  await quick.getByLabel("Company name").fill(company);
  await quick.getByRole("button", { name: "Create customer" }).click();
  await expect(page.getByRole("combobox", { name: "Customer" })).toHaveValue(company);

  // Delivery day follows the pickup day.
  await fillDateTime(page, "Pickup", day, "08:00");
  await expect(page.getByLabel("Delivery date")).toHaveValue(day);
  await fillDateTime(page, "Delivery", day, "12:00");
  await page.getByLabel("Pickup address: Street and number (required)").fill("Via Roma 1");
  await page.getByLabel("Pickup address: City (required)").fill("Milano");
  await page.getByLabel("Delivery address: Street and number (required)").fill("Via Po 2");
  await page.getByLabel("Delivery address: City (required)").fill("Torino");
  await page.getByRole("button", { name: "Save and create another" }).click();
  await expect(page.getByText("Order created.")).toBeVisible();
  await expect(page).toHaveURL(/\/admin\/orders\/new/);
  await expect(page.getByLabel("Pickup address: Street and number (required)")).toHaveValue("");
});

test("dispatch timeline, calendar hours and dispatch rules render real data", async ({ page }) => {
  await login(page, USERS.admin, "/admin/dispatch?tab=timeline");
  await expect(page.getByRole("table", { name: /by driver/ })).toBeVisible();
  await page.getByRole("button", { name: "Vehicles", exact: true }).click();
  await expect(page.getByRole("table", { name: /by vehicle/ })).toBeVisible();

  await page.goto("/admin/calendar?view=week");
  await expect(page.getByRole("table", { name: "Week by hour" })).toBeVisible();

  await page.goto("/admin/settings/dispatch-rules");
  await expect(page.getByRole("heading", { name: "Dispatch rules" })).toBeVisible();
  const rule = page.getByRole("checkbox", { name: "Articolato accepts CE" });
  await rule.click();
  await expect(rule).toBeChecked();
  await page.reload();
  await expect(rule).toBeChecked();
  await rule.click();
  await expect(rule).not.toBeChecked();
});

test("the interface can be switched to Italian and back", async ({ page }) => {
  await login(page, USERS.admin, "/admin/orders");
  await page.getByRole("group", { name: "Language" }).getByRole("button", { name: "IT" }).click();
  await expect(page.getByRole("link", { name: "Ordini" }).first()).toBeVisible();
  await page.reload();
  await expect(page.getByRole("link", { name: "Ordini" }).first()).toBeVisible();
  await page.getByRole("group", { name: "Lingua" }).getByRole("button", { name: "EN" }).click();
  await expect(page.getByRole("link", { name: "Orders" }).first()).toBeVisible();
});
