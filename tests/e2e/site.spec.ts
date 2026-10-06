import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";

/*
 * The site below the hero: page structure, the site header and mobile menu,
 * the request flow, and the rules below the hero — no WebGL or video outside
 * it, only the live livery's photographs (docs/hero-baseline.md). Reduced
 * motion keeps scrolling native (no smooth scroll) and shows the scroll
 * reveals in their final state.
 */

test.use({ contextOptions: { reducedMotion: "reduce" } });

const SECTIONS = [
  "bsr",
  "servizi",
  "settori",
  "come-funziona",
  "flotta",
  "copertura",
  "sicurezza",
  "clienti",
  "recensioni",
  "chi-siamo",
  "richiesta",
  "faq",
  "preventivo",
];

const header = (page: Page) => page.locator("header[data-state]");
const scrollTo = (page: Page, y: number) => page.evaluate((v) => window.scrollTo(0, v), y);

test.describe("page structure", () => {
  test("landmarks, one h1, and one labelled h2 per section", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("banner")).toHaveCount(1);
    await expect(page.getByRole("main")).toHaveCount(1);
    await expect(page.getByRole("contentinfo")).toHaveCount(1);
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    for (const id of SECTIONS) {
      const section = page.locator(`section#${id}`);
      await expect(section.locator("h2")).toHaveCount(1);
      await expect(section).toHaveAttribute(
        "aria-labelledby",
        (await section.locator("h2").getAttribute("id"))!,
      );
    }
  });

  test("headings never skip a level", async ({ page }) => {
    await page.goto("/");
    const levels = await page
      .locator("h1, h2, h3, h4, h5, h6")
      .evaluateAll((headings) => headings.map((h) => Number(h.tagName[1])));
    expect(levels[0]).toBe(1);
    levels.slice(1).forEach((level, i) => expect(level - levels[i]!).toBeLessThanOrEqual(1));
  });

  test("no canvas or video outside the hero", async ({ page }) => {
    await page.goto("/");
    const outside = await page.evaluate(() =>
      [...document.querySelectorAll("canvas, video")]
        .filter((el) => !el.closest("[data-hero]"))
        .map((el) => el.outerHTML.slice(0, 80)),
    );
    expect(outside).toEqual([]);
  });

  // The supplied image package: only the live livery and the coverage map reach
  // public pages (never an alternative livery or an archived draft), every image
  // has an alt (meaningful, or "" when decorative) and loads lazily.
  // The one documented exception: the FAQ's background is the red-livery set.
  test("images outside the hero: live livery only (FAQ: red), alt text, lazy loading", async ({
    page,
  }) => {
    await page.goto("/");
    const images = await page.evaluate(() =>
      [...document.querySelectorAll("img")]
        .filter((img) => !img.closest("[data-hero]"))
        .map((img) => ({
          src: decodeURIComponent(img.getAttribute("src") ?? ""),
          inFaq: Boolean(img.closest("#faq")),
          alt: img.getAttribute("alt"),
          loading: img.getAttribute("loading"),
        })),
    );
    expect(images.length).toBeGreaterThanOrEqual(10);
    for (const image of images) {
      expect(image.src).toContain("/assets/images/content/");
      expect(image.src).toMatch(
        image.inFaq ? /\/scenes\/red\// : /\/(scenes\/final|maps)\//,
      );
      expect(image.alt, image.src).not.toBeNull();
      expect(image.loading, image.src).toBe("lazy");
    }
  });

  test("the quote chapter and the footer offer the real channels", async ({ page }) => {
    await page.goto("/");
    const quote = page.locator("#preventivo");
    await expect(quote.getByRole("link", { name: /Richiedi un preventivo/ })).toHaveAttribute(
      "href",
      "/preventivo",
    );
    await expect(quote.getByRole("link", { name: /WhatsApp/ })).toHaveAttribute(
      "href",
      "https://wa.me/393279427723",
    );
    const contacts = page.locator("footer #contatti-footer");
    await expect(contacts.locator('a[href="tel:+393279427723"]')).toHaveCount(1);
    await expect(contacts.locator('a[href="mailto:Bsrtrasporti@gmail.com"]')).toHaveCount(1);
    await expect(contacts.locator('a[href="mailto:b.s.r@legalmail.it"]')).toHaveCount(1);
    await expect(page.getByRole("contentinfo")).toContainText("B.S.R. di Ashraf Barjees Tahir");
    await expect(page.getByRole("contentinfo")).toContainText("P. IVA 03989650365");
    await expect(page.getByRole("contentinfo")).toContainText("REA MO-434008");
  });

  test("FAQ: the first answer starts open; the keyboard opens one at a time", async ({ page }) => {
    await page.goto("/");
    const items = page.locator("#faq details");
    await expect(items).toHaveCount(7);
    await expect(items.nth(0)).toHaveJSProperty("open", true);
    await expect(items.nth(1)).toHaveJSProperty("open", false);

    // Enter on the second question opens it and closes the first.
    const second = items.nth(1).locator("summary");
    await second.focus();
    await expect(second).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(items.nth(1)).toHaveJSProperty("open", true);
    await expect(items.nth(1).locator("p")).toBeVisible();
    await expect(items.nth(0)).toHaveJSProperty("open", false);

    // Space closes it again.
    await page.keyboard.press(" ");
    await expect(items.nth(1)).toHaveJSProperty("open", false);
  });

  test("vehicle selector: tabs switch the type from the keyboard", async ({ page }) => {
    await page.goto("/");
    const tabs = page.getByRole("tablist", { name: "Tipo di mezzo" }).getByRole("tab");
    await expect(tabs).toHaveCount(3);
    await expect(tabs.first()).toHaveAttribute("aria-selected", "true");
    await tabs.first().focus();
    await page.keyboard.press("ArrowRight");
    await expect(tabs.nth(1)).toBeFocused();
    await expect(tabs.nth(1)).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("tabpanel", { name: "Motrice" })).toBeVisible();
    await page.keyboard.press("End");
    await expect(tabs.nth(2)).toHaveAttribute("aria-selected", "true");
    await expect(
      page.getByRole("heading", { level: 3, name: "Trattore + semirimorchio" }),
    ).toBeVisible();
    // Only the verified van figures exist; the other types show none.
    await expect(page.getByRole("tabpanel", { name: "Articolato" })).not.toContainText("kg");
  });

  test("the journey marks the current step as the chapter is scrolled", async ({ page }) => {
    await page.goto("/");
    const steps = page.locator("#come-funziona ol > li");
    await expect(steps).toHaveCount(4);
    // The current step is the one whose centre is nearest the middle of the
    // viewport: put the first step there, then the last.
    const centre = (index: number) =>
      page.locator("#come-funziona ol > li").nth(index).evaluate(
        (li) => li.getBoundingClientRect().top + window.scrollY + li.getBoundingClientRect().height / 2 - window.innerHeight / 2,
      );
    await scrollTo(page, await centre(0));
    await expect(page.locator('#come-funziona li[aria-current="step"]')).toHaveCount(1);
    await expect(steps.nth(0)).toHaveAttribute("aria-current", "step");
    await scrollTo(page, await centre(3));
    await expect(steps.nth(3)).toHaveAttribute("aria-current", "step");
    await expect(steps.nth(0)).not.toHaveAttribute("aria-current", "step");
  });

  test("quick actions appear after the hero and step aside at the quote chapter", async ({
    page,
  }) => {
    await page.goto("/");
    const actions = page.locator("[data-quick-actions]");
    await expect(actions).not.toHaveAttribute("data-visible");
    await page.locator("#servizi").scrollIntoViewIfNeeded();
    await expect(actions).toHaveAttribute("data-visible", "true");
    await page.locator("#preventivo").scrollIntoViewIfNeeded();
    await expect(actions).not.toHaveAttribute("data-visible");
  });

  test("the request form carries the route into the quote page's channels", async ({ page }) => {
    await page.goto("/");
    const form = page.locator("#richiesta form");
    // Progressive disclosure: the route appears once a service is chosen.
    await expect(form.getByLabel(/Partenza/)).toBeHidden();
    await form.getByLabel("Trasporto dedicato", { exact: false }).check({ force: true });
    await form.getByLabel(/Partenza/).fill("Carpi");
    await form.getByLabel(/Destinazione/).fill("Lione");
    await form.getByRole("button", { name: "Continua" }).click();
    await page.waitForURL((url) => {
      const q = url.searchParams;
      return (
        url.pathname === "/preventivo" &&
        q.get("partenza") === "Carpi" &&
        q.get("destinazione") === "Lione" &&
        q.get("servizio") === "dedicato"
      );
    });
    await expect(page.locator('[data-composer="url"]')).toBeVisible();
    await expect(page.getByLabel("Partenza")).toHaveValue("Carpi");
    await expect(page.getByLabel("Servizio")).toHaveValue("dedicato");
    const whatsapp = page.getByRole("link", { name: /Scrivici su WhatsApp/ });
    const href = decodeURIComponent((await whatsapp.getAttribute("href"))!);
    expect(href).toContain("Partenza: Carpi\nDestinazione: Lione\nServizio: Trasporto dedicato");
  });

  test("no photograph repeats below the hero", async ({ page }) => {
    await page.goto("/");
    const sources = await page.evaluate(() =>
      [...document.querySelectorAll("img")]
        .filter((img) => !img.closest("[data-hero]"))
        .map((img) => decodeURIComponent(img.getAttribute("src") ?? ""))
        .filter((src) => src.includes("/scenes/")),
    );
    // The fleet selector renders its three pictures once; nothing else repeats.
    expect(sources.length).toBeGreaterThan(0);
    expect(sources.filter((src, i) => sources.indexOf(src) !== i)).toEqual([]);
  });

  test("a sector row opens the request with its sector noted", async ({ page, isMobile }) => {
    await page.goto("/");
    const sectors = page.locator("#settori");
    if (isMobile) {
      await sectors.locator("summary", { hasText: "Retail" }).click();
      await sectors.getByRole("link", { name: /Richiedi un preventivo per Retail/ }).click();
    } else {
      await sectors.getByRole("link", { name: /Retail/ }).click();
    }
    await page.waitForURL(/\/preventivo\?settore=retail/);
    await expect(page.locator('[data-composer="url"]')).toBeVisible();
    await expect(page.getByLabel("Settore")).toHaveValue("retail");
    const href = decodeURIComponent(
      (await page.getByRole("link", { name: /Scrivici su WhatsApp/ }).getAttribute("href"))!,
    );
    expect(href).toContain("Settore: Retail");
  });

  test("the privacy notice exists, is linked from the footer, and the site sets no cookies", async ({
    page,
    context,
  }) => {
    await page.goto("/");
    await page.getByRole("contentinfo").getByRole("link", { name: "Privacy e cookie" }).click();
    await page.waitForURL("**/privacy");
    await expect(page.getByRole("heading", { level: 1, name: "Privacy e cookie" })).toBeVisible();
    await expect(page.getByRole("main")).toContainText("P. IVA 03989650365");
    expect(await context.cookies()).toEqual([]);
  });

  test("has no automatically detectable WCAG 2.2 A/AA violations below the hero", async ({
    page,
  }) => {
    await page.goto("/");
    const results = await new AxeBuilder({ page })
      .exclude("[data-hero]")
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
      .analyze();
    expect(results.violations).toEqual([]);
  });

  test("the sections and a solid header work without JavaScript", async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await page.goto("/");
    for (const id of SECTIONS) await expect(page.locator(`#${id} h2`)).toBeAttached();
    await page.locator("#servizi h2").scrollIntoViewIfNeeded();
    await expect(page.locator("#servizi h2")).toBeVisible();
    await expect(header(page)).not.toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
    // Without JavaScript the vehicle selector is the three types, stacked and readable.
    await expect(page.locator("#flotta h3")).toHaveCount(3);
    await context.close();
  });
});

test.describe("site header", () => {
  test.skip(({ isMobile }) => isMobile, "Scroll and keyboard states are verified on desktop.");

  test("every navigation anchor has its section", async ({ page }) => {
    await page.goto("/");
    const nav = page.getByRole("navigation", { name: "Navigazione principale" });
    const hrefs = await nav
      .getByRole("link")
      .evaluateAll((links) => links.map((a) => a.getAttribute("href")));
    expect(hrefs.length).toBeGreaterThan(0);
    // Chapter links ("/#id") each reach one section; "Home" is the page itself.
    const anchors = hrefs.filter((href) => href!.startsWith("/#"));
    expect(anchors.length).toBe(hrefs.length - 1);
    for (const href of anchors) await expect(page.locator(href!.replace("/", ""))).toHaveCount(1);
    await nav.getByRole("link", { name: "Copertura" }).click();
    await expect(page.locator("#copertura h2")).toBeInViewport();
  });

  test("transparent at the top, hidden scrolling down, solid scrolling up", async ({ page }) => {
    await page.goto("/");
    await expect(header(page)).toHaveAttribute("data-state", "top");
    await expect(header(page)).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");

    const servicesTop = await page
      .locator("#servizi")
      .evaluate((el) => el.getBoundingClientRect().top + window.scrollY);
    await scrollTo(page, servicesTop - 400);
    await scrollTo(page, servicesTop);
    await expect(header(page)).toHaveAttribute("data-state", "hidden");
    await expect
      .poll(() => header(page).evaluate((el) => el.getBoundingClientRect().bottom))
      .toBe(0);

    await scrollTo(page, servicesTop - 200);
    await expect(header(page)).toHaveAttribute("data-state", "shown");
    await expect(header(page)).not.toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  });

  test("keyboard focus brings the hidden header back", async ({ page }) => {
    await page.goto("/");
    const top = await page
      .locator("#copertura")
      .evaluate((el) => el.getBoundingClientRect().top + window.scrollY);
    await scrollTo(page, top - 400);
    await scrollTo(page, top);
    await expect(header(page)).toHaveAttribute("data-state", "hidden");
    await header(page).getByRole("link", { name: "BSR, pagina principale" }).focus();
    await expect.poll(() => header(page).evaluate((el) => el.getBoundingClientRect().top)).toBe(0);
    await expect(header(page)).not.toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  });
});

test.describe("site header, section in view", () => {
  test.skip(({ isMobile }) => isMobile, "The navigation shows on large screens.");

  test("marks the link of the section in view", async ({ page }) => {
    await page.goto("/");
    const nav = page.getByRole("navigation", { name: "Navigazione principale" });
    for (const [id, label] of [
      ["flotta", "Flotta"],
      ["copertura", "Copertura"],
      ["chi-siamo", "Chi siamo"],
    ]) {
      await page.locator(`#${id}`).evaluate((el) => el.scrollIntoView({ block: "start" }));
      await expect(nav.getByRole("link", { name: label })).toHaveAttribute(
        "aria-current",
        "location",
      );
    }
  });
});

test.describe("entry motion", () => {
  test.use({ contextOptions: { reducedMotion: "no-preference" } });

  test("reveals play on the way down and back up, and never leave content hidden", async ({
    page,
  }) => {
    await page.goto("/");
    const hiddenInView = () =>
      page.evaluate(() =>
        [...document.querySelectorAll("[data-reveal]")].filter((el) => {
          const box = el.getBoundingClientRect();
          return (
            box.height > 0 &&
            box.top < innerHeight * 0.8 &&
            box.bottom > innerHeight * 0.2 &&
            !el.hasAttribute("data-inview")
          );
        }).length,
      );
    const height = await page.evaluate(() => document.documentElement.scrollHeight);
    for (const share of [0.3, 0.9, 0.5, 0.2]) {
      await scrollTo(page, height * share);
      await expect.poll(hiddenInView).toBe(0);
    }
  });
});

test.describe("mobile menu", () => {
  test.skip(({ isMobile }) => !isMobile, "The menu replaces the navigation on small screens.");

  test("opens as a modal, closes on Escape and returns focus", async ({ page }) => {
    await page.goto("/");
    const button = page.getByRole("button", { name: "Apri il menu" });
    await button.click();
    const dialog = page.getByRole("dialog", { name: "Menu" });
    await expect(dialog).toBeVisible();
    await expect(button).toHaveAttribute("aria-expanded", "true");
    await expect(page.getByRole("button", { name: "Chiudi il menu" })).toBeFocused();
    expect(await page.evaluate(() => document.documentElement.style.overflow)).toBe("hidden");

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(button).toBeFocused();
    await expect(button).toHaveAttribute("aria-expanded", "false");
    expect(await page.evaluate(() => document.documentElement.style.overflow)).toBe("");
  });

  test("a menu link closes the menu and reaches its section", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Apri il menu" }).click();
    const dialog = page.getByRole("dialog", { name: "Menu" });
    await dialog.getByRole("link", { name: "Flotta" }).click();
    await expect(dialog).toBeHidden();
    await expect(page.locator("#flotta h2")).toBeInViewport();
  });
});
