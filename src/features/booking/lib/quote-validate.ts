import { quoteFormContent as content } from "../config/quote-form-content";
import { FORM_KEYS, type FormKey, type QuoteDraft, email, phone } from "./quote-draft";

export type QuoteValues = Partial<Record<FormKey, string>>;
export type QuoteErrors = Partial<Record<FormKey, string>>;

/** What each field needs to pass, and the message when it does not. */
export function validateQuote(values: QuoteValues): QuoteErrors {
  const e = content.errors;
  const filled = (key: FormKey) => Boolean(values[key]?.trim());
  const errors: QuoteErrors = {};
  if (!filled("name")) errors.name = e.name;
  if (values.email?.trim() && !email(values.email)) errors.email = e.email;
  if (!phone(values.phone ?? null)) errors.phone = e.phone;
  for (const kind of ["pickup", "delivery"] as const) {
    if (!filled(`${kind}Street`)) errors[`${kind}Street`] = e.street;
    if (!filled(`${kind}Zip`)) errors[`${kind}Zip`] = e.zip;
    if (!filled(`${kind}City`)) errors[`${kind}City`] = e.city;
    if (!filled(`${kind}Province`)) errors[`${kind}Province`] = e.province;
  }
  return errors;
}

/** The first field with an error, in form order (it takes focus). */
export function firstError(errors: QuoteErrors): FormKey | undefined {
  return FORM_KEYS.find((key) => errors[key]);
}

/** The request as the server receives it: the cleaned draft, phone with its prefix. */
export function quotePayload(draft: QuoteDraft, elapsedMs: number) {
  return {
    name: draft.name,
    email: draft.email,
    phone: draft.phone ? `${draft.prefix ?? "+39"} ${draft.phone}` : undefined,
    pickup: {
      street: draft.pickupStreet,
      zip: draft.pickupZip,
      city: draft.pickupCity,
      province: draft.pickupProvince,
    },
    delivery: {
      street: draft.deliveryStreet,
      zip: draft.deliveryZip,
      city: draft.deliveryCity,
      province: draft.deliveryProvince,
    },
    context: { service: draft.service, sector: draft.sector, vehicle: draft.vehicle },
    elapsed: elapsedMs,
  };
}

export type SendResult = { ok: true; reference: string } | { ok: false; message: string };

const FALLBACK = "La richiesta non è stata inviata. Riprova o scrivici su WhatsApp.";

/** Posts the request to the site's own endpoint. Never throws: the form shows the message. */
export async function sendQuoteRequest(
  payload: ReturnType<typeof quotePayload>,
): Promise<SendResult> {
  try {
    const response = await fetch("/api/quote-requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = (await response.json().catch(() => ({}))) as {
      reference?: string;
      error?: { message?: string };
    };
    if (response.ok && data.reference) return { ok: true, reference: data.reference };
    return { ok: false, message: data.error?.message ?? FALLBACK };
  } catch {
    return { ok: false, message: FALLBACK };
  }
}
