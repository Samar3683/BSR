import { siteConfig } from "@/config/site";
import { company } from "@/config/site-content";

/**
 * Site navigation and footer content. Links point at home-page chapters
 * (absolute, so they work from every page); "Preventivo" is the home page's
 * request form, "Contatti" the contact block in "Chi siamo" (every channel
 * and the company data; the footer repeats the channels on every page).
 */
export const siteNavigation = {
  label: "Navigazione principale",
  home: { label: "BSR, pagina principale", href: "/" },
  links: [
    { label: "Home", href: "/" },
    { label: "Servizi", href: "/#servizi" },
    { label: "Preventivo", href: "/#richiesta" },
    { label: "Copertura", href: "/#copertura" },
    { label: "Flotta", href: "/#flotta" },
    { label: "Chi siamo", href: "/#chi-siamo" },
    { label: "Contatti", href: "/#contatti" },
  ],
  /**
   * The page region each navigation item stands for, for the active-section
   * indicator: a section id (or the hero, "hero") → the link it lights up.
   * Sections not listed light nothing (no aggressive switching).
   */
  sections: {
    hero: "/",
    bsr: "/",
    servizi: "/#servizi",
    settori: "/#servizi",
    richiesta: "/#richiesta",
    copertura: "/#copertura",
    flotta: "/#flotta",
    "chi-siamo": "/#chi-siamo",
    contatti: "/#contatti",
  } as Record<string, string>,
  cta: {
    label: "Richiedi un preventivo",
    shortLabel: "Preventivo",
    href: siteConfig.routes.quoteRequest,
  },
  menu: {
    open: "Apri il menu",
    close: "Chiudi il menu",
    title: "Menu",
    whatsapp: "Scrivici su WhatsApp",
    whatsappHint: "(apre WhatsApp)",
  },
} as const;

export const siteFooter = {
  label: "Piè di pagina",
  tagline: "Trasporti espressi e dedicati in tutta Italia e sulle principali tratte europee.",
  navHeading: "Sito",
  /** Anchor of the footer's contact column (the navigation's "Contatti" is in "Chi siamo"). */
  contactId: "contatti-footer",
  contactHeading: "Contatti",
  labels: { phone: "Telefono", email: "Email", pec: "PEC" },
  legalLabel: "Informazioni legali",
  /** Legal pages that exist (only link to pages that do). */
  legal: [
    { label: "Scrivici un messaggio", href: "/contatti" },
    { label: "Traccia la tua richiesta", href: "/tracciamento" },
    { label: "Privacy e cookie", href: siteConfig.routes.privacy },
  ],
  vatLabel: "P. IVA",
  reaLabel: "REA",
  copyright: company.brand,
  legalName: company.legalName,
  /**
   * Attribution required by the CC BY 4.0 licences of the hero's 3D truck
   * (assets/source/truck/ATTRIBUTION.md): title, author, source, licence, "modified".
   */
  credits: {
    lead: "Modelli 3D adattati da",
    works: [
      {
        title: "MAN TGX 2010 V8 – High-Detail Semi-Truck",
        author: "DevPoly3D",
        href: "https://sketchfab.com/3d-models/man-tgx-2010-v8-high-detail-semi-truck-34ce748d9a4b4de7b035cfe5cb97f5d1",
      },
      {
        title: "Truck Trailer FREE",
        author: "NLM",
        href: "https://sketchfab.com/3d-models/truck-trailer-free-575958a53e3d4e9f8bcfb1ee2cef67bf",
      },
    ],
    licence: { label: "CC BY 4.0", href: "https://creativecommons.org/licenses/by/4.0/" },
    modified: "Modificati.",
  },
} as const;
