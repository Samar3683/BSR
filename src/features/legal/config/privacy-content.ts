import { contact } from "@/config/site-content";

/**
 * Privacy and cookie notice. Company-specific statements restate the
 * official site's published policy (bsrtrasporti.com/privacy: controller,
 * legal basis, retention, WhatsApp handled by Meta, privacy contact); the
 * statements about this site are facts of the build (no cookies, no browser
 * storage, no analytics, self-hosted fonts, a request form that only prepares
 * a message) — see docs/content-audit.md.
 *
 * Pending (internal, never shown as a placeholder): the hosting provider and
 * its server logs, once the site is deployed. Re-check "no cookies" whenever
 * analytics, maps, embeds or a form backend are added. Legal review before
 * launch.
 */
export interface PrivacySection {
  heading: string;
  /** Show the controller's identity (config/site-content.ts) as this section's content. */
  controller?: boolean;
  body?: readonly string[];
}

export const privacyContent = {
  title: "Privacy e cookie",
  eyebrow: "Informazioni legali",
  updated: "Ultimo aggiornamento: 1 ottobre 2026",
  intro:
    "Come BSR tratta i dati personali di chi visita questo sito e ci contatta (Regolamento UE 2016/679, «GDPR»), e quali strumenti usa il sito.",
  sections: [
    { heading: "Titolare del trattamento", controller: true },
    {
      heading: "Quali dati trattiamo",
      body: [
        "Il modulo di richiesta preventivo non invia la richiesta: prepara soltanto un messaggio, che sei tu a inviarci su WhatsApp o via email. I dati che inserisci compaiono nell'indirizzo della pagina e, come ogni visita a un sito, possono essere registrati nei log tecnici del servizio che ospita il sito.",
        "Trattiamo i dati che ci comunichi quando ci contatti — per telefono, WhatsApp, email o PEC — ad esempio nome, recapiti, indirizzi di ritiro e di consegna e i dettagli della spedizione.",
      ],
    },
    {
      heading: "Finalità e base giuridica",
      body: [
        "I dati sono trattati esclusivamente per rispondere alle richieste di trasporto, formulare un preventivo e organizzare il servizio richiesto. La base giuridica è l'esecuzione di misure precontrattuali adottate su richiesta dell'interessato (art. 6, par. 1, lett. b GDPR).",
      ],
    },
    {
      heading: "Comunicazione dei dati",
      body: [
        "I messaggi inviati su WhatsApp sono trattati anche da Meta Platforms Ireland Ltd., secondo la relativa informativa privacy; le email, dal fornitore del servizio di posta. I dati non sono venduti né ceduti a terzi per finalità di marketing.",
      ],
    },
    {
      heading: "Conservazione",
      body: [
        "I dati sono conservati per il tempo necessario a gestire la richiesta e, in caso di conclusione del contratto di trasporto, per gli obblighi di legge in materia fiscale e contrattuale.",
      ],
    },
    {
      heading: "Cookie e strumenti di tracciamento",
      body: [
        "Questo sito non utilizza cookie, né tecnici né di profilazione, e non salva dati nel tuo browser. Non usa strumenti di statistica o di tracciamento; i caratteri tipografici sono serviti dal sito stesso, senza richieste a terze parti.",
      ],
    },
    {
      heading: "I tuoi diritti",
      body: [
        "Puoi chiedere l'accesso ai tuoi dati, la rettifica, la cancellazione, la limitazione del trattamento e la portabilità, e opporti al trattamento (artt. 15–22 GDPR).",
        `Per esercitare questi diritti è sufficiente scrivere a ${contact.email}. Hai inoltre il diritto di proporre reclamo al Garante per la protezione dei dati personali (www.garanteprivacy.it).`,
      ],
    },
  ] as PrivacySection[],
  back: "Torna alla pagina principale",
} as const;
