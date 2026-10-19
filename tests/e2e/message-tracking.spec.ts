import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

/*
 * /contatti and /tracciamento — the visitor writes to BSR and follows the
 * request with its code. The endpoints are mocked here (this suite runs
 * without a database); the real round trip through the panel is covered by
 * the admin suite (tests/e2e-admin/messages.spec.ts).
 */

const WCAG = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

test("the contact form checks the input and shows the tracking code", async ({ page }) => {
  let posted: Record<string, unknown> | null = null;
  await page.route("**/api/messages", async (route) => {
    posted = route.request().postDataJSON() as Record<string, unknown>;
    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({ reference: "MS-2026-00007-K7F3QX" }),
    });
  });

  await page.goto("/contatti");
  await expect(page).toHaveTitle(/Scrivici un messaggio/);
  const form = page.getByTestId("message-form");
  await expect(form).toBeVisible();
  const a11y = await new AxeBuilder({ page }).withTags(WCAG).analyze();
  expect(a11y.violations).toEqual([]);

  // Wrong input is explained in Italian and nothing is sent.
  await form.getByRole("button", { name: /Invia/ }).click();
  await expect(form.getByRole("alert").first()).toBeVisible();
  expect(posted).toBeNull();

  await form.getByLabel(/Nome/).fill("Anna Bianchi");
  await form.getByLabel(/Email/).fill("anna@example.it");
  await form.getByLabel(/Messaggio/).fill("Fate ritiri il sabato?");
  await page.waitForTimeout(1600);
  await form.getByRole("button", { name: /Invia/ }).click();
  const sent = page.getByTestId("message-sent");
  await expect(sent).toContainText("MS-2026-00007-K7F3QX");
  await expect(sent.getByRole("link")).toHaveAttribute(
    "href",
    "/tracciamento?codice=MS-2026-00007-K7F3QX",
  );
  expect(posted).toMatchObject({ name: "Anna Bianchi", email: "anna@example.it" });
});

test("the tracking page finds a code, shows the conversation and takes a follow-up", async ({
  page,
}) => {
  const thread = [{ direction: "out", body: "Sì, il sabato mattina.", at: "2026-10-12T09:00:00Z" }];
  let followUp: Record<string, unknown> | null = null;
  await page.route("**/api/tracking", async (route) => {
    const { code } = route.request().postDataJSON() as { code: string };
    if (code.toUpperCase() !== "MS-2026-00007-K7F3QX") {
      await route.fulfill({ status: 404, contentType: "application/json", body: "{}" });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        kind: "message",
        reference: "MS-2026-00007-K7F3QX",
        status: "answered",
        received_at: "2026-10-12T08:00:00Z",
        first_message: "Fate ritiri il sabato?",
        entries: thread,
        order: null,
      }),
    });
  });
  await page.route("**/api/tracking/reply", async (route) => {
    followUp = route.request().postDataJSON() as Record<string, unknown>;
    thread.push({ direction: "in", body: "Grazie!", at: "2026-10-12T10:00:00Z" });
    await route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
  });

  await page.goto("/tracciamento");
  await expect(page).toHaveTitle(/Traccia la tua richiesta/);
  // Search engines are told to stay away.
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);

  await page.getByLabel("Codice di tracciamento").fill("MS-2026-99999-AAAAAA");
  await page.getByRole("button", { name: "Controlla" }).click();
  await expect(page.locator("#tracking-error")).toContainText("Codice non trovato");

  await page.getByLabel("Codice di tracciamento").fill("ms-2026-00007-k7f3qx");
  await page.getByRole("button", { name: "Controlla" }).click();
  await expect(page.getByTestId("tracking-status")).toHaveText("Risposto");
  await expect(page.getByTestId("tracking-thread")).toContainText("Sì, il sabato mattina.");
  const a11y = await new AxeBuilder({ page }).withTags(WCAG).analyze();
  expect(a11y.violations).toEqual([]);

  await page.getByLabel("Scrivici ancora").fill("Grazie!");
  await page.getByRole("button", { name: "Invia" }).click();
  await expect(page.getByTestId("tracking-thread")).toContainText("Grazie!");
  expect(followUp).toMatchObject({ code: "ms-2026-00007-k7f3qx", message: "Grazie!" });
});

test("a code in the address is looked up at once", async ({ page }) => {
  await page.route("**/api/tracking", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        kind: "quote",
        reference: "RQ-2026-00042-ABC234",
        status: "converted",
        received_at: "2026-10-12T08:00:00Z",
        route: { from: "Carpi", to: "Lione" },
        entries: [],
        order: {
          order_number: "BSR-2026-00009",
          status: "in_transit",
          pickup_at: "2026-10-13T07:00:00Z",
          delivery_at: "2026-10-14T15:00:00Z",
          history: [{ status: "confirmed", at: "2026-10-12T12:00:00Z" }],
        },
      }),
    }),
  );
  await page.goto("/tracciamento?codice=RQ-2026-00042-ABC234");
  await expect(page.getByTestId("tracking-status")).toHaveText("Trasformata in trasporto");
  await expect(page.getByTestId("order-status")).toHaveText("In viaggio");
  await expect(page.getByTestId("tracking-result")).toContainText("Carpi → Lione");
});
