import { siteConfig } from "@/config/site";
import { sectors, services } from "@/config/site-content";

const options = (names: Record<string, string>) =>
  Object.entries(names).map(([value, label]) => ({ value, label }));

/**
 * The home page's quote starter ("Parliamo del tuo carico."). Route,
 * service and — optionally — sector, then the quote-request page (a plain GET
 * to `/preventivo`), where the message is prepared for WhatsApp or email.
 * Nothing is sent from here: no backend, no simulated submission, and no
 * response-time promise (docs/content-audit.md).
 */
export const bookingContent = {
  /** Navigation anchor ("Preventivo", site-navigation.ts). */
  id: "richiesta",
  chapter: { index: "10", name: "Richiesta", context: "Partenza → Destinazione" },
  label: "Richiesta di preventivo",
  /** The act's question, one entry per line. */
  title: ["Hai un carico", "da muovere?"] as const,
  /** The route arriving at its destination over the act (decorative). */
  arrival: { origin: "Carpi (MO)", destination: "La tua destinazione" },
  /** The three questions the starter answers. */
  questions: ["Da dove parte?", "Dove deve arrivare?", "Di quale servizio hai bisogno?"] as const,
  intro:
    "Compila i tre campi: nella pagina successiva aggiungi i dettagli e scegli come inviarci la richiesta.",
  action: siteConfig.routes.quoteRequest,
  fields: {
    origin: { name: "partenza", label: "Partenza", placeholder: "Es. Carpi (MO)" },
    destination: { name: "destinazione", label: "Destinazione", placeholder: "Es. Lione, Francia" },
    service: {
      name: "servizio",
      label: "Servizio",
      /** The line under each choice — verified wording (docs/content-audit.md). */
      options: options(services).map((option) => ({
        ...option,
        hint:
          {
            espresso: "Per le spedizioni urgenti",
            dedicato: "Mezzo riservato, senza trasbordi",
            "da-valutare": "Descrivi il carico: te lo indichiamo noi",
          }[option.value] ?? "",
      })),
    },
    sector: {
      name: "settore",
      label: "Settore",
      optional: "facoltativo",
      empty: "Non indicato",
      options: options(sectors),
    },
  },
  errors: {
    service: "Scegli il servizio.",
    origin: "Indica da dove parte il carico.",
    destination: "Indica dove deve arrivare.",
  },
  hints: {
    origin: "Città o CAP di ritiro.",
    destination: "Città o paese di consegna.",
  },
  submit: "Richiedi un preventivo",
  note: "Ti ricontattiamo per confermare mezzo, tempi e prezzo.",
  privacy: "Il modulo non invia la richiesta: il messaggio lo invii tu, su WhatsApp o per email.",
  alternative: "Preferisci scriverci subito?",
  whatsapp: "Scrivici su WhatsApp",
  whatsappHint: "(apre WhatsApp)",
} as const;
