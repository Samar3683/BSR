import { siteConfig } from "@/config/site";
import { sectors, services, vehicles } from "@/config/site-content";

/**
 * A quote request drafted from the URL (`/preventivo?partenza=…&destinazione=…
 * &servizio=…&settore=…&mezzo=…&merce=…&quando=…`, as the home page's form
 * and actions write it), turned into a short, ready-to-send message for BSR's
 * real channels. Nothing is sent by the site: the visitor opens WhatsApp or
 * email, reads the message, and sends it — or edits it first.
 *
 * Only known services, sectors and vehicles are named (the spellings of
 * config/site-content.ts); an unknown value is dropped, never shown. Free text
 * is trimmed and capped. A missing field is simply left out.
 */
export interface QuoteDraft {
  origin?: string;
  destination?: string;
  service?: string;
  sector?: string;
  vehicle?: string;
  goods?: string;
  when?: string;
}

/** URL parameter of each field. */
export const DRAFT_PARAMS = {
  origin: "partenza",
  destination: "destinazione",
  service: "servizio",
  sector: "settore",
  vehicle: "mezzo",
  goods: "merce",
  when: "quando",
} as const satisfies Record<keyof QuoteDraft, string>;

export const DRAFT_LABELS = {
  origin: "Partenza",
  destination: "Destinazione",
  service: "Servizio",
  sector: "Settore",
  vehicle: "Mezzo",
  goods: "Merce",
  when: "Quando",
} as const satisfies Record<keyof QuoteDraft, string>;

const MAX = 80;

const text = (value: string | null) => {
  const clean = value?.replace(/\s+/g, " ").trim().slice(0, MAX);
  return clean || undefined;
};

const known = <T extends Record<string, string>>(names: T, value: string | null) =>
  value && Object.hasOwn(names, value) ? names[value as keyof T] : undefined;

export function draftFromParams(params: { get(name: string): string | null }): QuoteDraft {
  return {
    origin: text(params.get(DRAFT_PARAMS.origin)),
    destination: text(params.get(DRAFT_PARAMS.destination)),
    service: known(services, params.get(DRAFT_PARAMS.service)),
    sector: known(sectors, params.get(DRAFT_PARAMS.sector)),
    vehicle: known(vehicles, params.get(DRAFT_PARAMS.vehicle)),
    goods: text(params.get(DRAFT_PARAMS.goods)),
    when: text(params.get(DRAFT_PARAMS.when)),
  };
}

/** The draft's filled fields, in order, as [label, value] pairs. */
export function draftRows(draft: QuoteDraft): Array<[string, string]> {
  return (Object.keys(DRAFT_LABELS) as Array<keyof QuoteDraft>)
    .filter((key) => draft[key])
    .map((key) => [DRAFT_LABELS[key], draft[key]!]);
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
  const body = encodeURIComponent(`${draftMessage(draft)}\n\nNome e cognome:\nTelefono:\n`);
  return `mailto:${siteConfig.contact.email}?subject=${subject}&body=${body}`;
}
