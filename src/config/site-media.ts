import type { SlotMedia } from "@/types/media";

import { background } from "./backgrounds";

/**
 * Every photograph on the public site, by section — the one place to swap the
 * background set (config/backgrounds.ts: generated, illustrative) for real BSR
 * photography, or later a video or image sequence (SlotMedia `motion`): same
 * keys, no layout change.
 *
 * Rules (site-media.test.ts):
 * - each photograph appears once on the page;
 * - alt text says what the picture shows, never who: the pictures are
 *   illustrative, no person pictured is a named BSR contact;
 * - focal points per breakpoint keep the subject in frame from a portrait
 *   phone to a wide desktop.
 *
 * Slots waiting for real photography are `undefined` (the layout holds
 * without them): the sectors' own pictures.
 */
export const siteMedia = {
  services: {
    express: background(
      "express-sunrise-motorway",
      "Autoarticolato BSR su una strada di collina all'alba, con colline e montagne sullo sfondo.",
      { base: "58% center", lg: "55% center" },
    ),
    dedicated: background(
      "dedicated-customer-premises",
      "Autoarticolato BSR davanti al magazzino di un cliente, con un carrello elevatore al lavoro alla banchina.",
      { base: "62% center", lg: "55% center" },
    ),
  },
  sectors: {
    /** The shared stage while the sectors have no pictures of their own. */
    stage: background(
      "cargo-sectors-warehouse",
      "Banchina di un magazzino al tramonto: bancali avvolti nel film estensibile, un carrello elevatore e un semirimorchio BSR.",
      { base: "45% center", lg: "45% 60%" },
    ),
    industria: undefined as SlotMedia | undefined,
    retail: undefined as SlotMedia | undefined,
    "e-commerce": undefined as SlotMedia | undefined,
    "aziende-commerciali": undefined as SlotMedia | undefined,
  },
  process: {
    main: background(
      "forklift-trailer-loading",
      "Carrello elevatore che carica un bancale su un semirimorchio BSR, davanti a un magazzino illuminato al tramonto.",
      { base: "50% center", lg: "50% 58%" },
    ),
  },
  fleet: {
    van: background(
      "fleet-van",
      "Furgone bianco con livrea BSR su un piazzale logistico bagnato, al tramonto.",
      {
        base: "50% center",
      },
    ),
    rigid: background(
      "fleet-rigid",
      "Motrice con cassone telonato e livrea BSR su un piazzale logistico, al tramonto.",
      { base: "50% center" },
    ),
    articulated: background(
      "fleet-articulated",
      "Trattore con semirimorchio telonato e livrea BSR davanti a un magazzino con la banchina illuminata.",
      { base: "58% center" },
    ),
  },
  coverage: {
    /** Background layer behind the map (decorative). */
    background: background("road-to-network-aerial", "", "center 60%"),
  },
  security: {
    main: background(
      "cargo-protection-straps",
      "Operatore con guanti che tende una cinghia rossa su bancali avvolti nel film, dentro un semirimorchio.",
      { base: "50% center", lg: "45% center" },
    ),
  },
  about: {
    portrait: background(
      "single-contact-dispatch",
      "Un operatore al telefono davanti a due schermi, nell'ufficio con vista sul piazzale e su un camion BSR.",
      { base: "62% center", lg: "62% center" },
    ),
  },
  finalCta: {
    /** Background (decorative): the last light of the road. */
    background: background("final-sunset-road", "", { base: "70% center", lg: "62% center" }),
  },
} as const;
