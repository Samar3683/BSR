import { siteConfig } from "@/config/site";
import { siteMedia } from "@/config/site-media";
import type { SlotMedia } from "@/types/media";

/**
 * The closing conversion chapter, as supplied in the client brief. Channels
 * come from siteConfig (the single source). There is no form here: the
 * primary action leads to the quote-request page, which offers the real
 * channels that work today.
 */
export const quoteContent = {
  /** In-page anchor; the navigation's "Preventivo" goes to the quote page itself. */
  id: "preventivo",
  label: "Parliamone",
  /** The route marked over the photograph (decorative). */
  route: ["Carpi (MO)", "La tua destinazione"] as const,
  /** Two lines, deliberately — see services-content.ts. */
  // "da organizzare?" never breaks (no-break space): no stranded "da" on phones.
  title: ["Hai una spedizione", "da organizzare?"] as const,
  /** The film's last frame: the statement over the departure (one entry per line). */
  statement: ["Il tuo carico.", "La nostra strada."] as const,
  act: { act: "12", name: "Arrivo", meta: "Carpi (MO) → La tua destinazione" },
  body: "Parlaci della tratta e del carico. Ti ricontattiamo per definire la soluzione.",
  primary: { label: "Richiedi un preventivo", href: siteConfig.routes.quoteRequest },
  whatsapp: {
    label: "WhatsApp",
    hint: "(apre WhatsApp)",
    href: siteConfig.contact.whatsappHref,
  },
  callLabel: "Oppure chiama",
  /** The chapter's cinematic background (decorative): a departure at dawn. A loop can replace it. */
  media: siteMedia.finalCta.background as SlotMedia | undefined,
} as const;
