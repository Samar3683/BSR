import { siteConfig } from "@/config/site";
import { type SectorId, sectors } from "@/config/site-content";
import { siteMedia } from "@/config/site-media";
import type { SlotMedia } from "@/types/media";

/**
 * Who relies on BSR — the sectors of the approved brief (docs/content-audit.md:
 * a positioning, for recognition — no client names, no counts). Each line
 * pairs the sector with the kind of transport it typically needs, matched to
 * a verified service (dedicated, express, the vehicle chosen for the load).
 *
 * Pictures: one shared stage photograph until each sector has a real one
 * (`siteMedia.sectors[id]`). Each row opens the request with its sector noted
 * (`/preventivo?settore=…`).
 */
export type { SectorId };

export interface Sector {
  id: SectorId;
  code: string;
  title: string;
  body: string;
  href: string;
  media?: SlotMedia;
}

const sector = (id: SectorId, code: string, body: string): Sector => ({
  id,
  code,
  title: sectors[id],
  body,
  href: `${siteConfig.routes.quoteRequest}?settore=${id}`,
  media: siteMedia.sectors[id],
});

export const sectorsContent = {
  id: "settori",
  label: "Per chi lavoriamo",
  /** The act's title, one entry per line (inked in turn). */
  title: ["Ogni carico", "ha la sua storia."] as const,
  act: { act: "02", name: "Il carico", meta: "Quattro settori" },
  /** The stage's caption over the photograph, e.g. "Carico 02 / 04". */
  stageLabel: "Carico",
  intro:
    "Ogni settore ha tempi ed esigenze diversi. Scegli il tuo: la richiesta di preventivo si apre con il settore già indicato.",
  /** Each row's action (the sector's name is added for assistive technology). */
  linkLabel: "Richiedi un preventivo",
  linkFor: "per",
  stage: siteMedia.sectors.stage,
  items: [
    sector(
      "industria",
      "01",
      "Produzione e componentistica: carichi voluminosi e trasporti dedicati.",
    ),
    sector("retail", "02", "Negozi e punti vendita: rifornimenti programmati e urgenze."),
    sector("e-commerce", "03", "Magazzini e spedizioni: volumi che cambiano, consegne rapide."),
    sector(
      "aziende-commerciali",
      "04",
      "Merce da e verso clienti e fornitori, con il mezzo adatto al carico.",
    ),
  ],
} as const;
