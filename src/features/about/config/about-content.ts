import { company } from "@/config/site-content";
import { siteMedia } from "@/config/site-media";
import type { SlotMedia } from "@/types/media";

/**
 * Who we are, and how to reach BSR — the site's contact block (navigation:
 * "Contatti"). Only verified facts (docs/content-audit.md): what BSR is and
 * where, the titolare as published, every channel and the company data from
 * config/site-content.ts. No biography, founding year, fleet size or staff
 * count. The titolare is not presented as the contact for every shipment
 * (the site says "un unico referente", unnamed).
 *
 * The photograph is illustrative (the supplied package is generated) and
 * captioned so: it does not depict the titolare. Replace it with a real,
 * consented photograph (siteMedia.about.portrait) before launch.
 */
export const aboutContent = {
  /** Navigation anchor (site-navigation.ts). */
  id: "chi-siamo",
  /** The contact block's anchor (navigation: "Contatti"). */
  contactId: "contatti",
  eyebrow: company.brand,
  title: "Chi siamo e come contattarci.",
  intro: `${company.brand} è un'${company.activity} con sede a Carpi (MO), attiva in tutta Italia e sulle principali tratte europee. Per un preventivo, un aggiornamento o una domanda, contattaci direttamente.`,
  caption: "Immagine illustrativa",
  contact: {
    heading: "Contatti",
    owner: company.owner.role,
    place: `${company.address.locality}, ${company.address.provinceName}`,
    phone: "Telefono",
    whatsapp: "WhatsApp",
    whatsappValue: "Scrivici su WhatsApp",
    whatsappHint: "(apre WhatsApp)",
    email: "Email",
    pec: "PEC",
  },
  detailsLabel: "Dati aziendali",
  labels: {
    name: "Denominazione",
    base: "Sede legale",
    vat: "P. IVA",
    rea: "REA",
  },
  media: siteMedia.about.portrait as SlotMedia | undefined,
} as const;
