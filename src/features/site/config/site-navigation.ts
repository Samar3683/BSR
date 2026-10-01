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
  tagline: "Trasporti espressi e dedicati in tutta Italia e su rotte europee selezionate.",
  navHeading: "Sito",
  /** Anchor of the footer's contact column (the navigation's "Contatti" is in "Chi siamo"). */
  contactId: "contatti-footer",
  contactHeading: "Contatti",
  labels: { phone: "Telefono", email: "Email", pec: "PEC" },
  legalLabel: "Informazioni legali",
  /** Legal pages that exist (only link to pages that do). */
  legal: [{ label: "Privacy e cookie", href: siteConfig.routes.privacy }],
  vatLabel: "P. IVA",
  reaLabel: "REA",
  copyright: company.brand,
  legalName: company.legalName,
} as const;
