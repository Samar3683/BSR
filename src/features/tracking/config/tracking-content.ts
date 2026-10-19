/**
 * Tracking page copy ("Controlla una richiesta"): a visitor looks up a quote
 * request or a message with its code, reads the team's answers, writes a
 * follow-up and — once a request has become an order — follows the order.
 * No response-time promise (docs/content-audit.md).
 */
export const trackingContent = {
  title: "Traccia la tua richiesta",
  description:
    "Controlla lo stato di una richiesta di preventivo o di un messaggio con il tuo codice di tracciamento e leggi le nostre risposte.",
  eyebrow: "Tracciamento",
  headline: "Traccia la tua richiesta",
  intro:
    "Inserisci il codice che hai ricevuto dopo l'invio: vedi lo stato, le nostre risposte e, quando c'è un trasporto, a che punto è.",
  form: {
    label: "Codice di tracciamento",
    placeholder: "RQ-2026-00042-ABC234",
    submit: "Controlla",
    checking: "Controllo in corso…",
    empty: "Inserisci il codice di tracciamento.",
    notFound: "Codice non trovato. Controlla di averlo scritto correttamente.",
    failed: "Non riusciamo a controllare il codice. Riprova più tardi.",
  },
  kinds: { quote: "Richiesta di preventivo", message: "Messaggio" },
  labels: {
    code: "Codice",
    received: "Ricevuta il",
    status: "Stato",
    route: "Percorso",
    conversation: "Conversazione",
    you: "Tu",
    team: "BSR",
    transport: "Il tuo trasporto",
    order: "Ordine",
    pickup: "Ritiro previsto",
    delivery: "Consegna prevista",
    history: "Avanzamento",
    noEntries: "Nessuna risposta per ora. Ti ricontattiamo noi.",
  },
  /** Statuses a visitor sees, in their words. */
  quoteStatus: {
    new: "Ricevuta",
    contacted: "Presa in carico",
    converted: "Trasformata in trasporto",
    discarded: "Chiusa",
  },
  messageStatus: { new: "Ricevuto", answered: "Risposto", closed: "Chiuso" },
  orderStatus: {
    draft: "In preparazione",
    confirmed: "Confermato",
    scheduled: "Pianificato",
    in_transit: "In viaggio",
    delivered: "Consegnato",
    cancelled: "Annullato",
  },
  followUp: {
    label: "Scrivici ancora",
    placeholder: "Aggiungi un messaggio a questa conversazione",
    submit: "Invia",
    sending: "Invio in corso…",
    empty: "Scrivi un messaggio.",
    sent: "Messaggio inviato.",
    failed: "Il messaggio non è stato inviato. Riprova più tardi.",
  },
  back: "Torna alla pagina principale",
  other: { heading: "Altro", message: "Scrivici un messaggio", quote: "Richiedi un preventivo" },
} as const;

export type QuoteStatus = keyof typeof trackingContent.quoteStatus;
export type MessageStatus = keyof typeof trackingContent.messageStatus;
export type OrderStatus = keyof typeof trackingContent.orderStatus;
