import { siteConfig } from "@/config/site";
import { sectors, services, vehicles } from "@/config/site-content";

import { DEFAULT_PREFIX, PHONE_PREFIXES } from "../config/quote-form-content";

/**
 * A quote request drafted from the URL, turned into a short, ready-to-send
 * message for BSR's real channels. The customer quotes with the form's fields
 * only: contacts (name, optional email, phone with prefix) and the two
 * addresses (street, ZIP, city, province — pick-up and delivery). A service,
 * sector or vehicle chosen on another part of the site (`?servizio=…`,
 * `?settore=…`, `?mezzo=…`) rides along as context, not as a field; the older
 * `?partenza=` and `?destinazione=` (a city) still prefill the two cities.
 *
 * Nothing is sent by the site: the visitor opens WhatsApp or email, reads the
 * message, and sends it — or edits it first. Unknown choices are dropped,
 * free text is trimmed and capped, a missing field is simply left out.
 */
export interface QuoteDraft {
  name?: string;
  email?: string;
  prefix?: string;
  phone?: string;
  pickupStreet?: string;
  pickupZip?: string;
  pickupCity?: string;
  pickupProvince?: string;
  deliveryStreet?: string;
  deliveryZip?: string;
  deliveryCity?: string;
  deliveryProvince?: string;
  /** Context from the page the visitor came from (not form fields). */
  service?: string;
  sector?: string;
  vehicle?: string;
}

/** The form's fields, in order. */
export const FORM_KEYS = [
  "name",
  "email",
  "prefix",
  "phone",
  "pickupStreet",
  "pickupZip",
  "pickupCity",
  "pickupProvince",
  "deliveryStreet",
  "deliveryZip",
  "deliveryCity",
  "deliveryProvince",
] as const satisfies ReadonlyArray<keyof QuoteDraft>;

export type FormKey = (typeof FORM_KEYS)[number];

/** URL parameter of each field. */
export const DRAFT_PARAMS = {
  name: "nome",
  email: "email",
  prefix: "prefisso",
  phone: "telefono",
  pickupStreet: "ritiro_via",
  pickupZip: "ritiro_cap",
  pickupCity: "ritiro_citta",
  pickupProvince: "ritiro_provincia",
  deliveryStreet: "consegna_via",
  deliveryZip: "consegna_cap",
  deliveryCity: "consegna_citta",
  deliveryProvince: "consegna_provincia",
  service: "servizio",
  sector: "settore",
  vehicle: "mezzo",
} as const satisfies Record<keyof QuoteDraft, string>;

/** The older parameters of the home page's first starter. */
const LEGACY = { origin: "partenza", destination: "destinazione" } as const;

const MAX = 80;

const text = (value: string | null, max = MAX) => {
  const clean = value?.replace(/\s+/g, " ").trim().slice(0, max);
  return clean || undefined;
};

const known = <T extends Record<string, string>>(names: T, value: string | null) =>
  value && Object.hasOwn(names, value) ? names[value as keyof T] : undefined;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const email = (value: string | null) => {
  const clean = text(value, 100);
  return clean && EMAIL.test(clean) ? clean : undefined;
};

/** Digits, spaces and the usual separators only; at least 6 digits to count. */
export const phone = (value: string | null) => {
  const clean = text(value?.replace(/[^\d\s().-]/g, "") ?? null, 20);
  return clean && clean.replace(/\D/g, "").length >= 6 ? clean : undefined;
};

const prefix = (value: string | null) =>
  PHONE_PREFIXES.find((option) => option.value === value)?.value;

export function draftFromParams(params: { get(name: string): string | null }): QuoteDraft {
  const get = (key: keyof QuoteDraft) => params.get(DRAFT_PARAMS[key]);
  return {
    name: text(get("name")),
    email: email(get("email")),
    prefix: prefix(get("prefix")),
    phone: phone(get("phone")),
    pickupStreet: text(get("pickupStreet")),
    pickupZip: text(get("pickupZip"), 12),
    pickupCity: text(get("pickupCity")) ?? text(params.get(LEGACY.origin)),
    pickupProvince: text(get("pickupProvince"), 40),
    deliveryStreet: text(get("deliveryStreet")),
    deliveryZip: text(get("deliveryZip"), 12),
    deliveryCity: text(get("deliveryCity")) ?? text(params.get(LEGACY.destination)),
    deliveryProvince: text(get("deliveryProvince"), 40),
    service: known(services, get("service")),
    sector: known(sectors, get("sector")),
    vehicle: known(vehicles, get("vehicle")),
  };
}

const address = (street?: string, zip?: string, city?: string, province?: string) => {
  const line = [street, [zip, city].filter(Boolean).join(" ")].filter(Boolean).join(", ");
  return [line, province && `(${province})`].filter(Boolean).join(" ") || undefined;
};

/** The draft's filled fields, in order, as [label, value] pairs. */
export function draftRows(draft: QuoteDraft): Array<[string, string]> {
  const rows: Array<[string, string | undefined]> = [
    ["Nome", draft.name],
    ["Telefono", draft.phone && `${draft.prefix ?? DEFAULT_PREFIX} ${draft.phone}`],
    ["Email", draft.email],
    [
      "Ritiro",
      address(draft.pickupStreet, draft.pickupZip, draft.pickupCity, draft.pickupProvince),
    ],
    [
      "Consegna",
      address(draft.deliveryStreet, draft.deliveryZip, draft.deliveryCity, draft.deliveryProvince),
    ],
    ["Servizio", draft.service],
    ["Settore", draft.sector],
    ["Mezzo", draft.vehicle],
  ];
  return rows.filter((row): row is [string, string] => Boolean(row[1]));
}

const GREETING = "Ciao, vorrei richiedere un preventivo per un trasporto.";

/** Short and natural: a greeting, then only the fields that were filled. */
export function draftMessage(draft: QuoteDraft): string {
  const lines = draftRows(draft).map(([label, value]) => `${label}: ${value}`);
  return lines.length ? `${GREETING}\n\n${lines.join("\n")}` : GREETING;
}

export function whatsappHref(draft: QuoteDraft): string {
  return `${siteConfig.contact.whatsappHref}?text=${encodeURIComponent(draftMessage(draft))}`;
}

export function emailHref(draft: QuoteDraft): string {
  const subject = encodeURIComponent("Richiesta di preventivo");
  const body = encodeURIComponent(draftMessage(draft));
  return `mailto:${siteConfig.contact.email}?subject=${subject}&body=${body}`;
}
