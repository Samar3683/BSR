import type { SlotMedia } from "@/types/media";

import { scene } from "./media";

/**
 * Every photograph on the public site, by section — the one place to swap the
 * supplied (generated) package for real BSR photography, or later a video
 * (SlotMedia `kind: "video"`): same keys, no layout change.
 *
 * Rules (site-media.test.ts):
 * - each photograph appears once on the page — no image repeats between
 *   sections (the package has 11 in the live livery; this plan places all 11);
 * - alt text says what the picture shows, never who: the pictures are
 *   illustrative, no person pictured is a named BSR contact;
 * - focal points per breakpoint keep the subject (cab, cargo, person) in
 *   frame from a portrait phone to a wide desktop.
 *
 * Slots waiting for real photography are `undefined` (the layout holds
 * without them): the sectors' own pictures, and the future shots listed in
 * docs/design-system.md ("Media").
 */
export const siteMedia = {
  services: {
    express: scene("express-motorway", "Autoarticolato BSR in viaggio su un'autostrada all'alba.", {
      base: "72% center",
      lg: "62% center",
    }),
    dedicated: scene(
      "dedicated-dock",
      "Camion BSR a una baia di carico illuminata, con un carrello elevatore al lavoro nel magazzino.",
      { base: "62% center", lg: "55% center" },
    ),
  },
  sectors: {
    /** The shared stage while the sectors have no pictures of their own. */
    stage: scene(
      "wrapped-pallet",
      "Bancale di scatole avvolto nel film estensibile, pronto per la spedizione.",
      { base: "40% center", lg: "45% 60%" },
    ),
    industria: undefined as SlotMedia | undefined,
    retail: undefined as SlotMedia | undefined,
    "e-commerce": undefined as SlotMedia | undefined,
    "aziende-commerciali": undefined as SlotMedia | undefined,
  },
  process: {
    main: scene(
      "forklift-loading",
      "Carrello elevatore che carica un bancale su un semirimorchio BSR, sulla banchina al tramonto.",
      { base: "50% center", lg: "50% 58%" },
    ),
  },
  fleet: {
    van: scene("van", "Furgone bianco con livrea BSR davanti a un magazzino logistico.", {
      base: "55% center",
    }),
    rigid: scene("rigid-truck", "Motrice con cassone telonato e livrea BSR in un piazzale logistico.", {
      base: "60% center",
    }),
    articulated: scene(
      "articulated-truck",
      "Trattore con semirimorchio telonato e livrea BSR in un piazzale logistico.",
      { base: "58% center" },
    ),
  },
  coverage: {
    /** Background layer behind the map (decorative). */
    background: scene("coverage-aerial", "", "center 70%"),
  },
  security: {
    main: scene(
      "secured-cargo",
      "Bancali avvolti nel film e fissati con cinghie all'interno di un semirimorchio.",
      { base: "50% center", lg: "45% center" },
    ),
  },
  about: {
    portrait: scene(
      "direct-contact",
      "Un operatore al telefono accanto a un camion BSR, nel piazzale di carico.",
      { base: "78% center", lg: "72% center" },
    ),
  },
  finalCta: {
    /** Background (decorative): a departure at dawn. */
    background: scene("truck-departure", "", { base: "72% center", lg: "62% center" }),
  },
} as const;
