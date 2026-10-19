import { expect, test } from "@playwright/test";

import { adminQuery, BASE_URL, login, uid, visitorIp } from "./support";
import { USERS } from "./users";

/** A visitor writes, the panel answers, the visitor reads the answer and writes back. */

const post = (path: string, body: unknown) =>
  fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-forwarded-for": visitorIp() },
    body: JSON.stringify(body),
  });

test("a message is answered from the panel and followed up on the tracking page", async ({
  page,
}) => {
  const s = uid();
  const created = await post("/api/messages", {
    name: `Visitatore ${s}`,
    email: `visitor-${s.toLowerCase()}@example.it`,
    subject: `Orari ${s}`,
    message: `Fate ritiri il sabato? ${s}`,
    elapsed: 6000,
  });
  expect(created.status).toBe(201);
  const { reference } = (await created.json()) as { reference: string };
  expect(reference).toMatch(/^MS-\d{4}-\d{5}-[A-Z2-9]{6}$/);

  // Nothing is stored for an instant script, and a wrong code is a plain "not found".
  const bot = await post("/api/messages", { name: "Bot", message: "x", phone: "333", elapsed: 5 });
  expect(bot.status).toBe(200);
  expect((await post("/api/tracking", { code: "MS-2026-99999-AAAAAA" })).status).toBe(404);

  // The panel: the inbox, then the reply.
  await login(page, USERS.admin, "/admin/messages");
  const row = page.getByRole("row", { name: new RegExp(reference) });
  await expect(row).toContainText(`Visitatore ${s}`);
  await row.getByRole("link").first().click();
  await expect(page.getByText(`Fate ritiri il sabato? ${s}`)).toBeVisible();
  await page.getByLabel("Reply").fill(`Sì, il sabato mattina ${s}`);
  await page.getByRole("button", { name: "Send reply" }).click();
  await expect(page.getByText(`Sì, il sabato mattina ${s}`)).toBeVisible();

  // The visitor, in Italian, on the public site.
  await page.goto(`${BASE_URL}/tracciamento?codice=${reference}`);
  await expect(page.getByTestId("tracking-status")).toHaveText("Risposto");
  await expect(page.getByTestId("tracking-thread")).toContainText(`Sì, il sabato mattina ${s}`);
  await page.getByLabel("Scrivici ancora").fill(`Grazie ${s}`);
  await page.getByRole("button", { name: "Invia" }).click();
  await expect(page.getByTestId("tracking-thread")).toContainText(`Grazie ${s}`);

  // The follow-up puts the message back in front of the team.
  const [stored] = await adminQuery<{ status: string }>(
    "select status from public.messages where reference = $1",
    [reference],
  );
  expect(stored?.status).toBe("new");
});

test("a quote request can be tracked with its code", async ({ page }) => {
  const s = uid();
  const created = await post("/api/quote-requests", {
    name: `Cliente ${s}`,
    phone: "+39 333 1234567",
    pickup: { street: "Via Roma 10", zip: "41012", city: "Carpi", province: "MO" },
    delivery: { street: "5 Rue de la Gare", zip: "69001", city: "Lione", province: "Rhône" },
    context: {},
    elapsed: 6000,
  });
  const { reference } = (await created.json()) as { reference: string };

  await page.goto(`${BASE_URL}/tracciamento`);
  await page.getByLabel("Codice di tracciamento").fill(reference.toLowerCase());
  await page.getByRole("button", { name: "Controlla" }).click();
  await expect(page.getByTestId("tracking-status")).toHaveText("Ricevuta");
  await expect(page.getByTestId("tracking-result")).toContainText("Carpi");
  // No personal data comes back with a code.
  await expect(page.getByTestId("tracking-result")).not.toContainText("333 1234567");
});
