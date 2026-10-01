/**
 * BSR's business facts — the single source for every page. Each fact here is
 * VERIFIED in docs/content-audit.md (source: the official site
 * bsrtrasporti.com and the client brief); nothing is inferred. Sections,
 * the quote draft, the FAQ, the footer and the structured data read from
 * here, so a correction is made once.
 *
 * Not here on purpose (see the audit): founding year, fleet size, vehicle
 * counts, warehouses, certifications, tracking systems, response-time
 * promises, client names, testimonials.
 */

/** The WhatsApp number: digits only, with the country code. */
const WHATSAPP_NUMBER = "393279427723";

export const company = {
  /** The brand as used on the site and in titles. */
  brand: "BSR Trasporti",
  short: "BSR",
  /** As registered (footer, privacy, structured data). */
  legalName: "B.S.R. di Ashraf Barjees Tahir",
  /** What BSR is, in one phrase (official site, "Chi siamo"). */
  activity: "impresa di autotrasporto merci",
  owner: { name: "Ashraf Barjees Tahir", role: "Titolare" },
  address: {
    /** Short form, for contact lists. */
    street: "Viale G. Carducci 18/C",
    /** Full form, for legal texts and structured data. */
    streetFull: "Viale Giosuè Carducci 18/C",
    postalCode: "41012",
    locality: "Carpi",
    province: "MO",
    provinceName: "Modena",
    country: "Italia",
    countryCode: "IT",
  },
  vatNumber: "03989650365",
  rea: "MO-434008",
  website: "https://bsrtrasporti.com",
  /** Stated on the official site (home, coverage, "Chi siamo"). */
  drivers: "40+",
} as const;

export const contact = {
  phoneDisplay: "+39 327 942 7723",
  phoneHref: "tel:+393279427723",
  phoneE164: "+393279427723",
  /** WhatsApp on the same number. */
  whatsappHref: `https://wa.me/${WHATSAPP_NUMBER}`,
  email: "Bsrtrasporti@gmail.com",
  /** As published on the official site (confirm: the brief gave bsr@legalmail.it). */
  pec: "b.s.r@legalmail.it",
  /** The named person on the site is the titolare. */
  person: company.owner.name,
} as const;

/** Indicative transit times — never a guarantee (always shown as "indicativi"). */
export const transit = {
  italyExpress: "24–48 h",
  europeTypical: "2–5 giorni",
} as const;

export const coverage = {
  italy: "Tutta Italia, isole comprese",
  base: `${company.address.locality} (${company.address.province})`,
  /** The confirmed European routes, with indicative transit times (official site). */
  europe: [
    { country: "Francia", transit: "24–48 h" },
    { country: "Spagna", transit: "48–72 h" },
    { country: "Ungheria", transit: "48–72 h" },
    { country: "Portogallo", transit: "72–96 h" },
    { country: "Romania", transit: "72–96 h" },
    { country: "Grecia", transit: "72–96 h" },
    { country: "Turchia", transit: "5–7 giorni" },
  ],
} as const;

/** The countries, in reading order ("Francia, Spagna, … e Turchia"). */
export const europeList = (() => {
  const names = coverage.europe.map((route) => route.country);
  return `${names.slice(0, -1).join(", ")} e ${names.at(-1)}`;
})();

/** Service, vehicle and sector names: the one spelling used everywhere (and in the quote draft). */
export const services = {
  espresso: "Trasporto espresso",
  dedicato: "Trasporto dedicato",
  "da-valutare": "Da valutare insieme",
} as const;

export const vehicles = {
  furgone: "Furgone",
  motrice: "Motrice",
  articolato: "Trattore + semirimorchio",
  "da-valutare": "Da valutare insieme",
} as const;

export const sectors = {
  industria: "Industria",
  retail: "Retail",
  "e-commerce": "E-commerce",
  "aziende-commerciali": "Aziende commerciali",
} as const;

export type ServiceId = keyof typeof services;
export type VehicleId = keyof typeof vehicles;
export type SectorId = keyof typeof sectors;
