import { siteConfig } from "@/config/site";
import { type VehicleId, vehicles } from "@/config/site-content";
import { siteMedia } from "@/config/site-media";
import type { SlotMedia } from "@/types/media";

/**
 * The fleet, as the official site describes it (docs/content-audit.md):
 * vans (internal load space about 4 × 2 × 2 m, payload up to about
 * 1,000–1,200 kg), rigid trucks (motrici), large trucks and articulated
 * trucks (bilici) for bulky loads and industrial shipments; the vehicle is
 * assigned to what you ship. Only the van carries figures; the others say
 * their configuration depends on the shipment — never invented tonnage,
 * dimensions or vehicle counts.
 *
 * Each vehicle's action opens the request with it already chosen
 * (`/preventivo?mezzo=…`); "Quale mezzo mi serve?" opens it undecided.
 */
export type VehicleKind = "van" | "rigid" | "tractor";

export interface VehicleSpec {
  label: string;
  value: string;
}

export interface VehicleCategory {
  id: Exclude<VehicleId, "da-valutare">;
  code: string;
  /** Selector label (set in capitals by CSS). */
  label: string;
  /** Full name, the panel's heading. */
  name: string;
  kind: VehicleKind;
  /** One line: what this vehicle is for. */
  useCase: string;
  specs?: readonly VehicleSpec[];
  note?: string;
  /** The request, with this vehicle already chosen. */
  action: { label: string; context: string; href: string };
  media?: SlotMedia;
}

const request = (id: VehicleId) => `${siteConfig.routes.quoteRequest}?mezzo=${id}`;

export const vehiclesContent = {
  /** Navigation anchor (site-navigation.ts). */
  id: "flotta",
  eyebrow: "Flotta",
  title: "Il mezzo giusto per ogni spedizione.",
  intro:
    "Mezzi di diverse dimensioni, dai furgoni ai bilici: in base a cosa devi spedire, ti assegniamo il mezzo più adatto.",
  selectorLabel: "Tipo di mezzo",
  /** Shown where a vehicle has no published figures. */
  capacity: {
    label: "Capacità",
    pending: "Configurazione in base alla spedizione.",
  },
  /** For visitors who don't know which vehicle they need. */
  undecided: {
    question: "Quale mezzo mi serve?",
    answer: "Descrivici il carico: te lo indichiamo noi.",
    cta: "Richiedi un preventivo",
    href: request("da-valutare"),
  },
  categories: [
    {
      id: "furgone",
      code: "01",
      label: "Furgone",
      name: vehicles.furgone,
      kind: "van",
      media: siteMedia.fleet.van,
      useCase: "Per carichi contenuti e consegne rapide, anche in città.",
      action: { label: "Richiedi un preventivo", context: "con il furgone", href: request("furgone") },
      // No-break spaces (and a word joiner after the dash) keep each figure whole.
      specs: [
        { label: "Vano di carico (interno)", value: "circa 4 × 2 × 2 m" },
        { label: "Portata", value: "fino a circa 1.000–⁠1.200 kg" },
      ],
      note: "Valori indicativi.",
    },
    {
      id: "motrice",
      code: "02",
      label: "Motrice",
      name: vehicles.motrice,
      kind: "rigid",
      media: siteMedia.fleet.rigid,
      useCase: "Per carichi che richiedono più spazio di un furgone.",
      action: { label: "Richiedi un preventivo", context: "con la motrice", href: request("motrice") },
    },
    {
      id: "articolato",
      code: "03",
      label: "Articolato",
      name: vehicles.articolato,
      kind: "tractor",
      media: siteMedia.fleet.articulated,
      useCase: "Il bilico, per carichi voluminosi e spedizioni industriali.",
      action: { label: "Richiedi un preventivo", context: "con l'articolato", href: request("articolato") },
    },
  ] as VehicleCategory[],
} as const;
