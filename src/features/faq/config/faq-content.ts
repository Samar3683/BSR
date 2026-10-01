import { contact, europeList, transit } from "@/config/site-content";

/**
 * Frequently asked questions — real customer concerns, answered only with
 * VERIFIED facts (docs/content-audit.md; most restate the official site's
 * own FAQ). Timings stay indicative; updates are the contact person's, by
 * WhatsApp or phone (no online or GPS tracking); insurance exactly as
 * published; no response-time promise. Contacts and countries come from
 * config/site-content.ts, never retyped here.
 */
export interface FaqItem {
  question: string;
  answer: string;
}

export const faqContent = {
  /** Navigation anchor (site-navigation.ts). */
  id: "faq",
  eyebrow: "FAQ",
  title: "Domande frequenti",
  intro: "Le risposte alle domande che riceviamo più spesso. Per tutto il resto, scrivici.",
  items: [
    {
      question: "Quali servizi offrite?",
      answer:
        "Trasporti espressi, per le spedizioni urgenti, e trasporti dedicati, con il mezzo riservato alla tua merce: nessuna sosta intermedia né trasbordo.",
    },
    {
      question: "Dove operate?",
      answer: `In tutta Italia, isole comprese, e sulle principali tratte europee: ${europeList}.`,
    },
    {
      question: "Quali sono i tempi di consegna?",
      answer: `Per i trasporti espressi in Italia, indicativamente ${transit.italyExpress.replace(" h", " ore")} e, in molti casi, anche in giornata. Per le tratte europee in genere da 2 a 5 giorni, secondo la destinazione. I tempi ti vengono comunicati prima della conferma.`,
    },
    {
      question: "Che mezzi avete?",
      answer:
        "Mezzi di diverse dimensioni: dai furgoni (vano interno di circa 4 × 2 × 2 m, portata fino a circa 1.000–1.200 kg) alle motrici, fino ai bilici per carichi voluminosi e spedizioni industriali. Il mezzo lo scegliamo in base a cosa devi spedire.",
    },
    {
      question: "Come viene calcolato il prezzo?",
      answer:
        "Dipende da distanza, tipo di mezzo e urgenza. Mezzo, tempi e prezzo ti vengono confermati prima del trasporto.",
    },
    {
      question: "Come richiedo un preventivo?",
      answer: `Indica partenza, destinazione e servizio nel modulo di questa pagina: il messaggio si apre già compilato su WhatsApp o per email, e lo invii tu. Oppure chiamaci al ${contact.phoneDisplay} o scrivici a ${contact.email}.`,
    },
    {
      question: "Posso seguire la mia spedizione?",
      answer:
        "Sì: il referente ti aggiorna via WhatsApp o telefono al ritiro, durante il viaggio e alla consegna. Un solo numero, nessun call center.",
    },
    {
      question: "Il trasporto è assicurato?",
      answer:
        "Sì: ogni trasporto viaggia con copertura assicurativa vettoriale. Per merci di valore elevato si possono attivare coperture integrative su richiesta, da concordare al momento del preventivo.",
    },
  ] as FaqItem[],
} as const;
