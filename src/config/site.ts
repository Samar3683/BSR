import { company, contact } from "./site-content";

/**
 * Site-level identity and routing. The business facts (company, contact)
 * live in ./site-content.ts — the single source — and are re-exported here
 * for the components that read them through `siteConfig`.
 */
export const siteConfig = {
  name: company.brand,
  /** Default title: what BSR is and where it works. */
  title: `${company.brand} — Trasporti espressi e dedicati in Italia e in Europa`,
  description: `${company.brand}, ${company.activity} con sede a Carpi (MO): trasporti espressi e dedicati in tutta Italia e sulle principali tratte europee, con un unico referente dalla partenza alla consegna.`,
  url: company.website,
  lang: "it",
  locale: "it_IT",
  /** Mirrors --color-carbon (guarded by src/styles/tokens.test.ts). */
  themeColor: "#090b0b",
  labels: {
    skipToContent: "Vai al contenuto principale",
  },
  /** Supplied business contact details (./site-content.ts). */
  contact,
  /** Business address and company identifiers (./site-content.ts). */
  company,
  routes: {
    quoteRequest: "/preventivo",
    privacy: "/privacy",
  },
} as const;
