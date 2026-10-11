import { expect, test, type Page } from "@playwright/test";

import { fillDateTime, login, pickRelation, romeDate, uid } from "./support";
import { USERS } from "./users";

/** Master prompt §38: the dispatch workflow end to end, through the UI. */

async function createOrder(
  page: Page,
  customer: string,
  day: string,
  from: string,
  to: string,
): Promise<string> {
  await page.goto("/admin/orders/new");
  await pickRelation(page, "Customer", customer);
  await fillDateTime(page, "Pickup", day, from);
  await fillDateTime(page, "Delivery", day, to);
  await page.getByLabel("Pickup address: Street and number (required)").fill("Via Emilia 10");
  await page.getByLabel("Pickup address: City (required)").fill("Bologna");
  await page.getByLabel("Delivery address: Street and number (required)").fill("Corso Francia 5");
  await page.getByLabel("Delivery address: City (required)").fill("Torino");
  await page.getByRole("button", { name: "Create order" }).click();
  const heading = page.getByRole("heading", { level: 1 });
  await expect(heading).toHaveText(/BSR-\d{4}-\d{5}/);
  return (await heading.innerText()).trim();
}

test("dispatch: create, pair, assign, detect conflicts, unassign, change status", async ({
  page,
}) => {
  const s = uid();
  const customer = `Ferri Logistica ${s}`;
  const driver = `Marco Neri ${s}`;
  const plate = `DS${s}`;
  const plate2 = `DT${s}`;
  const day = romeDate(2);
  await login(page, USERS.admin, "/admin/customers/new");

  // Customer, driver, vehicles.
  await page.getByLabel("Company name").fill(customer);
  await page.getByLabel("Phone").fill("+39 051 123 4567");
  await page.getByRole("button", { name: "Create customer" }).click();
  await expect(page.getByRole("heading", { level: 1, name: customer })).toBeVisible();
  await expect(page.getByRole("link", { name: "WhatsApp" }).first()).toHaveAttribute(
    "href",
    "https://wa.me/390511234567",
  );

  await page.goto("/admin/drivers/new");
  await page.getByLabel("Full name").fill(driver);
  await page.getByRole("button", { name: "Create driver" }).click();
  await expect(page.getByRole("heading", { level: 1, name: driver })).toBeVisible();

  for (const p of [plate, plate2]) {
    await page.goto("/admin/vehicles/new");
    await page.getByLabel("Plate").fill(p);
    await page.getByLabel("Vehicle type").selectOption({ label: "Motrice" });
    await page.getByRole("button", { name: "Create vehicle" }).click();
    await expect(page.getByRole("heading", { level: 1, name: p })).toBeVisible();
  }

  // Driver ↔ vehicle pairing (from the vehicle page).
  await page.getByRole("link", { name: "Vehicles" }).first().click();
  await page.getByRole("link", { name: plate, exact: true }).click();
  await page.getByRole("button", { name: "Pair with a driver" }).click();
  await pickRelation(page, "Driver", driver);
  await page.getByRole("button", { name: "Pair", exact: true }).click();
  const pairings = page.locator("section", {
    has: page.getByRole("heading", { name: "Driver pairings" }),
  });
  await expect(pairings.getByRole("row", { name: new RegExp(driver) })).toContainText("Current");

  // Order + assignment: the paired vehicle is suggested with the driver.
  const first = await createOrder(page, customer, day, "08:00", "14:00");
  const assignment = page.locator("section", {
    has: page.getByRole("heading", { name: "Driver and vehicle" }),
  });
  await assignment.getByRole("radiogroup", { name: "Driver" }).getByText(driver).click();
  await expect(
    assignment
      .getByRole("radiogroup", { name: "Vehicle" })
      .getByRole("radio", { name: new RegExp(plate) }),
  ).toBeChecked();
  await assignment.getByRole("button", { name: "Assign", exact: true }).click();
  await expect(page.locator(".a-page-header .a-status")).toHaveText("Scheduled");
  const firstUrl = page.url();

  // Calendar shows it, grouped by driver.
  await page.goto(`/admin/calendar?view=week&group=driver&date=${day}`);
  const lane = page.getByRole("row", { name: new RegExp(driver) });
  await expect(lane.getByRole("link", { name: new RegExp(first) })).toBeVisible();

  // A conflicting assignment is refused by the backend with a useful message.
  const second = await createOrder(page, customer, day, "10:00", "12:00");
  const secondUrl = page.url();
  await page.goto(`/admin/dispatch?order=${secondUrl.split("/").pop()}`);
  const panel = page.locator("section", {
    has: page.getByRole("heading", { name: "Driver and vehicle" }),
  });
  const busy = panel
    .getByRole("radiogroup", { name: "Driver" })
    .locator("label", { hasText: driver });
  await expect(busy).toContainText(`Busy: ${first}`);
  await busy.click();
  await panel.getByRole("radiogroup", { name: "Vehicle" }).getByText(plate2).click();
  await panel.getByRole("button", { name: "Assign", exact: true }).click();
  await expect(panel.getByRole("alert")).toContainText(
    `Driver ${driver} is already assigned to order ${first}`,
  );
  await expect(page.locator(".a-queue-item", { hasText: second })).toContainText("Unassigned");

  // Unassign the first order: history is kept.
  await page.goto(firstUrl);
  await assignment.getByRole("button", { name: "Unassign" }).click();
  await page
    .getByRole("dialog", { name: "Unassign driver and vehicle?" })
    .getByRole("button", { name: "Unassign" })
    .click();
  await expect(page.locator(".a-page-header .a-status")).toHaveText("Confirmed");
  const history = page.locator("section", {
    has: page.getByRole("heading", { name: "Assignment history" }),
  });
  await expect(history.getByRole("row", { name: new RegExp(driver) })).toContainText("Released");

  // Now the second order can take the driver.
  await page.goto(secondUrl);
  await assignment.getByRole("radiogroup", { name: "Driver" }).getByText(driver).click();
  await assignment.getByRole("radiogroup", { name: "Vehicle" }).getByText(plate2).click();
  await assignment.getByRole("button", { name: "Assign", exact: true }).click();
  await expect(page.locator(".a-page-header .a-status")).toHaveText("Scheduled");

  // Status change with a note → status history.
  await page.getByRole("button", { name: "Change status" }).click();
  const dialog = page.getByRole("dialog", { name: "Change status" });
  await dialog.getByRole("radio", { name: /In transit/ }).check();
  await dialog.getByLabel("Note").fill("Departed from Bologna");
  await dialog.getByRole("button", { name: "Change status" }).click();
  await expect(page.locator(".a-page-header .a-status")).toHaveText("In transit");
  const statuses = page.locator("section", {
    has: page.getByRole("heading", { name: "Status history" }),
  });
  await expect(statuses).toContainText("Departed from Bologna");
  await expect(statuses).toContainText(USERS.admin.name);

  // Audit log has the whole story.
  await page.goto(`/admin/audit?order=${secondUrl.split("/").pop()}`);
  const table = page.getByRole("table");
  for (const action of ["Created", "Assigned", "Status changed"]) {
    await expect(table.getByRole("cell", { name: action, exact: true }).first()).toBeVisible();
  }
  await expect(table.getByRole("cell", { name: USERS.admin.name }).first()).toBeVisible();
});
