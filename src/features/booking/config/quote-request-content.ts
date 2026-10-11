/**
 * Quote-request page copy. Every statement is VERIFIED in
 * docs/content-audit.md: BSR confirms vehicle, times and price before the
 * transport; the request goes through BSR's real channels (the site sends
 * nothing). No response-time promise until BSR confirms one (the audit's
 * "30 minuti" entry).
 */
export const quoteRequestContent = {
  title: "Richiedi un preventivo",
  description:
    "Indica i tuoi contatti e gli indirizzi di ritiro e di consegna: il messaggio si apre già compilato su WhatsApp o per email. BSR ti ricontatta per confermare mezzo, tempi e prezzo.",
  eyebrow: "Preventivo",
  headline: "Richiedi un preventivo",
  intro:
    "Compila i campi: il messaggio si prepara da solo. Lo apri su WhatsApp o per email, lo controlli e ce lo invii.",
  composer: {
    previewLabel: "Il tuo messaggio",
  },
  send: {
    whatsapp: "Scrivici su WhatsApp",
    whatsappHint: "(apre WhatsApp)",
    call: "Chiama",
    email: "Scrivi un'email",
    note: "La richiesta non parte da questa pagina: la invii tu, su WhatsApp o per email.",
  },
  /** What happens next — the official site's process, in three steps. */
  next: {
    heading: "Cosa succede dopo",
    items: [
      "Ci invii la richiesta su WhatsApp o per email.",
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
