import { siteConfig } from "@/config/site";

/**
 * Customer reviews. A testimonial appears only with `permission: true` — the
 * author's written consent to publish the quote, their name, role and
 * company as approved (record where in `source`). None exists yet
 * (docs/content-audit.md): until one does, the section is a short invitation
 * to talk — never a sample, a paraphrase, a rating or a review count.
 */
export interface Testimonial {
  quote: string;
  person: string;
  company?: string;
  role?: string;
  /** The route or service the review is about, e.g. "Espresso · Carpi → Lione". */
  context?: string;
  /** Written consent to publish, as worded above. */
  permission: boolean;
  /** Where the consent is recorded. */
  source?: string;
}

/** Only approved testimonials ever render. */
export const approvedTestimonials = (entries: readonly Testimonial[]) =>
  entries.filter((entry) => entry.permission === true);

export const reviewsContent = {
  id: "recensioni",
  chapter: { index: "09", name: "Recensioni", context: "Voce dei clienti" },
  label: "Dicono di noi",
  title: "La parola a chi ci affida i trasporti.",
  testimonials: [] as Testimonial[],
  /** Shown while there are no approved testimonials. */
  invitation: {
    label: "Dicono di noi",
    /** Two lines: the empty space turned into an invitation. */
    title: ["La prossima storia", "potrebbe essere la tua."] as const,
    question: "Hai una spedizione da organizzare?",
    body: "Parliamone direttamente: un solo numero, nessun call center.",
    write: { label: "Scrivi a BSR", hint: "(apre WhatsApp)" },
    quote: { label: "Richiedi un preventivo", href: siteConfig.routes.quoteRequest },
    call: "Chiama",
  },
} as const;
