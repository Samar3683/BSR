/**
 * The film below the hero: one shipment, twelve acts, in page order. The
 * spine of the story — where the shipment is now — and the structure the
 * journey indicator, the act labels and the scenes read. Words come from the
 * sections' own content files (each restates docs/content-audit.md); this file
 * holds no business claims.
 *
 * - `sections`: the page sections that make the act (anchors stay the
 *   navigation's: "#servizi", "#flotta", …).
 * - `tone`: the act's light — light (White / Soft White), dark (Carbon, a
 *   photograph) or green (the BSR atmosphere) — for overlays such as the
 *   journey indicator.
 * - `track`: a pinned act's scroll length (desktop, phone), in viewport
 *   heights; acts without one scroll normally.
 * - `route`: the shipment's state in the act (origin → in transit →
 *   destination), shown on the indicator.
 * - `media`: the act's media slots (src/config/site-media.ts and the
 *   cut-outs) — see docs/cinematic-media-manifest.md for the ideal assets.
 */
export type ActTone = "light" | "dark" | "green";
export type RouteState = "origin" | "loading" | "transit" | "network" | "destination";

export interface Act {
  act: string;
  /** Short name for the indicator and the act label. */
  name: string;
  sections: readonly string[];
  tone: ActTone;
  route: RouteState;
  track?: { desktop: number; phone: number };
  media: readonly string[];
}

export const ACTS = [
  {
    act: "01",
    name: "Origine",
    sections: ["bsr"],
    tone: "light",
    route: "origin",
    media: ["truck-side"],
  },
  {
    act: "02",
    name: "Il carico",
    sections: ["settori"],
    tone: "light",
    route: "origin",
    track: { desktop: 3.4, phone: 3 },
    media: ["sectors.stage"],
  },
  {
    act: "03",
    name: "Il servizio",
    sections: ["servizi"],
    tone: "light",
    route: "origin",
    track: { desktop: 3, phone: 0 },
    media: ["truck-front34", "services.express", "services.dedicated"],
  },
  {
    act: "04",
    name: "Preparazione",
    sections: ["come-funziona"],
    tone: "dark",
    route: "loading",
    track: { desktop: 3.8, phone: 3.4 },
    media: ["process.main"],
  },
  {
    act: "05",
    name: "Sicurezza",
    sections: ["sicurezza"],
    tone: "green",
    route: "loading",
    media: ["security.main"],
  },
  {
    act: "06",
    name: "Partenza",
    sections: ["flotta"],
    tone: "light",
    route: "transit",
    track: { desktop: 4.6, phone: 4 },
    media: ["fleet.van", "fleet.rigid", "fleet.articulated", "truck-side"],
  },
  {
    act: "07",
    name: "La rete",
    sections: ["copertura"],
    tone: "dark",
    route: "network",
    track: { desktop: 3.8, phone: 3.4 },
    media: ["coverage.background", "map"],
  },
  {
    act: "08",
    name: "Fiducia",
    sections: ["clienti", "recensioni"],
    tone: "light",
    route: "network",
    media: [],
  },
  {
    act: "09",
    name: "Le persone",
    sections: ["chi-siamo"],
    tone: "light",
    route: "network",
    media: ["about.portrait"],
  },
  {
    act: "10",
    name: "Richiesta",
    sections: ["richiesta"],
    tone: "light",
    route: "destination",
    media: [],
  },
  { act: "11", name: "Domande", sections: ["faq"], tone: "light", route: "destination", media: [] },
  {
    act: "12",
    name: "Arrivo",
    sections: ["preventivo"],
    tone: "dark",
    route: "destination",
    track: { desktop: 2, phone: 1.8 },
    media: ["finalCta.background"],
  },
] as const satisfies readonly Act[];

export type ActNumber = (typeof ACTS)[number]["act"];

/** The act a section belongs to. */
export function actOf(section: string): Act {
  const act = ACTS.find((entry) => (entry.sections as readonly string[]).includes(section));
  if (!act) throw new Error(`No act holds the section "${section}".`);
  return act;
}

/** A pinned act's track lengths as CSS variables (`--track`, `--track-phone`). */
export function trackStyle(act: Act) {
  return act.track
    ? ({
        "--track": `${act.track.desktop * 100}svh`,
        "--track-phone": `${(act.track.phone || 1) * 100}svh`,
      } as Record<string, string>)
    : undefined;
}
