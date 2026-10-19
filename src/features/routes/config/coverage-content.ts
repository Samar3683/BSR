import { siteConfig } from "@/config/site";
import { coverage, transit } from "@/config/site-content";
import { siteMedia } from "@/config/site-media";
import type { SlotMedia } from "@/types/media";

export const coverageContent = {
  /** Navigation anchor (site-navigation.ts). */
  id: "copertura",
  label: "Copertura",
  title: "Dall'Italia all'Europa.",
  /** The title as the act sets it, one entry per line (same words). */
  titleLines: ["Dall'Italia", "all'Europa."] as const,
  act: { act: "07", name: "La rete", meta: "Carpi → Italia → Europa" },

  stages: [
    { id: "base", label: "Base operativa", headline: coverage.base, detail: "44.78° N · 10.88° E" },
    {
      id: "nord",
      label: "Territorio nazionale",
      headline: "Da nord a sud",
      detail: "Ritiri e consegne su tutto il territorio nazionale, da nord a sud e nelle isole.",
    },
    {
      id: "italia",
      label: "Italia",
      headline: coverage.italy,
      detail:
        "Espressi, dedicati e ritiri anche in giornata, quando tratta e disponibilità lo consentono.",
    },
    {
      id: "europa",
      label: "Europa",
      headline: "Tratte europee",
      detail: "Verso l'Europa, trasporti dedicati pianificati porta a porta.",
    },
  ],
  /** The reach as technical data (indicative times, the confirmed countries). */
  facts: [
    {
      value: transit.italyExpress.replace(" h", ""),
      unit: "h",
      label: "Italia",
      detail: "Espressi, isole comprese",
    },
    {
      value: transit.europeTypical.replace(" giorni", ""),
      unit: "giorni",
      label: "Europa",
      detail: "Secondo la tratta",
    },
    {
      value: String(coverage.europe.length),
      unit: "",
      label: "Paesi europei",
      detail: "Tratte confermate",
    },
  ],
  body: "Ritiri e consegne su tutto il territorio nazionale, da nord a sud e nelle isole. Verso l'Europa, trasporti dedicati pianificati porta a porta.",
  italy: {
    headline: coverage.italy,
    detail:
      "Espressi, dedicati e ritiri anche in giornata, quando tratta e disponibilità lo consentono.",
  },
  europe: {
    headline: "Tratte europee",
    note: "Tempi indicativi, secondo la destinazione.",
    routes: coverage.europe.map((route) => ({
      ...route,
      href: `${siteConfig.routes.quoteRequest}?destinazione=${encodeURIComponent(route.country)}`,
    })),
    /** Each country's link, for assistive technology: "Richiedi un preventivo per la Francia". */
    linkHint: "Richiedi un preventivo per",
  },
  base: {
    label: "Base operativa",
    place: coverage.base,
  },
  action: { label: "Verifica la tua tratta", href: siteConfig.routes.quoteRequest },
  media: siteMedia.coverage.background as SlotMedia | undefined,
} as const;
