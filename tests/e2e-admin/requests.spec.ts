import { expect, test } from "@playwright/test";

import { adminQuery, api, BASE_URL, fillDateTime, login, romeDate, uid } from "./support";
import { USERS } from "./users";

/** The public site's quote form reaches the admin panel through the backend. */

const post = (path: string, body: unknown) =>
  fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

test("a quote request sent on the public site appears in the inbox and becomes an order", async ({
  page,
}) => {
  const s = uid();
  const name = `Visitor ${s}`;
  const request = {
    name,
    email: `visitor-${s.toLowerCase()}@example.it`,
    phone: "+39 333 1234567",
    pickup: { street: "Via Roma 10", zip: "41012", city: "Carpi", province: "MO" },
    delivery: { street: "5 Rue de la Gare", zip: "69001", city: "Lione", province: "Rhône" },
    context: { service: "Espresso" },
  };

  // The public endpoint: no session needed, input is validated.
  const created = await post("/api/quote-requests", { ...request, elapsed: 6000 });
  expect(created.status).toBe(201);
  const { reference } = (await created.json()) as { reference: string };
  expect(reference).toMatch(/^RQ-\d{4}-\d{5}$/);
  const invalid = await post("/api/quote-requests", { ...request, phone: "1", elapsed: 6000 });
  expect(invalid.status).toBe(422);
  // A script that submits instantly is told "ok" but nothing is stored.
  const before = await adminQuery("select 1 from public.quote_requests");
  const bot = await post("/api/quote-requests", { ...request, name: "Bot", elapsed: 10 });
  expect(bot.status).toBe(200);
  expect(await adminQuery("select 1 from public.quote_requests")).toHaveLength(before.length);

  // Contact clicks are counted without any personal data.
  expect(
    (await post("/api/contact-events", { channel: "whatsapp", page: "/preventivo" })).status,
  ).toBe(204);
  const [event] = await adminQuery<{ channel: string; page: string }>(
    "select channel, page from public.contact_events order by id desc limit 1",
  );
  expect(event).toEqual({ channel: "whatsapp", page: "/preventivo" });

  // The inbox.
  await login(page, USERS.admin, "/admin/requests");
  await expect(page.getByRole("link", { name: /Requests.*new requests/ })).toBeVisible();
  const row = page.getByRole("row", { name: new RegExp(reference) });
  await expect(row).toContainText(name);
  await expect(row).toContainText("Carpi → Lione");
  await expect(row).toContainText("New");
  await expect(page.getByText("Contact clicks · last 30 days")).toBeVisible();

  // The request, then the order entered in the prefilled form.
  await row.getByRole("link", { name: reference }).click();
  await expect(page.getByRole("heading", { level: 1, name: reference })).toBeVisible();
  await expect(page.getByText("5 Rue de la Gare, 69001 Lione (Rhône)")).toBeVisible();
  await page.getByRole("button", { name: "Create order" }).click();
  await page.waitForURL(/\/admin\/orders\/new\?request=/);
  await expect(page.getByText(`Prefilled from request ${reference}`)).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Customer" })).toHaveValue(name);
  await expect(page.getByLabel("Pickup address: City (required)")).toHaveValue("Carpi");
  await expect(page.getByLabel("Delivery address: City (required)")).toHaveValue("Lione");
  const day = romeDate(3);
  await fillDateTime(page, "Pickup", day, "08:00");
  await fillDateTime(page, "Delivery", day, "16:00");
  await page.getByRole("button", { name: "Create order" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(/BSR-\d{4}-\d{5}/);

  // The request is linked and converted.
  await page.goto(`/admin/requests?status=converted`);
  await expect(page.getByRole("row", { name: new RegExp(reference) })).toContainText("Converted");
  await page.getByRole("link", { name: reference }).click();
  await expect(page.getByRole("link", { name: "Open order" })).toBeVisible();

  // Personal data can be erased.
  await page.getByRole("button", { name: "Delete request" }).click();
  await page
    .getByRole("dialog", { name: "Delete this request?" })
    .getByRole("button", { name: "Delete request" })
    .click();
  await expect(page).toHaveURL(/\/admin\/requests$/);
  expect(
    await adminQuery("select 1 from public.quote_requests where reference = $1", [reference]),
  ).toHaveLength(0);
});

test("requests are private to administrators", async () => {
  const anonymous = await api("/admin/api/rest", undefined, {
    method: "POST",
    body: JSON.stringify({ table: "quote_requests", action: "select", filters: [], order: [] }),
  });
  expect(anonymous.status).toBe(401);
  const events = await api("/admin/api/rpc/contact_event_summary", undefined, {
    method: "POST",
    body: JSON.stringify({ p_days: 30 }),
  });
  expect(events.status).toBe(401);
});

test("the real public form, with no mocks, reaches the admin inbox", async ({ page, browser }) => {
  const s = uid();
  const name = `Public Visitor ${s}`;

  // A visitor on the public site (separate browser context: no admin session).
  const visitor = await browser.newContext({ baseURL: BASE_URL });
  const site = await visitor.newPage();
  await site.goto("/preventivo");
  const main = site.getByRole("main");
  await expect(main.locator('[data-composer="url"]')).toBeVisible();
  await main.locator('[name="nome"]').fill(name);
  await main.locator('[name="telefono"]').fill("333 765 4321");
  await main.locator('[name="ritiro_via"]').fill("Via Emilia 5");
  await main.locator('[name="ritiro_cap"]').fill("41012");
  await main.locator('[name="ritiro_citta"]').fill("Carpi");
  await main.locator('[name="ritiro_provincia"]').fill("MO");
  await main.locator('[name="consegna_via"]').fill("Corso Francia 9");
  await main.locator('[name="consegna_cap"]').fill("10138");
  await main.locator('[name="consegna_citta"]').fill("Torino");
  await main.locator('[name="consegna_provincia"]').fill("TO");
  // A person takes more than a second and a half to fill a form.
  await site.waitForTimeout(1600);
  await main.getByRole("button", { name: "Invia la richiesta a BSR" }).click();
  const confirmation = site.getByTestId("quote-sent");
  await expect(confirmation).toContainText(/RQ-\d{4}-\d{5}/);
  const reference = (await confirmation.innerText()).match(/RQ-\d{4}-\d{5}/)![0];
  await visitor.close();

  // The same request, as the dispatch team sees it.
  await login(page, USERS.admin, "/admin/requests");
  const row = page.getByRole("row", { name: new RegExp(reference) });
  await expect(row).toContainText(name);
  await expect(row).toContainText("Carpi → Torino");
  await row.getByRole("link", { name: reference }).click();
  await expect(page.getByText("+39 333 765 4321")).toBeVisible();
  await expect(page.getByText("Corso Francia 9, 10138 Torino (TO)")).toBeVisible();
});

test("the dashboard shows new requests live, without reloading", async ({ page }) => {
  const s = uid();
  const name = `Live Visitor ${s}`;
  // The live stream is for signed-in administrators only.
  expect((await api("/admin/api/events")).status).toBe(401);

  await login(page, USERS.admin, "/admin");
  await expect(page.getByText("Live", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: /New quote requests/ })).toBeVisible();

  // A visitor sends a request while the dashboard is open.
  const created = await post("/api/quote-requests", {
    name,
    phone: "+39 333 1234567",
    pickup: { street: "Via Roma 10", zip: "41012", city: "Carpi", province: "MO" },
    delivery: { street: "Corso Francia 9", zip: "10138", city: "Torino", province: "TO" },
    elapsed: 6000,
  });
  expect(created.status).toBe(201);
  const { reference } = (await created.json()) as { reference: string };

  // It appears by itself, with a notice and in the sidebar count.
  await expect(page.getByRole("row", { name: new RegExp(reference) })).toContainText(name);
  await expect(page.getByText("New quote request received.")).toBeVisible();
  await expect(page.getByRole("link", { name: /Requests.*new request/ })).toBeVisible();

  // Handling it elsewhere updates this screen too: discarding removes it from "new".
  await adminQuery("update public.quote_requests set status = 'discarded' where reference = $1", [
    reference,
  ]);
  await expect(page.getByRole("row", { name: new RegExp(reference) })).toHaveCount(0);
  await adminQuery("delete from public.quote_requests where reference = $1", [reference]);
});
