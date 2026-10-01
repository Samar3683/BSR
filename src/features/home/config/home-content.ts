import { company, coverage, transit } from "@/config/site-content";

/**
 * Copy of the home page's connective pieces: the transition out of the hero
 * and the introduction that answers "who is BSR?" — what (an impresa di
 * autotrasporto merci), where (Carpi; Italy and the main European routes),
 * how (one contact from pickup to delivery). Every figure is VERIFIED in
 * docs/content-audit.md and read from config/site-content.ts.
 */
export const homeContent = {
  transition: {
    /** Echoes the hero's last line, "Dal ritiro alla destinazione." */
    origin: "Ritiro",
    destination: "Destinazione",
  },
  identity: {
    id: "bsr",
    eyebrow: company.brand,
    /** Two lines, deliberately: the promise, then its reach. */
    title: ["Un referente.", "Ogni spedizione."] as const,
    body: `${company.brand} è un'${company.activity} con sede a Carpi (MO). Organizziamo trasporti espressi e dedicati in tutta Italia e sulle principali tratte europee: un unico referente segue il ritiro, il viaggio e la consegna.`,
    base: `Base operativa a ${coverage.base}`,
    metricsLabel: "BSR in numeri",
    metricsNote: "Valori indicativi",
    whatsapp: "Scrivici su WhatsApp",
    metrics: [
      {
        value: transit.italyExpress.replace(" h", ""),
        unit: "h",
        label: "Espressi in Italia",
        detail: "Tempi indicativi per molti trasporti espressi.",
      },
      {
        value: transit.europeTypical.replace(" giorni", ""),
        unit: "giorni",
        label: "Tratte europee",
        detail: "In genere, secondo la destinazione.",
      },
      {
        value: String(coverage.europe.length),
        label: "Paesi europei",
        detail: "Sulle principali tratte, oltre all'Italia.",
      },
      {
        value: company.drivers,
        label: "Autisti",
        detail: "Distribuiti sul territorio.",
      },
    ],
  },
} as const;
