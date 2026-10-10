import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";

/*
 * /preventivo — the request, composed on the page. It must stay an honest
 * destination: nothing is submitted by the site (no form posting anywhere,
 * no submit button, no "sent" state); the fields arrive filled from the home
 * page, stay editable, and every edit rewrites the message, the WhatsApp and
 * email links and the URL (so a reload keeps what was typed).
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

test("composes the request and submits nothing", async ({ page }) => {
  const response = await page.goto("/preventivo");
  expect(response?.status()).toBe(200);
  await expect(page).toHaveTitle(/Richiedi un preventivo/);
  const main = page.getByRole("main");
  await expect(main.locator('[data-composer="url"]')).toBeVisible();
  // No submission of any kind: no posting form, no submit button.
  await expect(
    main.locator("form[method='post' i], button[type='submit'], input[type='submit']"),
  ).toHaveCount(0);
  await expect(main.getByText(/La richiesta non parte da questa pagina/)).toBeVisible();

  await main.getByLabel("Partenza").fill("Modena");
  await main.getByLabel("Destinazione").fill("Madrid");
  await main.getByLabel("Servizio").selectOption("espresso");
  await expect(page.getByTestId("quote-preview")).toContainText("Destinazione: Madrid");
  expect(await whatsappText(page)).toBe(
    "Ciao, vorrei richiedere un preventivo per un trasporto.\n\nPartenza: Modena\nDestinazione: Madrid\nServizio: Trasporto espresso",
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
  await expect(page).toHaveURL(/partenza=Modena&destinazione=Madrid&servizio=espresso/);
  await page.reload();
  await expect(main.locator('[data-composer="url"]')).toBeVisible();
  await expect(main.getByLabel("Destinazione")).toHaveValue("Madrid");
});

test("drops invalid parameters and leaves missing ones empty", async ({ page }) => {
  await page.goto("/preventivo?servizio=volo&mezzo=__proto__&settore=&destinazione=Atene");
  const main = page.getByRole("main");
  await expect(main.locator('[data-composer="url"]')).toBeVisible();
  await expect(main.getByLabel("Destinazione")).toHaveValue("Atene");
  await expect(main.getByLabel("Servizio")).toHaveValue("");
  await expect(main.getByLabel("Mezzo")).toHaveValue("");
  await expect(main.getByLabel("Partenza")).toHaveValue("");
  expect(await whatsappText(page)).toBe(
    "Ciao, vorrei richiedere un preventivo per un trasporto.\n\nDestinazione: Atene",
  );
});

test("has no automatically detectable WCAG 2.2 A/AA violations", async ({ page }) => {
  await page.goto("/preventivo?partenza=Carpi&servizio=dedicato");
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(results.violations).toEqual([]);
});
