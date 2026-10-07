import { company, coverage, transit } from "@/config/site-content";

/**
 * Copy of the home page's connective pieces: the transition out of the hero
 * and the first chapter, which answers "what is BSR?" in about five seconds —
 * what (express and dedicated transport), where (Italy and the main European
 * routes, from Carpi), how (one contact from pickup to delivery). Every figure
 * is VERIFIED in docs/content-audit.md and read from config/site-content.ts:
 * timings are indicative, the countries are the seven confirmed routes, "un
 * unico referente" is the official site's own promise.
 */
export const homeContent = {
  transition: {
    /** Echoes the hero's last line, "Dal ritiro alla destinazione." */
    origin: "Ritiro",
    destination: "Destinazione",
  },
  identity: {
    id: "bsr",
    chapter: { index: "01", name: "Chi è BSR", context: "Carpi · Modena · Italia" },
    label: `${company.brand} · ${coverage.base}`,
    /** Two lines, deliberately: what BSR does, then where. */
    title: ["Trasporti espressi e dedicati.", "In Italia e sulle principali tratte europee."] as const,
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
  },
} as const;
