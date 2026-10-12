import { expect, test } from "@playwright/test";

import { fillDateTime, login, openAccountMenu, romeDate, uid } from "./support";
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
  await openAccountMenu(page);
  await page
    .getByRole("group", { name: "Language" })
    .getByRole("button", { name: "Italiano" })
    .click();
  await expect(page.getByRole("link", { name: "Ordini" }).first()).toBeVisible();
  await page.reload();
  await expect(page.getByRole("link", { name: "Ordini" }).first()).toBeVisible();
  await openAccountMenu(page);
  await page
    .getByRole("group", { name: "Lingua" })
    .getByRole("button", { name: "English" })
    .click();
  await expect(page.getByRole("link", { name: "Orders" }).first()).toBeVisible();
});

test("an administrator manages their own profile: name and password", async ({ page }) => {
  const user = USERS.second;
  const temporary = "Temporary-pass-2026";
  await login(page, user, "/admin");
  await openAccountMenu(page);
  await page.getByRole("link", { name: "Profile and security" }).click();
  await expect(page).toHaveURL(/\/admin\/profile$/);
  await expect(page.getByRole("heading", { level: 1, name: "Profile and security" })).toBeVisible();
  await expect(page.getByLabel("Email")).toHaveValue(user.email);

  // Name: shown in the header after saving, restored afterwards.
  const name = page.getByLabel("Name", { exact: false }).first();
  await name.fill(`${user.name} Jr`);
  await page.getByRole("button", { name: "Save name" }).click();
  await expect(page.getByText("Name updated.")).toBeVisible();
  await expect(page.locator(".a-account-name")).toHaveText(`${user.name} Jr`);
  await name.fill(user.name);
  await page.getByRole("button", { name: "Save name" }).click();
  await expect(page.locator(".a-account-name")).toHaveText(user.name);

  // Password: the current one is verified, weak ones are refused.
  await page.getByLabel("Current password").fill("wrong-password");
  await page.getByLabel("New password", { exact: true }).fill(temporary);
  await page.getByLabel("Repeat the new password").fill(temporary);
  await page.getByRole("button", { name: "Change password" }).click();
  await expect(page.getByText("The current password is not correct")).toBeVisible();

  await page.getByLabel("Current password").fill(user.password);
  await page.getByLabel("New password", { exact: true }).fill("short");
  await page.getByLabel("Repeat the new password").fill("short");
  await page.getByRole("button", { name: "Change password" }).click();
  await expect(page.getByText(/Use at least 10 characters/)).toBeVisible();

  await page.getByLabel("New password", { exact: true }).fill(temporary);
  await page.getByLabel("Repeat the new password").fill(temporary);
  await page.getByRole("button", { name: "Change password" }).click();
  await expect(page.getByText("Password changed.")).toBeVisible();

  // And back, so the shared test account keeps working.
  await page.getByLabel("Current password").fill(temporary);
  await page.getByLabel("New password", { exact: true }).fill(user.password);
  await page.getByLabel("Repeat the new password").fill(user.password);
  await page.getByRole("button", { name: "Change password" }).click();
  await expect(page.getByText("Password changed.").first()).toBeVisible();
});
