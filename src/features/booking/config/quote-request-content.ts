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
    "Indica partenza, destinazione e servizio: il messaggio si apre già compilato su WhatsApp o per email. BSR ti ricontatta per confermare mezzo, tempi e prezzo.",
  eyebrow: "Preventivo",
  headline: "Richiedi un preventivo",
  intro:
    "Compila i campi che conosci: il messaggio si prepara da solo. Lo apri su WhatsApp o per email, lo controlli e ce lo invii.",
  composer: {
    notSpecified: "Non indicato",
    previewLabel: "Il tuo messaggio",
    fields: {
      origin: { label: "Partenza", placeholder: "Es. Carpi (MO) o CAP 41012" },
      destination: { label: "Destinazione", placeholder: "Es. Milano, o Lione (Francia)" },
      service: { label: "Servizio" },
      vehicle: { label: "Mezzo" },
      sector: { label: "Settore" },
      when: { label: "Quando", placeholder: "Es. ritiro entro venerdì" },
      goods: { label: "Merce", placeholder: "Es. 2 bancali, circa 800 kg" },
    },
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
