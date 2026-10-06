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
  eyebrow: "Come funziona",
  title: "Dal ritiro alla consegna.",
  intro:
    "Cosa succede dopo la tua richiesta, passo per passo — con la stessa persona dall'inizio alla fine.",
  steps: [
    { title: "Richiesta", body: "Ci dici cosa devi spedire, da dove, per dove e per quando." },
    {
      title: "Analisi",
      body: "Scegliamo il mezzo adatto al carico e ti confermiamo tempi e prezzo.",
    },
    {
      title: "Trasporto",
      body: "Concordiamo l'orario del ritiro; il referente ti avvisa quando il mezzo è in arrivo e ti aggiorna in viaggio.",
    },
    { title: "Consegna", body: "Il carico arriva a destinazione e ti confermiamo la consegna." },
  ] as ProcessStep[],
  media: siteMedia.process.main as SlotMedia | undefined,
} as const;
