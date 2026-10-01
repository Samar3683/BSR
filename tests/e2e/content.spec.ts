import { expect, type Page, test } from "@playwright/test";

/*
 * Content, conversion and SEO regressions (docs/content-audit.md): every
 * action that passes data prefills the request; one consistent set of
 * contacts; the contact block is visible outside the footer; no placeholder
 * text, dead or unnamed links; no fabricated reviews or logos; no claim the
 * audit removed; the SEO basics.
 */

test.use({ contextOptions: { reducedMotion: "reduce" } });

const PAGES = ["/", "/preventivo", "/privacy"];

/** Follow a link from the home page to the quote page and read the prefilled request. */
async function requestFrom(page: Page, href: string) {
  await page.goto(href);
  const main = page.getByRole("main");
  // The prerendered form is empty; wait for the one filled from the URL.
  await expect(main.locator('[data-composer="url"]')).toBeVisible();
  const value = (label: string) => main.getByLabel(label, { exact: true }).inputValue();
  return {
    origin: await value("Partenza"),
    destination: await value("Destinazione"),
    service: await value("Servizio"),
    vehicle: await value("Mezzo"),
    sector: await value("Settore"),
  };
}

test.describe("prefill: every action that passes data", () => {
  test("services, fleet, sectors and coverage open the request already filled", async ({
    page,
  }) => {
    await page.goto("/");
    const hrefOf = (selector: string) => page.locator(selector).first().getAttribute("href");
    const cases: Array<[string, Partial<Awaited<ReturnType<typeof requestFrom>>>]> = [
      [(await hrefOf("#espresso a[href*='servizio=']"))!, { service: "espresso" }],
      [(await hrefOf("#dedicato a[href*='servizio=']"))!, { service: "dedicato" }],
      [(await hrefOf("#flotta a[href*='mezzo=furgone']"))!, { vehicle: "furgone" }],
      [(await hrefOf("#flotta a[href*='mezzo=da-valutare']"))!, { vehicle: "da-valutare" }],
      [(await hrefOf("#settori a[href*='settore=industria']"))!, { sector: "industria" }],
      [(await hrefOf("#copertura a[href*='destinazione=Turchia']"))!, { destination: "Turchia" }],
    ];
    for (const [href, expected] of cases) {
      expect(href).toMatch(/^\/preventivo\?/);
      expect(await requestFrom(page, href)).toMatchObject(expected);
    }
  });

  test("the starter form carries route, service and sector", async ({ page }) => {
    await page.goto("/");
    const form = page.locator("#richiesta form");
    await form.getByLabel(/Partenza/).fill("Carpi (MO)");
    await form.getByLabel(/Destinazione/).fill("Lione, Francia");
    await form.getByLabel(/Servizio/).selectOption("dedicato");
    await form.getByLabel(/Settore/).selectOption("e-commerce");
    await form.getByRole("button", { name: "Continua" }).click();
    await page.waitForURL("**/preventivo?**");
    expect(await requestFrom(page, page.url())).toEqual({
      origin: "Carpi (MO)",
      destination: "Lione, Francia",
      service: "dedicato",
      vehicle: "",
      sector: "e-commerce",
    });
  });
});

test.describe("contacts", () => {
  test("the contact block is on the page, not only in the footer", async ({ page }) => {
    await page.goto("/");
    const block = page.locator("main #contatti");
    await expect(block).toHaveCount(1);
    await expect(block).toContainText("Titolare");
    await expect(block).toContainText("Ashraf Barjees Tahir");
    await expect(block.locator('a[href="tel:+393279427723"]')).toHaveCount(1);
    await expect(block.locator('a[href="https://wa.me/393279427723"]')).toHaveCount(1);
    await expect(block.locator('a[href="mailto:Bsrtrasporti@gmail.com"]')).toHaveCount(1);
    await expect(block.locator('a[href="mailto:b.s.r@legalmail.it"]')).toHaveCount(1);
    await expect(page.locator("#chi-siamo")).toContainText("B.S.R. di Ashraf Barjees Tahir");
    await expect(page.locator("#chi-siamo")).toContainText("REA");
  });

  for (const path of PAGES) {
    test(`one phone, one email, one PEC, one WhatsApp number on ${path}`, async ({ page }) => {
      await page.goto(path);
      const hrefs = await page.evaluate(() =>
        [...document.querySelectorAll("a[href]")].map((a) => a.getAttribute("href")!),
      );
      const tel = new Set(hrefs.filter((h) => h.startsWith("tel:")));
      const mail = new Set(
        hrefs.filter((h) => h.startsWith("mailto:")).map((h) => h.slice(7).split("?")[0]),
      );
      const whatsapp = new Set(
        hrefs.filter((h) => h.includes("wa.me")).map((h) => h.split("?")[0]),
      );
      expect([...tel]).toEqual(["tel:+393279427723"]);
      for (const address of mail) {
        expect(["Bsrtrasporti@gmail.com", "b.s.r@legalmail.it"]).toContain(address);
      }
      expect([...whatsapp]).toEqual(["https://wa.me/393279427723"]);
      const text = await page.locator("body").innerText();
      for (const phone of text.match(/\+39[\d\s]{9,}/g) ?? []) {
        expect(phone.trim()).toBe("+39 327 942 7723");
      }
    });
  }
});

test.describe("no placeholders, no dead links, no invented proof", () => {
  for (const path of PAGES) {
    test(`clean copy and working links on ${path}`, async ({ page }) => {
      await page.goto(path);
      const text = await page.locator("body").innerText();
      expect(text).not.toMatch(/\b(TODO|TBD|PLACEHOLDER|Lorem|INSERT|ADD CLIENT)\b|undefined|\bnull\b/i);
      // Claims removed by the content audit.
      expect(text).not.toMatch(/30 minuti|garantit|in tempo reale|leader|Türkiye/i);

      const problems = await page.evaluate(() =>
        [...document.querySelectorAll<HTMLElement>("a, button")]
          .filter((el) => el.getClientRects().length > 0 || el.tagName === "A")
          .flatMap((el) => {
            const name = (el.getAttribute("aria-label") ?? el.textContent ?? "").trim();
            const href = el.getAttribute("href");
            const issues: string[] = [];
            if (!name) issues.push(`unnamed ${el.tagName} ${href ?? ""}`);
            if (el.tagName === "A" && (!href || href === "#" || href.startsWith("javascript:"))) {
              issues.push(`dead link "${name}"`);
            }
            return issues;
          }),
      );
      expect(problems).toEqual([]);
    });
  }

  test("every in-page link reaches a section of the home page", async ({ page }) => {
    await page.goto("/");
    const anchors = await page.evaluate(() => [
      ...new Set(
        [...document.querySelectorAll("a[href^='/#'], a[href^='#']")].map((a) =>
          a.getAttribute("href")!.replace(/^\//, ""),
        ),
      ),
    ]);
    expect(anchors.length).toBeGreaterThan(5);
    for (const anchor of anchors) await expect(page.locator(anchor)).toHaveCount(1);
  });

  test("no testimonial and no client logo is published without approval", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("#recensioni blockquote")).toHaveCount(0);
    await expect(page.locator("#clienti img")).toHaveCount(0);
    await expect(page.getByText(/Transcoop|Transmec|One Express|LogiCo|Expedia/)).toHaveCount(0);
  });
});

test.describe("SEO", () => {
  test("home: title, description, canonical, language, Open Graph, structured data", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(
      "BSR Trasporti — Trasporti espressi e dedicati in Italia e in Europa",
    );
    await expect(page.locator("html")).toHaveAttribute("lang", "it");
    const meta = (selector: string) => page.locator(selector).getAttribute("content");
    expect(await meta('meta[name="description"]')).toMatch(/impresa di autotrasporto merci/);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      "href",
      "https://bsrtrasporti.com",
    );
    expect(await meta('meta[property="og:title"]')).toMatch(/^BSR Trasporti/);
    expect(await meta('meta[property="og:description"]')).toBeTruthy();
    expect(await meta('meta[property="og:image"]')).toMatch(/^https:\/\/bsrtrasporti\.com\/opengraph-image/);
    expect(await meta('meta[property="og:locale"]')).toBe("it_IT");
    expect(await meta('meta[name="twitter:card"]')).toBe("summary_large_image");

    const jsonLd = JSON.parse(
      (await page.locator('script[type="application/ld+json"]').textContent())!,
    );
    expect(jsonLd).toMatchObject({
      "@type": "LocalBusiness",
      name: "BSR Trasporti",
      legalName: "B.S.R. di Ashraf Barjees Tahir",
      telephone: "+393279427723",
    });
    expect(jsonLd).not.toHaveProperty("aggregateRating");
    expect(jsonLd).not.toHaveProperty("openingHours");
  });

  test("each page has one h1, its own title and canonical", async ({ page }) => {
    for (const [path, title] of [
      ["/preventivo", "Richiedi un preventivo — BSR Trasporti"],
      ["/privacy", "Privacy e cookie — BSR Trasporti"],
    ]) {
      await page.goto(path!);
      await expect(page).toHaveTitle(title!);
      await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
        "href",
        `https://bsrtrasporti.com${path}`,
      );
    }
  });

  test("robots.txt and sitemap.xml list the public pages only", async ({ request }) => {
    const robots = await (await request.get("/robots.txt")).text();
    expect(robots).toContain("Disallow: /dev/");
    expect(robots).toContain("Sitemap: https://bsrtrasporti.com/sitemap.xml");
    const sitemap = await (await request.get("/sitemap.xml")).text();
    for (const url of ["https://bsrtrasporti.com", "/preventivo", "/privacy"]) {
      expect(sitemap).toContain(url);
    }
    expect(sitemap).not.toContain("/dev/");
  });
});
