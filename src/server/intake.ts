import { readConfig } from "./config";
import { databaseError, db } from "./db";
import { sendMail } from "./mail";

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
