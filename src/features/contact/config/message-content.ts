/**
 * "Scrivici un messaggio": the contact form's copy. The message is stored for
 * the team and answered from the panel; the visitor follows the answer with the
 * tracking code (see features/tracking). No response-time promise
 * (docs/content-audit.md).
 */
export const messageContent = {
  title: "Scrivici un messaggio",
  description:
    "Hai una domanda? Scrivici: ti rispondiamo per email o telefono e puoi seguire la risposta con un codice.",
  eyebrow: "Contatti",
  headline: "Scrivici un messaggio",
  intro:
    "Hai una domanda o una richiesta particolare? Lasciaci il messaggio e un recapito: ti rispondiamo noi. Per un preventivo di trasporto usa il modulo di richiesta.",
  fields: {
    name: { label: "Nome e cognome", placeholder: "Mario Rossi" },
    email: { label: "Email", placeholder: "mario@example.it" },
    phone: { label: "Telefono", placeholder: "333 123 4567" },
    subject: { label: "Oggetto", placeholder: "Di cosa si tratta?" },
    message: { label: "Messaggio", placeholder: "Scrivi qui il tuo messaggio" },
  },
  optional: "facoltativo",
  contactHint: "Indica almeno l'email o il telefono, così possiamo risponderti.",
  errors: {
    name: "Indica nome e cognome.",
    email: "Indica un'email valida o lascia vuoto.",
    phone: "Indica un numero di telefono valido o lascia vuoto.",
    contact: "Indica almeno un'email o un telefono.",
    message: "Scrivi un messaggio (almeno 5 caratteri).",
  },
  submit: "Invia il messaggio",
  sending: "Invio in corso…",
  privacy: "Inviando il messaggio, BSR usa i tuoi dati solo per risponderti.",
  privacyLink: "Informativa privacy",
  sentTitle: "Messaggio ricevuto",
  sentCode: "Codice di tracciamento",
  sentBody:
    "Conserva il codice: con questo puoi leggere la nostra risposta e scriverci ancora. Se hai indicato un'email, ti inviamo anche il codice.",
  sentTrack: "Segui il tuo messaggio",
  failed: "Il messaggio non è stato inviato. Riprova o chiamaci.",
  other: {
    heading: "Preferisci un altro canale?",
    quote: "Richiedi un preventivo",
    track: "Controlla una richiesta",
  },
} as const;
