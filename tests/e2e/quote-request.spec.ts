import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";

/*
 * /preventivo — the request, composed on the page. The fields arrive filled
 * from the home page, stay editable, and every edit rewrites the message, the
 * WhatsApp and email links and the URL (so a reload keeps what was typed). The
 * request can be sent to BSR from here: it is checked first, posted to the
 * site's own endpoint (mocked in this suite, which runs without a database),
 * and only then does the page say it was received. No form posts anywhere and
 * nothing is sent until the visitor presses the button.
 */

const whatsappText = async (page: Page) =>
  decodeURIComponent(
    (
      (await page.getByRole("link", { name: /Scrivici su WhatsApp/ }).getAttribute("href")) ?? ""
    ).split("?text=")[1] ?? "",
  );

test("the hero quote CTA reaches the quote-request page (no 404)", async ({ page }) => {
  const failures: string[] = [];
  page.on("response", (response) => {
    if (response.status() >= 400) failures.push(`${response.status()} ${response.url()}`);
  });
  await page.goto("/");
  // The headline block's action (the video's ending cue repeats it, hidden until then).
  await page
    .locator("[data-hero-copy]")
    .getByRole("link", { name: /Richiedi un preventivo/ })
    .click();
  await page.waitForURL("**/preventivo");
  await expect(
    page.getByRole("heading", { level: 1, name: "Richiedi un preventivo" }),
  ).toBeVisible();
  expect(failures.filter((failure) => failure.includes("/preventivo"))).toEqual([]);
});

test("composes the request and sends nothing until asked", async ({ page }) => {
  const response = await page.goto("/preventivo");
  expect(response?.status()).toBe(200);
  await expect(page).toHaveTitle(/Richiedi un preventivo/);
  const main = page.getByRole("main");
  await expect(main.locator('[data-composer="url"]')).toBeVisible();
  // No form posts and no implicit submit: the visitor sends the request on purpose.
  await expect(
    main.locator("form[method='post' i], button[type='submit'], input[type='submit']"),
  ).toHaveCount(0);
  await expect(main.getByRole("button", { name: "Invia la richiesta a BSR" })).toBeVisible();
  await expect(main.getByText(/Preferisci un altro canale/)).toBeVisible();

  // The form asks for the contacts and the two addresses only.
  await expect(main.locator("input, select")).toHaveCount(12);
  await main.locator('[name="nome"]').fill("Mario Rossi");
  await main.locator('[name="telefono"]').fill("333 123 4567");
  await main.locator('[name="ritiro_citta"]').fill("Modena");
  await main.locator('[name="consegna_citta"]').fill("Madrid");
  await main.locator('[name="consegna_provincia"]').fill("Madrid");
  await expect(page.getByTestId("quote-preview")).toContainText("Consegna: Madrid (Madrid)");
  expect(await whatsappText(page)).toBe(
    "Ciao, vorrei richiedere un preventivo per un trasporto.\n\nNome: Mario Rossi\nTelefono: +39 333 123 4567\nRitiro: Modena\nConsegna: Madrid (Madrid)",
  );
  await expect(main.getByRole("link", { name: /Scrivi un'email/ })).toHaveAttribute(
    "href",
    /^mailto:Bsrtrasporti@gmail\.com\?subject=Richiesta%20di%20preventivo&body=/,
  );
  await expect(main.getByRole("link", { name: /Chiama/ })).toHaveAttribute(
    "href",
    "tel:+393279427723",
  );

  // What was typed survives a reload.
  await expect(page).toHaveURL(/nome=Mario\+Rossi/);
  await page.reload();
  await expect(main.locator('[data-composer="url"]')).toBeVisible();
  await expect(main.locator('[name="consegna_citta"]')).toHaveValue("Madrid");
});

test("drops invalid parameters and leaves missing ones empty", async ({ page }) => {
  await page.goto("/preventivo?servizio=volo&mezzo=__proto__&settore=&destinazione=Atene");
  const main = page.getByRole("main");
  await expect(main.locator('[data-composer="url"]')).toBeVisible();
  await expect(main.locator('[name="consegna_citta"]')).toHaveValue("Atene");
  await expect(main.locator('[name="ritiro_citta"]')).toHaveValue("");
  await expect(main.locator('[name="nome"]')).toHaveValue("");
  expect(await whatsappText(page)).toBe(
    "Ciao, vorrei richiedere un preventivo per un trasporto.\n\nConsegna: Atene",
  );
});

test("has no automatically detectable WCAG 2.2 A/AA violations", async ({ page }) => {
  await page.goto("/preventivo?partenza=Carpi&servizio=dedicato");
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(results.violations).toEqual([]);
});

const fillRequest = async (page: Page) => {
  const main = page.getByRole("main");
  // Typing before hydration would be overwritten: wait for the composer to be live.
  await expect(main.locator('[data-composer="url"]')).toBeVisible();
  await main.locator('[name="nome"]').fill("Mario Rossi");
  await main.locator('[name="telefono"]').fill("333 123 4567");
  await main.locator('[name="ritiro_via"]').fill("Via Roma 10");
  await main.locator('[name="ritiro_cap"]').fill("41012");
  await main.locator('[name="ritiro_citta"]').fill("Carpi");
  await main.locator('[name="ritiro_provincia"]').fill("MO");
  await main.locator('[name="consegna_via"]').fill("5 Rue de la Gare");
  await main.locator('[name="consegna_cap"]').fill("69001");
  await main.locator('[name="consegna_citta"]').fill("Lione");
  await main.locator('[name="consegna_provincia"]').fill("Rhône");
};

test("names the missing fields and sends nothing", async ({ page }) => {
  let posted = 0;
  await page.route("**/api/quote-requests", (route) => {
    posted += 1;
    return route.fulfill({ status: 201, json: { reference: "RQ-2026-00001" } });
  });
  await page.goto("/preventivo");
  const main = page.getByRole("main");
  await main.getByRole("button", { name: "Invia la richiesta a BSR" }).click();
  await expect(main.getByRole("alert").first()).toBeVisible();
  await expect(main.locator('[name="nome"]')).toBeFocused();
  expect(posted).toBe(0);
});

test("sends the request to BSR and confirms it with a reference", async ({ page }) => {
  const bodies: unknown[] = [];
  await page.route("**/api/quote-requests", (route) => {
    bodies.push(route.request().postDataJSON());
    return route.fulfill({ status: 201, json: { reference: "RQ-2026-00042" } });
  });
  await page.goto("/preventivo?servizio=dedicato");
  await fillRequest(page);
  const main = page.getByRole("main");
  await main.getByRole("button", { name: "Invia la richiesta a BSR" }).click();
  await expect(page.getByTestId("quote-sent")).toContainText("RQ-2026-00042");
  await expect(page.getByTestId("quote-sent")).toContainText(/Ti ricontattiamo/);
  expect(bodies).toHaveLength(1);
  expect(bodies[0]).toMatchObject({
    name: "Mario Rossi",
    phone: "+39 333 123 4567",
    pickup: { city: "Carpi", province: "MO" },
    delivery: { city: "Lione", province: "Rhône" },
  });
  // WhatsApp and email stay available as direct channels.
  await expect(main.getByRole("link", { name: /Scrivici su WhatsApp/ })).toBeVisible();
});

test("shows the server's message and lets the visitor retry", async ({ page }) => {
  await page.route("**/api/quote-requests", (route) =>
    route.fulfill({ status: 503, json: { error: { message: "Il servizio non è disponibile." } } }),
  );
  await page.goto("/preventivo");
  await fillRequest(page);
  const main = page.getByRole("main");
  await main.getByRole("button", { name: "Invia la richiesta a BSR" }).click();
  await expect(main.getByRole("alert")).toContainText("Il servizio non è disponibile.");
  await expect(main.getByRole("button", { name: "Invia la richiesta a BSR" })).toBeEnabled();
});

test("counts clicks on contact links without delaying them", async ({ page }) => {
  const events: unknown[] = [];
  await page.route("**/api/contact-events", (route) => {
    events.push(route.request().postData());
    return route.fulfill({ status: 204 });
  });
  await page.goto("/preventivo");
  await page
    .getByRole("main")
    .getByRole("link", { name: /Chiama/ })
    .click({ noWaitAfter: true });
  await expect.poll(() => events.length).toBeGreaterThan(0);
  expect(JSON.parse(events[0] as string)).toEqual({ channel: "phone", page: "/preventivo" });
});
