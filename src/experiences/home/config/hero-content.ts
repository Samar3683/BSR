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
  /**
   * One H1 in three set lines: the service (two lines, the main headline), then
   * where, smaller and lighter. Read as one sentence: "Trasporti espressi e
   * dedicati. Tutta Italia." (confirmed positioning: what + where).
   */
  headline: {
    main: ["Trasporti espressi", "e dedicati."],
    sub: "Tutta Italia.",
  },
  /** PLACEHOLDER — single-contact differentiator (confirmed service model). */
  supporting: "Un unico referente segue la tua spedizione, dal ritiro alla consegna.",
  primaryCta: {
    label: "Richiedi un preventivo",
    /** Quote-request route (Phase 1: structural placeholder page; full flow later). */
    href: siteConfig.routes.quoteRequest,
  },
  whatsapp: {
    label: "Scrivici su WhatsApp",
    href: siteConfig.contact.whatsappHref,
    /** Announced to assistive technology: the link leaves the site. */
    externalHint: "(apre WhatsApp)",
  },
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
  /**
   * Video hero cues (config/hero-video.ts places them on the footage). Each
   * restates confirmed facts: the road line above, and the coverage statement of
   * the site description (config/site.ts).
   */
  cues: {
    road: { label: "In viaggio", text: "Dal ritiro alla destinazione." },
    arrival: {
      label: "Italia · Europa",
      text: "In tutta Italia e sulle principali tratte europee.",
    },
  },
} as const;
