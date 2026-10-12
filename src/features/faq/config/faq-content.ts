import { contact, europeList, transit } from "@/config/site-content";

export interface FaqItem {
  question: string;
  answer: string;
}

export const faqContent = {
  /** Navigation anchor (site-navigation.ts). */
  id: "faq",
  chapter: { index: "11", name: "Domande", context: "Risposte verificate" },
  label: "Domande frequenti",
  title: "Hai delle domande?",
  /** The contact prompt beside the list. */
  prompt: {
    title: "Non trovi la risposta?",
    body: "Chiedi direttamente al referente: un solo numero, nessun call center.",
    phone: "Telefono",
    whatsapp: "WhatsApp",
    whatsappHint: "(apre WhatsApp)",
    email: "Email",
  },
  intro: {
    before: "Qui trovi le risposte alle domande più comuni.",
    after: "Se non trovi quello che cerchi,",
    link: { label: "contattaci direttamente", href: "/#contatti" },
  },
  /**
   * Not asked on purpose: "Quali tipologie di merci trasportate?" — BSR has not
   * confirmed what goods it carries (docs/content-audit.md), so no answer
   * exists to give. Add it when BSR supplies one.
   */
  items: [
    {
      question: "Come gestite la sicurezza dei carichi di alto valore?",
      answer:
        "Il carico viaggia fissato con cinghie e protezioni adeguate, e ogni trasporto ha la copertura assicurativa vettoriale. Per merci di valore elevato si possono attivare coperture integrative su richiesta, da concordare al momento del preventivo.",
    },
    {
      question: "In quali paesi operate?",
      answer: `In tutta Italia, isole comprese, e sulle principali tratte europee: ${europeList}.`,
    },
    {
      question: "Quanto tempo richiede la consegna?",
      answer: `Per i trasporti espressi in Italia, entro ${transit.italyExpress.replace(" h", " ore")} e, in molti casi, anche in giornata. Per le tratte europee da 24 ore a 7 giorni, secondo la destinazione. I tempi ti vengono comunicati prima della conferma.`,
    },
    {
      question: "Quale mezzo è più adatto alla mia spedizione?",
      answer:
        "Dipende da cosa devi spedire: abbiamo mezzi di diverse dimensioni, dai furgoni (vano interno di circa 4 × 2 × 2 m, portata fino a circa 1.000–1.200 kg) alle motrici, fino ai bilici per carichi voluminosi e spedizioni industriali. Il mezzo lo scegliamo noi in base al carico.",
    },
    {
      question: "Come posso richiedere un preventivo?",
      answer: `Indica contatti e indirizzi di ritiro e di consegna nel modulo di questa pagina e invia la richiesta a BSR; in alternativa il messaggio si apre già compilato su WhatsApp o per email. Oppure chiamaci al ${contact.phoneDisplay} o scrivici a ${contact.email}. Il prezzo dipende da distanza, tipo di mezzo e urgenza.`,
    },
    {
      question: "Offrite un servizio di trasporto dedicato?",
      answer:
        "Sì. Nel trasporto dedicato il mezzo è riservato alla tua merce, senza soste intermedie né trasbordi, dal ritiro alla consegna. Per le spedizioni urgenti c'è il trasporto espresso.",
    },
    {
      question: "Posso seguire la mia spedizione?",
      answer:
        "Sì: il referente ti aggiorna via WhatsApp o telefono al ritiro, durante il viaggio e alla consegna. Un solo numero, nessun call center.",
    },
  ] as FaqItem[],
} as const;
