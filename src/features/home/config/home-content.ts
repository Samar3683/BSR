import { company, coverage, transit } from "@/config/site-content";

/**
 * Copy of ACT 01, the film's first frame after the hero (the dawn over Carpi,
 * then the first chapter), which answers "what is BSR?" in about five seconds —
 * what (express and dedicated transport), where (Italy and the main European
 * routes, from Carpi), how (one contact from pickup to delivery). Every figure
 * is VERIFIED in docs/content-audit.md and read from config/site-content.ts:
 * timings are indicative, the countries are the seven confirmed routes, "un
 * unico referente" is the official site's own promise.
 */
export const homeContent = {
  identity: {
    id: "bsr",
    label: `${company.brand} · ${coverage.base}`,
    /** Two lines, deliberately: what BSR does, then where. */
    title: [
      "Trasporti espressi e dedicati.",
      "In Italia e sulle principali tratte europee.",
    ] as const,
    /** The first line as the opening statement sets it (same words). */
    statement: ["Trasporti espressi", "e dedicati."] as const,
    act: { act: "01", name: "Chi è BSR", meta: "Carpi · Modena · Italia" },
    support: "Dal ritiro alla consegna, un unico referente segue la tua spedizione.",
    body: `${company.brand} è un'${company.activity} con sede a Carpi (MO).`,
    whatsapp: "WhatsApp",
    whatsappHint: "(apre WhatsApp)",
    metricsLabel: "BSR in sintesi",
    metricsNote: "Tempi indicativi, secondo la tratta.",
    metrics: [
      {
        value: transit.italyExpress.replace(" h", ""),
        unit: "h",
        label: "Italia",
        detail: "Trasporti espressi, isole comprese.",
      },
      {
        value: transit.europeTypical.replace(" giorni", ""),
        unit: "giorni",
        label: "Europa",
        detail: "In genere, secondo la destinazione.",
      },
      {
        value: String(coverage.europe.length),
        label: "Paesi europei",
        detail: "Le tratte confermate, oltre all'Italia.",
      },
      {
        value: "1",
        label: "Referente",
        detail: "La stessa persona, dal ritiro alla consegna.",
      },
    ],
    /** The route under the chapter: from the base to its reach (decorative). */
    route: ["Carpi (MO)", "Italia", "Europa"] as const,
    /** The opening frame out of the hero: the base, as coordinates (geography, decorative). */
    prologue: {
      origin: "Carpi (MO)",
      coordinates: "44.78° N · 10.88° E",
      stops: ["Italia", "Europa"] as const,
      line: "Il viaggio parte da qui.",
    },
  },
} as const;
