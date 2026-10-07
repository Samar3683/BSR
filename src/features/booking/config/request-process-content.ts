import { siteConfig } from "@/config/site";
import { siteMedia } from "@/config/site-media";
import type { SlotMedia } from "@/types/media";

/**
 * The request flow as a home-page chapter ("come funziona"): what happens
 * after a visitor contacts BSR, in four steps. Every step restates the
 * official site (docs/content-audit.md): vehicle, times and price confirmed
 * before the transport; the pickup slot agreed at confirmation; the contact
 * warns when the vehicle is arriving and updates by WhatsApp or phone. No
 * response-time promise.
 */
export interface ProcessStep {
  title: string;
  body: string;
}

export const requestProcessContent = {
  /** Navigation anchor (site-navigation.ts). */
  id: "come-funziona",
  label: "Come funziona",
  title: "Dal ritiro alla consegna.",
  /** The title as the act sets it, one entry per line (same words). */
  titleLines: ["Dal ritiro", "alla consegna."] as const,
  act: { act: "04", name: "Preparazione", meta: "Quattro passaggi" },
  /** The route along the bottom of the scene: where the shipment ends. */
  arrival: "Destinazione",
  /** The stage caption (mono), e.g. "02 / 04 · Passaggio · Valutazione". */
  stageLabel: "Passaggio",
  action: { label: "Richiedi un preventivo", href: siteConfig.routes.quoteRequest },
  intro:
    "Cosa succede dopo la tua richiesta, passo per passo — con la stessa persona dall'inizio alla fine.",
  steps: [
    { title: "Richiesta", body: "Ci dici cosa devi spedire, da dove, per dove e per quando." },
    {
      title: "Valutazione",
      body: "Scegliamo il mezzo adatto al carico e ti confermiamo tempi e prezzo.",
    },
    {
      title: "Ritiro e trasporto",
      body: "Concordiamo l'orario del ritiro; il referente ti avvisa quando il mezzo è in arrivo e ti aggiorna in viaggio.",
    },
    { title: "Consegna", body: "Il carico arriva a destinazione e ti confermiamo la consegna." },
  ] as ProcessStep[],
  media: siteMedia.process.main as SlotMedia | undefined,
} as const;
