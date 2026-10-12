import { expect, test, type Page } from "@playwright/test";

import { login, uid } from "./support";
import { USERS } from "./users";

/**
 * The complete dynamic-field workflow (master prompt §37) against the real
 * backend: configure a field in Settings, use it in forms, lists, search,
 * filters and reports, then archive it and check history stays intact.
 */
const fieldRow = (page: Page, label: string) =>
  page
    .getByRole("listitem")
    .filter({ has: page.locator(".a-field-title strong", { hasText: label }) });

test("an administrator configures a field and the whole panel follows it", async ({ page }) => {
  const suffix = uid();
  const plate = `DF${suffix}`;
  await login(page, USERS.admin, "/admin/settings/fields");

  // 1–6. Settings → Vehicles → new single-select field with options and behaviour.
  await page.getByRole("button", { name: "Vehicles", exact: true }).click();
  await expect(page).toHaveURL(/entity=vehicle/);
  await page.getByRole("button", { name: "New field" }).click();
  const dialog = page.getByRole("dialog", { name: /New field/ });
  await dialog.getByRole("textbox", { name: "Label", exact: true }).fill("Fuel type");
  await expect(dialog.getByLabel(/^Key/)).toHaveValue("fuel_type");
  await dialog.getByRole("combobox", { name: "Type", exact: true }).selectOption("single_select");
  await dialog.getByLabel("Initial options").fill("Diesel\nLNG\nElectric");
  for (const name of ["Searchable", "Filterable", "Sortable", "Reportable"]) {
    await dialog.getByRole("switch", { name }).check();
  }
  await dialog.getByRole("button", { name: "Create field" }).click();
  await expect(dialog).toBeHidden();
  await expect(fieldRow(page, "Fuel type")).toBeVisible();

  // A validated text field: pattern + required.
  await page.getByRole("button", { name: "New field" }).click();
  const textDialog = page.getByRole("dialog", { name: /New field/ });
  await textDialog.getByRole("textbox", { name: "Label", exact: true }).fill("Insurance code");
  await textDialog.getByRole("switch", { name: "Required" }).check();
  await textDialog.getByLabel("Pattern (regular expression)").fill("^[A-Z]{3}[0-9]{4}$");
  await textDialog
    .getByLabel("Message when the pattern does not match")
    .fill("Use 3 letters and 4 digits");
  await textDialog.getByRole("button", { name: "Create field" }).click();
  await expect(textDialog).toBeHidden();

  // 7. Reorder: move the new field up one place.
  const before = await page.locator(".a-field-title strong").allInnerTexts();
  await page.getByRole("button", { name: "Move Fuel type up" }).click();
  await expect
    .poll(async () =>
      (await page.locator(".a-field-title strong").allInnerTexts()).indexOf("Fuel type"),
    )
    .toBe(before.indexOf("Fuel type") - 1);

  // 8–12. Visibility, then options: rename, reorder, archive.
  await page.getByRole("button", { name: "Edit Fuel type" }).click();
  const edit = page.getByRole("dialog", { name: /Edit field/ });
  await expect(edit.getByRole("switch", { name: "Record page" })).toBeChecked();
  const option = edit.getByLabel("Option label: Diesel");
  await option.fill("Diesel B7");
  await option.press("Enter");
  await expect(edit.getByLabel("Option label: Diesel B7")).toBeVisible();
  await edit.getByRole("button", { name: "Move LNG up" }).click();
  await expect(edit.locator(".a-option-row input").first()).toHaveValue("LNG");
  await edit.getByRole("button", { name: "Archive Electric" }).click();
  await expect(edit.getByLabel("Option label: Electric")).toHaveCount(0);
  await edit.getByRole("button", { name: "Save field" }).click();
  await expect(edit).toBeHidden();

  // 13–17. The create form renders the field dynamically; validation is enforced.
  await page.goto("/admin/vehicles/new");
  await page.getByLabel("Plate").fill(plate);
  await page.getByLabel("Vehicle type").selectOption({ label: "Van" });
  const fuel = page.getByLabel("Fuel type");
  await expect(fuel.locator("option")).toHaveText(["Select…", "LNG", "Diesel B7"]);
  await fuel.selectOption({ label: "Diesel B7" });
  await page.getByLabel("Insurance code").fill("bad");
  await page.getByRole("button", { name: "Create vehicle" }).click();
  await expect(page.getByText("Use 3 letters and 4 digits")).toBeVisible();
  await page.getByLabel("Insurance code").fill("ABC1234");
  await page.getByRole("button", { name: "Create vehicle" }).click();

  // 18–19. The record page shows the value.
  await expect(page.getByRole("heading", { level: 1, name: plate })).toBeVisible();
  const details = page.locator("section", { has: page.getByRole("heading", { name: "Details" }) });
  await expect(
    details.locator("dt", { hasText: "Fuel type" }).locator("xpath=following-sibling::dd[1]"),
  ).toHaveText("Diesel B7");

  // 20. Edit the value.
  await page.getByRole("link", { name: "Edit" }).click();
  await page.getByLabel("Fuel type").selectOption({ label: "LNG" });
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(
    details.locator("dt", { hasText: "Fuel type" }).locator("xpath=following-sibling::dd[1]"),
  ).toHaveText("LNG");
  const vehicleUrl = page.url();

  // 21. Search by the field (option labels are searchable).
  await page.goto("/admin/vehicles");
  await page.getByLabel("Search vehicles").fill("LNG");
  await expect(page.getByRole("link", { name: plate })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "Fuel type" })).toBeVisible();

  // 22. Filter by the field.
  await page.getByLabel("Search vehicles").fill("");
  await page.getByRole("button", { name: "Filters" }).click();
  await page.getByLabel("Add a filter").selectOption({ label: "Fuel type" });
  await page.getByRole("group", { name: "Fuel type value" }).getByLabel("LNG").check();
  await expect(page.getByRole("link", { name: plate })).toBeVisible();
  await page.getByRole("group", { name: "Fuel type value" }).getByLabel("LNG").uncheck();
  await page.getByRole("group", { name: "Fuel type value" }).getByLabel("Diesel B7").check();
  await expect(page.getByText("No matching vehicles")).toBeVisible();

  // 23. Use the field in reporting.
  await page.goto("/admin/reports?bentity=vehicle&bfield=fuel_type");
  const breakdown = page.locator("section", {
    has: page.getByRole("heading", { name: "Field breakdown" }),
  });
  await expect(
    breakdown.locator(".a-bar-row", { hasText: "LNG" }).locator(".a-bar-value"),
  ).toHaveText("1");

  // 24. Archive the field.
  await page.goto("/admin/settings/fields?entity=vehicle");
  await page.getByRole("button", { name: "Archive Fuel type" }).click();
  await page
    .getByRole("dialog", { name: "Archive this field?" })
    .getByRole("button", { name: "Archive field" })
    .click();
  await expect(fieldRow(page, "Fuel type")).toHaveCount(0);
  // Leave the configuration as other tests expect it: retire the required test field too.
  await page.getByRole("button", { name: "Archive Insurance code" }).click();
  await page
    .getByRole("dialog", { name: "Archive this field?" })
    .getByRole("button", { name: "Archive field" })
    .click();
  await expect(fieldRow(page, "Insurance code")).toHaveCount(0);
  // Archived fields stay listed on demand, with their usage.
  await page.getByLabel(/Show archived/).check();
  await expect(fieldRow(page, "Fuel type")).toContainText("1 record");

  // 25. Historical data remains, read-only; new forms no longer show the field.
  await page.goto(vehicleUrl);
  const retired = page.locator("section", {
    has: page.getByRole("heading", { name: "Values of retired fields" }),
  });
  const retiredValue = (label: string) =>
    retired.locator("dt", { hasText: label }).locator("xpath=following-sibling::dd[1]");
  await expect(retiredValue("Fuel type")).toContainText("LNG");
  await expect(retiredValue("Insurance code")).toContainText("ABC1234");
  await page.goto("/admin/vehicles/new");
  await expect(page.getByLabel("Plate")).toBeVisible();
  await expect(page.getByLabel("Fuel type")).toHaveCount(0);
});
