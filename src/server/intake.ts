import { readConfig } from "./config";
import { databaseError, db } from "./db";
import { receiptMail, sendMail } from "./mail";

/**
 * The public site's way into the database: a quote request, and anonymous
 * counts of contact clicks. Both go through SECURITY DEFINER functions in the
 * `intake` schema, which validate everything again; the web server's database
 * role can do nothing else with visitor data.
 */

export class IntakeError extends Error {
  constructor(
    message: string,
    readonly status = 422,
  ) {
    super(message);
  }
}

interface Address {
  street?: unknown;
  zip?: unknown;
  city?: unknown;
  province?: unknown;
}

export interface QuotePayload {
  name?: unknown;
  email?: unknown;
  phone?: unknown;
  pickup?: Address;
  delivery?: Address;
  context?: { service?: unknown; sector?: unknown; vehicle?: unknown };
}

const text = (value: unknown, max: number) =>
  typeof value === "string" ? value.slice(0, max) : undefined;

/** Only the known fields, with capped lengths, reach the database. */
export function normalizeQuote(input: unknown): QuotePayload {
  const raw = (input && typeof input === "object" ? input : {}) as QuotePayload;
  const address = (a: Address | undefined) => ({
    street: text(a?.street, 200),
    zip: text(a?.zip, 40),
    city: text(a?.city, 200),
    province: text(a?.province, 80),
  });
  return {
    name: text(raw.name, 300),
    email: text(raw.email, 300),
    phone: text(raw.phone, 100),
    pickup: address(raw.pickup),
    delivery: address(raw.delivery),
    context: {
      service: text(raw.context?.service, 200),
      sector: text(raw.context?.sector, 200),
      vehicle: text(raw.context?.vehicle, 200),
    },
  };
}

export async function submitQuoteRequest(input: unknown, adminBaseUrl: string): Promise<string> {
  const payload = normalizeQuote(input);
  let reference: string;
  try {
    const rows = await db().$queryRaw<{ reference: string }[]>`
      select intake.submit_quote_request(${JSON.stringify(payload)}::jsonb) as reference`;
    reference = rows[0]!.reference;
  } catch (error) {
    const e = databaseError(error);
    if (e?.hint === "business_rule") throw new IntakeError(e.message);
    throw error;
  }
  void notifyTeam(reference, payload, adminBaseUrl).catch(() => undefined);
  void confirmToVisitor("quote", reference, payload.email, adminBaseUrl).catch(() => undefined);
  return reference;
}

const escapeHtml = (value: string) =>
  value.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]!);

/** Tells the configured addresses about a new request. Best effort: never blocks the visitor. */
async function notifyTeam(reference: string, payload: QuotePayload, baseUrl: string) {
  const config = readConfig();
  if (!config?.smtpUrl || !config.notifyEmail.length) return;
  const place = (a: Address | undefined) =>
    [a?.street, [a?.zip, a?.city].filter(Boolean).join(" "), a?.province && `(${a.province})`]
      .filter(Boolean)
      .join(", ");
  const lines = [
    `Nuova richiesta di preventivo ${reference}`,
    "",
    `Nome: ${payload.name}`,
    `Telefono: ${payload.phone}`,
    payload.email ? `Email: ${payload.email}` : null,
    `Ritiro: ${place(payload.pickup)}`,
    `Consegna: ${place(payload.delivery)}`,
    "",
    `Apri nel pannello: ${baseUrl.replace(/\/+$/, "")}/admin/requests`,
  ].filter((l): l is string => l !== null);
  const body = lines.join("\n");
  await sendMail({
    to: config.notifyEmail.join(", "),
    subject: `Nuova richiesta di preventivo ${reference}`,
    text: body,
    html: `<pre style="font:14px/1.5 sans-serif;white-space:pre-wrap">${escapeHtml(body)}</pre>`,
  });
}

export async function recordContactEvent(channel: unknown, page: unknown): Promise<void> {
  if (typeof channel !== "string" || typeof page !== "string") return;
  await db().$executeRaw`select intake.record_contact_event(${channel}, ${page.slice(0, 200)})`;
}

/** Tells the visitor their code by email (when they left an address and mail is configured). */
async function confirmToVisitor(
  kind: "quote" | "message",
  code: string,
  email: unknown,
  baseUrl: string,
) {
  if (typeof email !== "string" || !email || !readConfig()?.smtpUrl) return;
  await sendMail(receiptMail(email, kind, code, baseUrl));
}

export interface MessagePayload {
  name?: unknown;
  email?: unknown;
  phone?: unknown;
  subject?: unknown;
  message?: unknown;
}

export async function submitContactMessage(input: unknown, baseUrl: string): Promise<string> {
  const raw = (input && typeof input === "object" ? input : {}) as MessagePayload;
  const payload = {
    name: text(raw.name, 300),
    email: text(raw.email, 300),
    phone: text(raw.phone, 100),
    subject: text(raw.subject, 300),
    message: text(raw.message, 5000),
  };
  let reference: string;
  try {
    const rows = await db().$queryRaw<{ reference: string }[]>`
      select intake.submit_message(${JSON.stringify(payload)}::jsonb) as reference`;
    reference = rows[0]!.reference;
  } catch (error) {
    const e = databaseError(error);
    if (e?.hint === "business_rule") throw new IntakeError(e.message);
    throw error;
  }
  void notifyMessage(reference, payload, baseUrl).catch(() => undefined);
  void confirmToVisitor("message", reference, payload.email, baseUrl).catch(() => undefined);
  return reference;
}

async function notifyMessage(reference: string, payload: MessagePayload, baseUrl: string) {
  const config = readConfig();
  if (!config?.smtpUrl || !config.notifyEmail.length) return;
  const body = [
    `Nuovo messaggio dal sito ${reference}`,
    "",
    `Nome: ${payload.name}`,
    payload.email ? `Email: ${payload.email}` : null,
    payload.phone ? `Telefono: ${payload.phone}` : null,
    payload.subject ? `Oggetto: ${payload.subject}` : null,
    "",
    String(payload.message ?? ""),
    "",
    `Rispondi dal pannello: ${baseUrl.replace(/\/+$/, "")}/admin/messages`,
  ]
    .filter((l): l is string => l !== null)
    .join("\n");
  await sendMail({
    to: config.notifyEmail.join(", "),
    subject: `Nuovo messaggio dal sito ${reference}`,
    text: body,
    html: `<pre style="font:14px/1.5 sans-serif;white-space:pre-wrap">${escapeHtml(body)}</pre>`,
  });
}

/** What a visitor may see for a tracking code, or null when the code is unknown. */
export async function trackCode(code: unknown): Promise<unknown> {
  if (typeof code !== "string" || code.length > 60) return null;
  const rows = await db().$queryRaw<{ result: unknown }[]>`
    select intake.track(${code}) as result`;
  return rows[0]?.result ?? null;
}

export async function addVisitorMessage(code: unknown, message: unknown): Promise<boolean> {
  if (typeof code !== "string" || code.length > 60 || typeof message !== "string") return false;
  try {
    const rows = await db().$queryRaw<{ ok: boolean }[]>`
      select intake.add_visitor_message(${code}, ${message.slice(0, 2000)}) as ok`;
    return Boolean(rows[0]?.ok);
  } catch (error) {
    const e = databaseError(error);
    if (e?.hint === "business_rule") throw new IntakeError(e.message);
    throw error;
  }
}
