import { siteConfig } from "@/config/site";
import { coverage } from "@/config/site-content";
import { siteMedia } from "@/config/site-media";
import type { SlotMedia } from "@/types/media";

/**
 * Coverage, from the official site (docs/content-audit.md): all Italy, north
 * to south and islands; the seven confirmed European routes with their
 * indicative transit times; the operational base in Carpi. The supplied map
 * draws corridors to exactly these countries. Pickups are stated as
 * nationwide, so the map's Carpi origin never reads as "every shipment
 * starts in Carpi". Each country opens the request with it as destination.
 */
export const coverageContent = {
  /** Navigation anchor (site-navigation.ts). */
  id: "copertura",
  eyebrow: "Copertura",
  title: "In tutta Italia e su sette tratte europee.",
  body: "Ritiri e consegne su tutto il territorio nazionale, da nord a sud e nelle isole. Verso l'Europa, trasporti dedicati pianificati porta a porta.",
  italy: {
    headline: coverage.italy,
    detail: "Espressi, dedicati e ritiri anche in giornata, quando tratta e disponibilità lo consentono.",
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
  action: { label: "Richiedi un preventivo per la tua tratta", href: "/#richiesta" },
  media: siteMedia.coverage.background as SlotMedia | undefined,
} as const;
