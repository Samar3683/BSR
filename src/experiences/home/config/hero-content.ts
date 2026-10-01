import { siteConfig } from "@/config/site";

/**
 * Hero copy and links.
 *
 * ⚠ PLACEHOLDER COPY — not approved marketing copy. Every string follows the
 * approved content hierarchy and only restates confirmed business facts, but
 * final wording (per language) comes from the copy approval step.
 */
export const heroContent = {
  /** PLACEHOLDER — brand form ("BSR" vs "BSR Trasporti") still to be confirmed. */
  eyebrow: "BSR · Trasporto merci",
  /** PLACEHOLDER — conceptual direction "what + where" (confirmed positioning). */
  headline: "Trasporti espressi e dedicati in tutta Italia",
  /** PLACEHOLDER — single-contact differentiator (confirmed service model). */
  supporting: "Un unico referente segue la tua spedizione, dal ritiro alla consegna.",
  primaryCta: {
    label: "Richiedi un preventivo",
    /** Quote-request route (Phase 1: structural placeholder page; full flow later). */
    href: siteConfig.routes.quoteRequest,
    /**
     * Neutral until BSR confirms a response time (docs/content-audit.md: the
     * official site says both "entro 30 minuti" and "in poche ore").
     */
    note: "Ti ricontattiamo per confermare mezzo, tempi e prezzo.",
  },
  whatsapp: {
    label: "Scrivici su WhatsApp",
    href: siteConfig.contact.whatsappHref,
    /** Announced to assistive technology: the link leaves the site. */
    externalHint: "(apre WhatsApp)",
  },
  scrollCue: "Scorri",
  /** Pause control for the phone clips (interface strings). */
  media: {
    pause: "Metti in pausa l'animazione",
    play: "Riproduci l'animazione",
  },
  /**
   * State 5 supporting line. Semantic by default; it may be hidden from
   * assistive technology only if approved copy is purely decorative AND its
   * meaning already exists elsewhere in semantic HTML.
   */
  roadLine: {
    /** PLACEHOLDER — conceptual density only. */
    text: "Dal ritiro alla destinazione.",
    decorative: false,
  },
} as const;
