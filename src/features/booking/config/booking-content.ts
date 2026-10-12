import { siteConfig } from "@/config/site";

/**
 * The home page's quote act ("Hai un carico da muovere?"): the form's fields
 * and copy live in quote-form-content.ts (shared with the quote-request page).
 * The form is a plain GET to `/preventivo`, where the request is checked and sent
 * to BSR (stored for the dispatch team) or opened on WhatsApp / email. No
 * response-time promise (docs/content-audit.md).
 */
export const bookingContent = {
  /** Navigation anchor ("Preventivo", site-navigation.ts). */
  id: "richiesta",
  chapter: { index: "10", name: "Richiesta", context: "Ritiro → Consegna" },
  label: "Richiesta di preventivo",
  /** The act's question, one entry per line. */
  title: ["Hai un carico", "da muovere?"] as const,
  /** The route arriving at its destination over the act (decorative). */
  arrival: { origin: "Carpi (MO)", destination: "La tua destinazione" },
  intro: "Compila i campi: contatti, indirizzo di ritiro e di consegna.",
  action: siteConfig.routes.quoteRequest,
  privacy:
    "Nella pagina successiva controlli la richiesta e la invii a BSR, oppure la apri su WhatsApp o per email.",
  alternative: "Preferisci scriverci subito?",
  whatsapp: "Scrivici su WhatsApp",
  whatsappHint: "(apre WhatsApp)",
} as const;
