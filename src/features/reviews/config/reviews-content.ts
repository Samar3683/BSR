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
  eyebrow: "Dicono di noi",
  title: "La parola a chi ci affida i trasporti.",
  testimonials: [] as Testimonial[],
  /** Shown while there are no approved testimonials. */
  invitation: {
    eyebrow: "Parliamone",
    title: "Vuoi raccontarci cosa devi trasportare?",
    body: "Partenza, destinazione e tipo di carico: ti ricontattiamo per definire la soluzione.",
    quote: { label: "Richiedi un preventivo", href: siteConfig.routes.quoteRequest },
    whatsapp: { label: "Scrivici su WhatsApp", hint: "(apre WhatsApp)" },
    call: "Chiama",
  },
} as const;
