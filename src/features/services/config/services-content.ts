import { siteConfig } from "@/config/site";
import { services, transit } from "@/config/site-content";
import { siteMedia } from "@/config/site-media";
import type { SlotMedia } from "@/types/media";

/**
 * The two services, each answering: what is it, when to choose it, where it
 * runs, what happens after the request. Wording VERIFIED in
 * docs/content-audit.md (official site and brief): timings indicative, the
 * same-day pickup always conditional, "senza soste intermedie né trasbordi"
 * for the dedicated service. Each action opens the request with the service
 * already chosen (`/preventivo?servizio=…`).
 */
export interface ServiceFact {
  label: string;
  value: string;
}

export interface ServiceItem {
  id: "espresso" | "dedicato";
  /** Chapter-local numeral, e.g. "01". */
  code: string;
  /** Short name for the eyebrow, e.g. "Espresso". */
  label: string;
  title: string;
  /** When to choose it, in one line. */
  message: string;
  /** What it is and where it runs, in one or two sentences. */
  body: string;
  facts: readonly ServiceFact[];
  /** The route under the truck while the service is in play (decorative; said in the text). */
  route: { stops: readonly string[]; note: string };
  action: { label: string; context: string; href: string };
  media?: SlotMedia;
}

const request = (id: ServiceItem["id"]) => `${siteConfig.routes.quoteRequest}?servizio=${id}`;

export const servicesContent = {
  /** Navigation anchor (site-navigation.ts). */
  id: "servizi",
  label: "I servizi",
  /** Two lines: the choice, then the constant. */
  title: ["Due modi di trasportare.", "Un solo referente."] as const,
  intro:
    "Scegli l'espresso se il carico è urgente, il dedicato se deve viaggiare da solo, senza trasbordi. In entrambi i casi ti confermiamo mezzo, tempi e prezzo prima della partenza.",
  /** The route under the stage: pickup → movement → delivery (decorative). */
  connector: ["Ritiro", "In viaggio", "Consegna"] as const,
  /** The stage caption (mono), e.g. "01 / 02 · Espresso". */
  stageLabel: "Servizio",
  act: { act: "03", name: "Il servizio", meta: "Espresso · Dedicato" },
  /** The mode switch under the stage (each moves the scroll to its service). */
  switchLabel: "Scegli il servizio",
  items: [
    {
      id: "espresso",
      code: "01",
      label: "Espresso",
      title: services.espresso,
      message: "Quando il carico deve partire subito.",
      body: `Per le spedizioni urgenti in tutta Italia: ritiro anche in giornata, quando tratta e disponibilità lo consentono, e consegna indicativamente in ${transit.italyExpress.replace(" h", " ore")}.`,
      facts: [
        { label: "Tempi indicativi", value: transit.italyExpress },
        { label: "Ritiro", value: "Anche in giornata" },
        { label: "Area", value: "Tutta Italia" },
      ],
      route: { stops: ["Ritiro", "In viaggio", "Consegna"], note: transit.italyExpress },
      action: {
        label: "Richiedi un preventivo",
        context: "per il trasporto espresso",
        href: request("espresso"),
      },
      media: siteMedia.services.express,
    },
    {
      id: "dedicato",
      code: "02",
      label: "Dedicato",
      title: services.dedicato,
      message: "Quando il carico deve viaggiare da solo.",
      body: "Il mezzo è riservato alla tua merce: nessuna sosta intermedia né trasbordo, dal ritiro alla consegna. In Italia e sulle principali tratte europee, pianificato porta a porta.",
      facts: [
        { label: "Mezzo", value: "Riservato" },
        { label: "Trasbordi", value: "Nessuno" },
        { label: "Area", value: "Italia ed Europa" },
      ],
      route: { stops: ["Partenza", "Destinazione"], note: "Nessun trasbordo" },
      action: {
        label: "Richiedi un preventivo",
        context: "per il trasporto dedicato",
        href: request("dedicato"),
      },
      media: siteMedia.services.dedicated,
    },
  ] as ServiceItem[],
} as const;
