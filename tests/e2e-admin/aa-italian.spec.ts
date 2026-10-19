import { mkdirSync, writeFileSync } from "node:fs";

import { expect, test, type Page } from "@playwright/test";

import { IT } from "../../src/admin/i18n/dictionary";
import { adminQuery, BASE_URL, login, uid, userClient, visitorIp } from "./support";
import { USERS } from "./users";

/**
 * In Italian mode no interface word may stay in English. The scan reads every
 * visible text and label on each page and flags words that only English uses.
 */

const PAGES = [
  "/admin",
  "/admin/requests",
  "/admin/messages",
  "/admin/orders",
  "/admin/orders/new",
  "/admin/dispatch",
  "/admin/calendar?view=month",
  "/admin/calendar?view=week&group=driver",
  "/admin/calendar?view=agenda",
  "/admin/vehicles",
  "/admin/vehicles/new",
  "/admin/drivers",
  "/admin/drivers/new",
  "/admin/customers",
  "/admin/customers/new",
  "/admin/reports",
  "/admin/audit",
  "/admin/profile",
  "/admin/settings/fields",
  "/admin/settings/entities",
  "/admin/settings/administrators",
  "/admin/settings/dispatch-rules",
];

// Words English uses and Italian does not; interface text should never contain them.
const EXTRA_ENGLISH =
  "the and with your you this that from for are is was not to an or be can will has have when which each every any only must should new add edit save saved cancel delete search filter status name date time customer driver vehicle order orders select loading error reply message phone sign settings required optional please try again yes all more less show hide today week month day days ago open close back next previous total empty result results details detail type create update remove view download upload failed success unsaved changes choose section field fields entity primary option options tick ticked qualify value values list pickup delivery street number records record assignment assignments handling breakdown invite recent distribution visible personal data audit log erased held hold";
// Words that only English uses: those of the English dictionary keys that no Italian text uses.
const wordsOf = (text: string) => text.toLowerCase().match(/[a-zà-ú']{3,}/g) ?? [];
const italianWords = new Set(Object.values(IT).flatMap(wordsOf));
const englishOnly = [...new Set([...Object.keys(IT).flatMap(wordsOf), ...EXTRA_ENGLISH.split(" ")])]
  .filter(
    (w) =>
      !italianWords.has(w) && !/^(email|note|notes|no|report|dispatch|admin|timeline|set|ago|per|are|come|con|via|data|mar|mer|gio|ven|sab|dom|lun)$/.test(w),
  )
  .map((w) => w.replace(/[^a-z']/g, ""))
  .filter(Boolean);
const ENGLISH = String.raw`(?<![\wà-ú'])(` + englishOnly.join("|") + String.raw`)(?![\wà-ú'])`;

// Names that are the same in both languages.
const ALLOWED =
  /@|^system:|^(BSR|BSR Trasporti|IT|EN|PDF|CSV|SMS|ID|VAT|IBAN|km|kg|ADR|CMR|DDT|OK)$/i;

async function leftovers(page: Page): Promise<string[]> {
  return page.evaluate(
    ({ english }) => {
      const pattern = new RegExp(english, "i");
      const found = new Set<string>();
      const visible = (el: Element | null) => {
        for (let node = el; node; node = node.parentElement) {
          const style = getComputedStyle(node);
          if (style.display === "none" || style.visibility === "hidden") return false;
          if (node.hasAttribute("data-record-text")) return false;
        }
        return true;
      };
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        const parent = n.parentElement;
        const text = (n.nodeValue ?? "").trim();
        if (!parent || !text || ["SCRIPT", "STYLE", "TEXTAREA"].includes(parent.tagName)) continue;
        if (!visible(parent) || parent.closest("[data-no-translate]")) continue;
        if (pattern.test(text)) found.add(text);
      }
      for (const el of document.body.querySelectorAll("[placeholder],[title],[aria-label],[alt]")) {
        for (const name of ["placeholder", "title", "aria-label", "alt"]) {
          const value = el.getAttribute(name);
          if (value && pattern.test(value)) found.add(`${name}: ${value}`);
        }
      }
      return [...found];
    },
    { english: ENGLISH },
  );
}

async function settle(page: Page) {
  await expect(page.locator(".a-loading, [aria-busy='true']")).toHaveCount(0, { timeout: 20_000 });
}

test("the whole panel is in Italian", async ({ page, context }) => {
  test.setTimeout(420_000);
  const s = uid();
  // Real content so the tables, threads, badges and detail pages are on screen.
  const send = (path: string, body: unknown) =>
    fetch(`${BASE_URL}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-forwarded-for": visitorIp() },
      body: JSON.stringify(body),
    });
  await send("/api/messages", {
    name: `Visitatore ${s}`,
    email: `v-${s.toLowerCase()}@example.it`,
    message: "Buongiorno, vorrei informazioni sui vostri servizi.",
    elapsed: 6000,
  });
  await send("/api/quote-requests", {
    name: `Cliente ${s}`,
    phone: "+39 333 1234567",
    pickup: { street: "Via Roma 10", zip: "41012", city: "Carpi", province: "MO" },
    delivery: { street: "5 Rue de la Gare", zip: "69001", city: "Lione", province: "Rhône" },
    context: {},
    elapsed: 6000,
  });
  const { client } = await userClient(USERS.admin);
  const customer = await client
    .from("customers")
    .insert({ attributes: { company_name: `Cliente Prova ${s}` } })
    .select("id")
    .single();
  const order = await client
    .from("orders")
    .insert({
      customer_id: customer.data!.id,
      pickup_at: new Date(Date.now() + 26 * 3_600_000).toISOString(),
      delivery_at: new Date(Date.now() + 30 * 3_600_000).toISOString(),
      attributes: {
        pickup_address: { line1: "Via Larga 1", city: "Milano" },
        delivery_address: { line1: "Via Stretta 2", city: "Genova" },
      },
    })
    .select("id")
    .single();
  const [request] = await adminQuery<{ id: string }>(
    "select id from public.quote_requests order by created_at desc limit 1",
  );
  const [message] = await adminQuery<{ id: string }>(
    "select id from public.messages order by created_at desc limit 1",
  );

  await login(page, USERS.admin, "/admin");
  await context.addCookies([{ name: "bsr-admin-lang", value: "it", url: `${BASE_URL}/admin` }]);

  mkdirSync("test-results", { recursive: true });
  const report: Record<string, string[]> = {};
  const scan = async (label: string) => {
    const found = (await leftovers(page)).filter((text) => !ALLOWED.test(text));
    if (found.length) report[label] = found;
  };
  const visit = async (path: string) => {
    await page.goto(`${BASE_URL}${path}`);
    await settle(page);
    await page.waitForTimeout(800);
    await scan(path);
    if (process.env.ITALIAN_DUMP) {
      const text = await page.locator("body").innerText();
      writeFileSync(`test-results/italian-${path.replace(/\W+/g, "_")}.txt`, text);
    }
  };

  for (const path of [
    ...PAGES,
    `/admin/orders/${order.data!.id}`,
    `/admin/orders/${order.data!.id}/edit`,
    `/admin/customers/${customer.data!.id}`,
    `/admin/requests/${request!.id}`,
    `/admin/messages/${message!.id}`,
  ]) {
    await visit(path);
  }

  // Validation messages: submit empty forms.
  for (const path of ["/admin/orders/new", "/admin/vehicles/new", "/admin/customers/new"]) {
    await page.goto(`${BASE_URL}${path}`);
    await settle(page);
    await page.locator("form button[type=submit]").first().click();
    await page.waitForTimeout(500);
    await scan(`${path} (validation)`);
  }

  // Dialogs: new field, bulk selection on the orders list, the account menu.
  await page.goto(`${BASE_URL}/admin/settings/fields`);
  await settle(page);
  await page
    .locator("button:has(svg)")
    .filter({ hasText: /Nuovo campo/ })
    .first()
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await scan("new field dialog");
  await page.keyboard.press("Escape");

  await page.goto(`${BASE_URL}/admin/orders`);
  await settle(page);
  await page.locator("tbody input[type=checkbox]").first().check();
  await scan("orders bulk selection");

  await page.goto(`${BASE_URL}/admin/audit`);
  await settle(page);
  await page.getByRole("button", { name: "Mostra dettagli" }).first().click();
  await scan("audit details");

  // The signed-out pages.
  await page.context().clearCookies();
  await context.addCookies([{ name: "bsr-admin-lang", value: "it", url: `${BASE_URL}/admin` }]);
  for (const path of ["/admin/login", "/admin/forgot-password"]) {
    await page.goto(`${BASE_URL}${path}`);
    await scan(path);
  }
  await page
    .getByRole("button")
    .first()
    .click()
    .catch(() => undefined);
  await scan("signed-out submit");

  mkdirSync("test-results", { recursive: true });
  writeFileSync("test-results/italian-report.json", JSON.stringify(report, null, 2));
  expect(report, JSON.stringify(report, null, 2)).toEqual({});
});
