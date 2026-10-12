/**
 * The quote form's fields and copy — one definition for the home page's form
 * and the quote-request page's composer. The customer quotes with these
 * fields only: contacts, the pick-up address, the delivery address. Nothing is
 * kept apart from the channels: the request is sent to BSR from the quote-request
 * page, or prepared as a message for WhatsApp or email. No response-time promise
 * (docs/content-audit.md).
 */

/** The phone prefixes offered (the customer's own number), Italy first. */
export const PHONE_PREFIXES = [
  { value: "+39", label: "+39 Italia" },
  { value: "+33", label: "+33 Francia" },
  { value: "+34", label: "+34 Spagna" },
  { value: "+36", label: "+36 Ungheria" },
  { value: "+351", label: "+351 Portogallo" },
  { value: "+40", label: "+40 Romania" },
  { value: "+30", label: "+30 Grecia" },
  { value: "+90", label: "+90 Turchia" },
  { value: "+49", label: "+49 Germania" },
  { value: "+41", label: "+41 Svizzera" },
  { value: "+43", label: "+43 Austria" },
  { value: "+44", label: "+44 Regno Unito" },
] as const;

export const DEFAULT_PREFIX = "+39";

export const quoteFormContent = {
  steps: {
    contacts: "I tuoi contatti",
    path: "Il percorso del carico",
    confirm: "Conferma e invia",
  },
  optional: "facoltativa",
  contacts: {
    name: { label: "Nome e cognome", placeholder: "Mario Rossi" },
    email: { label: "Email", placeholder: "mario@example.it" },
    prefix: { label: "Prefisso" },
    phone: { label: "Telefono", placeholder: "333 123 4567" },
  },
  pickup: {
    title: "Indirizzo di ritiro",
    street: { label: "Via e numero civico", placeholder: "Via Roma 10" },
    zip: { label: "CAP", placeholder: "41012" },
    city: { label: "Città", placeholder: "Carpi" },
    province: { label: "Provincia / contea", placeholder: "MO" },
  },
  delivery: {
    title: "Indirizzo di consegna",
    street: { label: "Via e numero civico", placeholder: "5 Rue de la Gare" },
    zip: { label: "CAP", placeholder: "69001" },
    city: { label: "Città", placeholder: "Lione" },
    province: { label: "Provincia / contea", placeholder: "Rhône" },
  },
  errors: {
    name: "Indica nome e cognome.",
    email: "Indica un'email valida o lascia vuoto.",
    phone: "Indica un numero di telefono valido.",
    street: "Indica via e numero civico.",
    zip: "Indica il CAP.",
    city: "Indica la città.",
    province: "Indica la provincia.",
  },
  submit: "Invia la richiesta",
  note: "Nella pagina successiva controlli la richiesta e la invii a BSR (oppure la apri su WhatsApp o per email). Poi ti ricontattiamo per confermare mezzo, tempi e prezzo.",
  /** Over the request the visitor arrived with (a service, a sector or a vehicle chosen on the page). */
  context: "Richiesta per",
} as const;
