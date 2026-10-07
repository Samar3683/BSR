import { siteMedia } from "@/config/site-media";
import type { SlotMedia } from "@/types/media";

/**
 * Cargo security — each principle's title, commitment and the photograph say
 * the same thing, in the official site's own wording (docs/content-audit.md).
 * Insurance stays exactly as published: the carrier's cover on every
 * transport, supplementary cover on request — never "complete" or
 * "guaranteed". No monitoring, tracking or delivery guarantee.
 */
export interface Principle {
  code: string;
  title: string;
  body: string;
}

export const protectionContent = {
  id: "sicurezza",
  chapter: { index: "07", name: "Sicurezza del carico", context: "Ritiro · Viaggio · Consegna" },
  label: "Sicurezza del carico",
  title: "Il tuo carico, seguito con attenzione.",
  intro: "Come viene protetta la tua merce, dal ritiro alla consegna.",
  principles: [
    {
      code: "01",
      title: "Protezione",
      body: "Il carico viaggia fissato con cinghie e protezioni adeguate; nei trasporti dedicati il mezzo porta solo la tua merce, senza trasbordi.",
    },
    {
      code: "02",
      title: "Controllo",
      body: "Ogni fase è seguita dallo stesso referente, dal ritiro alla consegna.",
    },
    {
      code: "03",
      title: "Comunicazione",
      body: "Ti aggiorniamo via WhatsApp o telefono al ritiro, durante il viaggio e alla consegna.",
    },
    {
      code: "04",
      title: "Assicurazione",
      body: "Ogni trasporto viaggia con copertura assicurativa vettoriale; per merci di valore elevato, coperture integrative su richiesta.",
    },
  ] as Principle[],
  media: siteMedia.security.main as SlotMedia | undefined,
} as const;
