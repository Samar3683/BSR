import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { expect, type Page } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { stackEnv } from "./stack";
import type { TestUser } from "./users";

export const stack = stackEnv();

const noSession = { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false };

/** Service-role client: test setup and verification only (never in the app). */
export function serviceClient(): SupabaseClient {
  return createClient(stack.url, stack.serviceKey, { auth: noSession });
}

export function anonClient(): SupabaseClient {
  return createClient(stack.url, stack.anonKey, { auth: noSession });
}

/** A client signed in as a test user: goes through RLS exactly like the panel. */
export async function userClient(
  user: TestUser,
): Promise<{ client: SupabaseClient; token: string; userId: string }> {
  const client = createClient(stack.url, stack.anonKey, { auth: noSession });
  const { data, error } = await client.auth.signInWithPassword({
    email: user.email,
    password: user.password,
  });
  if (error || !data.session) throw error ?? new Error("No session");
  return { client, token: data.session.access_token, userId: data.user.id };
}

export async function login(page: Page, user: TestUser, path = "/admin") {
  const target =
    path === "/admin" ? "/admin/login" : `/admin/login?next=${encodeURIComponent(path)}`;
  await page.goto(target);
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password").fill(user.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL((url) => url.pathname === path.split("?")[0]);
  await expect(page.locator(".a-topbar")).toBeVisible();
}

/** A short unique suffix so reruns without a reset do not collide. */
export function uid(): string {
  return Date.now().toString(36).slice(-5).toUpperCase();
}

interface Mail {
  receivedAt: string;
  envelopeTo: string[];
  subject: string;
  html: string | null;
  links: string[];
}

/** Waits for an email captured by the local stack's SMTP sink. */
export async function waitForMail(to: string, since: number, timeoutMs = 20_000): Promise<Mail> {
  const dir = resolve(".supabase-local/mail");
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const files = readdirSync(dir)
      .filter((f) => f.endsWith(".json"))
      .sort()
      .reverse();
    for (const file of files) {
      const mail = JSON.parse(readFileSync(resolve(dir, file), "utf8")) as Mail;
      if (Date.parse(mail.receivedAt) >= since - 1000 && mail.envelopeTo.includes(to)) return mail;
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error(`No email to ${to}`);
}

/** The panel link in an email, re-pointed at the server under test. */
export function panelLink(mail: Mail, baseURL: string): string {
  const link = mail.links.find((l) => l.includes("/admin/auth/confirm")) ?? "";
  expect(link, "confirm link in email").toContain("token_hash=");
  const url = new URL(link.replace(/&amp;/g, "&"));
  return `${baseURL}${url.pathname}${url.search}`;
}

/** No accidental horizontal scrolling of the page or the main column. */
export async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => {
    const doc = document.documentElement;
    const main =
      document.querySelector<HTMLElement>(".a-main") ??
      document.querySelector<HTMLElement>(".a-auth");
    return {
      page: doc.scrollWidth - doc.clientWidth,
      main: main ? main.scrollWidth - main.clientWidth : 0,
    };
  });
  expect(overflow.page, "page scrolls horizontally").toBeLessThanOrEqual(1);
  expect(overflow.main, "main column scrolls horizontally").toBeLessThanOrEqual(1);
}

/** Picks a record in a relation combobox by typing part of its name. */
export async function pickRelation(page: Page, label: string | RegExp, text: string) {
  const input = page.getByRole("combobox", { name: label });
  await input.click();
  await input.fill(text);
  await page
    .getByRole("option", { name: new RegExp(text, "i") })
    .first()
    .click();
}

/** Fills a date + time pair rendered for a datetime field. */
export async function fillDateTime(page: Page, label: string, date: string, time: string) {
  await page.getByLabel(`${label} date`).fill(date);
  await page.getByLabel(`${label} time`).fill(time);
}

/** YYYY-MM-DD in Europe/Rome, n days from today. */
export function romeDate(days = 0): string {
  const date = new Date(Date.now() + days * 86_400_000);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Rome",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}
