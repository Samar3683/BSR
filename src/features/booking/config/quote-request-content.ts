/**
 * Quote-request page copy. Every statement is VERIFIED in
 * docs/content-audit.md: BSR confirms vehicle, times and price before the
 * transport; the request reaches BSR through the form (stored for the
 * dispatch team) or through BSR's real channels, WhatsApp and email. No response-time promise until BSR confirms one (the audit's
 * "30 minuti" entry).
 */
export const quoteRequestContent = {
  title: "Richiedi un preventivo",
  description:
    "Indica i tuoi contatti e gli indirizzi di ritiro e di consegna: il messaggio si apre già compilato su WhatsApp o per email. BSR ti ricontatta per confermare mezzo, tempi e prezzo.",
  eyebrow: "Preventivo",
  headline: "Richiedi un preventivo",
  intro:
    "Compila i campi e invia la richiesta a BSR. Se preferisci, il messaggio è già pronto per WhatsApp o per email.",
  composer: {
    previewLabel: "Il tuo messaggio",
  },
  submit: {
    label: "Invia la richiesta a BSR",
    sending: "Invio in corso…",
    privacy: "Inviando la richiesta, BSR usa i tuoi dati solo per risponderti.",
    privacyLink: "Informativa privacy",
    sentTitle: "Richiesta ricevuta",
    sentReference: "Riferimento",
    sentBody: "Ti ricontattiamo per confermare mezzo, tempi e prezzo prima di partire.",
    sentAlso: "Vuoi scriverci anche subito?",
    errorsTitle: "Controlla i campi indicati.",
  },
  send: {
    whatsapp: "Scrivici su WhatsApp",
    whatsappHint: "(apre WhatsApp)",
    call: "Chiama",
    email: "Scrivi un'email",
    note: "Preferisci un altro canale? Il messaggio è già scritto: lo invii tu, su WhatsApp o per email.",
  },
  /** What happens next — the official site's process, in three steps. */
  next: {
    heading: "Cosa succede dopo",
    items: [
      "Ci invii la richiesta da questa pagina, su WhatsApp o per email.",
      "Ti ricontattiamo e ti confermiamo mezzo, tempi e prezzo prima di partire.",
      "Concordiamo il ritiro: un referente ti aggiorna fino alla consegna.",
    ],
  },
  coverage: {
    heading: "Dove operiamo",
  },
  contactsHeading: "Contatti diretti",
  back: "Torna alla pagina principale",
} as const;
