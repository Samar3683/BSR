import { readFileSync } from "node:fs";

import { expect, test } from "@playwright/test";
import type { SupabaseClient } from "@supabase/supabase-js";

import { login, romeDate, stack, uid, userClient } from "./support";
import { USERS } from "./users";

/** Seeds operational data through the API as an administrator (RLS, triggers, RPCs apply). */
async function seed(client: SupabaseClient, s: string) {
  const insert = async (
    table: string,
    attributes: Record<string, unknown>,
    extra: Record<string, unknown> = {},
  ) => {
    const { data, error } = await client
      .from(table)
      .insert({ attributes, ...extra })
      .select("id")
      .single();
    if (error) throw error;
    return (data as { id: string }).id;
  };
  const options = await client
    .from("field_options")
    .select("id, label, field_definitions!inner(field_key)");
  const option = (key: string, label: string) =>
    (
      options.data as unknown as {
        id: string;
        label: string;
        field_definitions: { field_key: string };
      }[]
    ).find((o) => o.field_definitions.field_key === key && o.label === label)!.id;

  const customer = await insert("customers", { company_name: `Report Customer ${s}` });
  const driver = await insert("drivers", { full_name: `Report Driver ${s}` });
  const vehicle = await insert("vehicles", {
    plate: `RP${s}`,
    vehicle_type: option("vehicle_type", "Van"),
  });
  const day = (offset: number, hour: number) => {
    const date = romeDate(offset);
    return new Date(`${date}T${String(hour).padStart(2, "0")}:00:00+02:00`).toISOString();
  };
  const order = async (pickup: string, delivery: string, service: string) =>
    insert(
      "orders",
      {
        service: option("service", service),
        weight_kg: 800,
        pickup_address: { line1: "Via A 1", city: "Verona" },
        delivery_address: { line1: "Via B 2", city: "Padova" },
      },
      { customer_id: customer, pickup_at: pickup, delivery_at: delivery },
    );
  const delivered = await order(
    new Date(Date.now() - 3 * 3_600_000).toISOString(),
    new Date(Date.now() + 3_600_000).toISOString(),
    "Espresso",
  );
  const open = await order(day(1, 9), day(1, 12), "Dedicato");
  const cancelled = await order(day(1, 13), day(1, 15), "Dedicato");
  for (const [fn, args] of [
    ["assign_order", { p_order_id: delivered, p_driver_id: driver, p_vehicle_id: vehicle }],
    ["change_order_status", { p_order_id: delivered, p_status: "in_transit" }],
    ["change_order_status", { p_order_id: delivered, p_status: "delivered" }],
    [
      "change_order_status",
      { p_order_id: cancelled, p_status: "cancelled", p_note: "Customer request" },
    ],
  ] as const) {
    const { error } = await client.rpc(fn, args);
    if (error) throw error;
  }
  return { customer, driver, vehicle, delivered, open, cancelled };
}

test("reports: totals, distributions, entity tables, filters, field breakdown and CSV", async ({
  page,
}) => {
  const s = uid();
  const { client } = await userClient(USERS.admin);
  await seed(client, s);
  await login(page, USERS.admin, "/admin/reports");

  await page.getByLabel("Period").selectOption("this_year");
  const kpis = page.getByLabel("Totals");
  const kpi = (label: string) =>
    kpis
      .locator(".a-kpi")
      .filter({ has: page.locator(".a-kpi-label", { hasText: new RegExp(`^${label}$`) }) })
      .locator(".a-kpi-value");
  await expect(kpi("Orders")).not.toHaveText("0");
  const ordersBefore = Number(await kpi("Orders").innerText());

  // Status distribution and entity tables come from the same data.
  await expect(
    page
      .locator("section", { hasText: "Status distribution" })
      .locator(".a-bar-row", { hasText: "Cancelled" }),
  ).toBeVisible();
  const drivers = page.locator("section", { has: page.getByRole("heading", { name: "Drivers" }) });
  await expect(drivers.getByRole("row", { name: new RegExp(`Report Driver ${s}`) })).toContainText(
    "1",
  );
  const vehicles = page.locator("section", {
    has: page.getByRole("heading", { name: "Vehicles" }),
  });
  await expect(vehicles.getByRole("row", { name: new RegExp(`RP${s}`) })).toBeVisible();

  // Status filter.
  await page
    .getByRole("group", { name: "Status" })
    .getByRole("button", { name: "Cancelled" })
    .click();
  await expect.poll(async () => Number(await kpi("Orders").innerText())).toBeLessThan(ordersBefore);
  await expect(kpi("Delivered")).toHaveText("0");
  await page
    .getByRole("group", { name: "Status" })
    .getByRole("button", { name: "Cancelled" })
    .click();

  // Entity filter (customer).
  const customerPicker = page.getByRole("combobox", { name: "Customer" });
  await customerPicker.click();
  await customerPicker.fill(`Report Customer ${s}`);
  await page.getByRole("option", { name: `Report Customer ${s}` }).click();
  await expect(kpi("Orders")).toHaveText("3");
  await expect(kpi("Cancelled")).toHaveText("1");

  // Reportable dynamic field.
  const breakdown = page.locator("section", {
    has: page.getByRole("heading", { name: "Field breakdown" }),
  });
  await breakdown.getByLabel("Reportable field").selectOption({ label: "Service" });
  await expect(
    breakdown.locator(".a-bar-row", { hasText: "Dedicato" }).locator(".a-bar-value"),
  ).toHaveText("2");

  // CSV exports (orders + an entity table).
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export orders CSV" }).click();
  const csv = readFileSync(await (await download).path(), "utf8");
  expect(csv.charCodeAt(0)).toBe(0xfeff);
  const lines = csv.trim().split(/\r\n/);
  expect(lines[0]).toContain("Order number,Status,Customer,Pickup,Delivery,Driver,Vehicle");
  expect(lines).toHaveLength(4);
  expect(csv).toContain(`Report Customer ${s}`);
  expect(csv).toContain("Delivered");
  expect(csv).toContain("Dedicato");

  const tableDownload = page.waitForEvent("download");
  await page
    .locator("section", { has: page.getByRole("heading", { name: "Customers" }) })
    .getByRole("button", { name: "CSV" })
    .click();
  const customersCsv = readFileSync(await (await tableDownload).path(), "utf8");
  expect(customersCsv).toContain(`Report Customer ${s},3,1,1,1`);
});

test("audit: mutations are recorded with actor, action, entity and before/after, and cannot be changed", async ({
  page,
}) => {
  const s = uid();
  const { client, token } = await userClient(USERS.admin);
  const { customer } = await seed(client, s);
  await client
    .from("customers")
    .update({ attributes: { email: `audit-${s.toLowerCase()}@example.it` } })
    .eq("id", customer);

  await login(page, USERS.admin, `/admin/audit?entity=customer&id=${customer}`);
  const table = page.getByRole("table");
  await expect(table.getByRole("row")).toHaveCount(3); // header + create + update
  const update = table.getByRole("row", { name: /Updated/ });
  await expect(update).toContainText(USERS.admin.name);
  await expect(update).toContainText("Customer");
  await expect(update).toContainText(`Report Customer ${s}`);
  await update.getByRole("button", { name: "Show details" }).click();
  const details = page.locator("tr", { hasText: "Entry #" });
  await expect(details).toContainText(customer);
  await expect(details.getByRole("row", { name: /Email/ })).toContainText(
    `audit-${s.toLowerCase()}@example.it`,
  );

  // No write path: the API refuses changes even for an administrator.
  const before = await client
    .from("audit_logs")
    .select("id, action", { count: "exact" })
    .eq("entity_id", customer);
  const headers = {
    apikey: stack.anonKey,
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    Prefer: "return=representation",
  };
  const patch = await fetch(`${stack.url}/rest/v1/audit_logs?entity_id=eq.${customer}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({ action: "tampered" }),
  });
  expect(patch.status).toBeGreaterThanOrEqual(400);
  const del = await fetch(`${stack.url}/rest/v1/audit_logs?entity_id=eq.${customer}`, {
    method: "DELETE",
    headers,
  });
  expect(del.status).toBeGreaterThanOrEqual(400);
  const insert = await fetch(`${stack.url}/rest/v1/audit_logs`, {
    method: "POST",
    headers,
    body: JSON.stringify({ actor_label: "x", action: "x", entity_type: "x", entity_id: "x" }),
  });
  expect(insert.status).toBeGreaterThanOrEqual(400);
  const after = await client
    .from("audit_logs")
    .select("id, action", { count: "exact" })
    .eq("entity_id", customer);
  expect(after.count).toBe(before.count);
  expect(after.data).toEqual(before.data);
  // The UI offers no way to edit or delete entries.
  await expect(page.getByRole("button", { name: /delete|edit/i })).toHaveCount(0);
});
