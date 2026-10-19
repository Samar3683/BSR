/**
 * Collaborators. A collaborator appears only with `permission: true` — the
 * relationship AND the right to show its mark confirmed by BSR (record where in
 * `source`). The six marks below were supplied by BSR for this section. Adding
 * an approved entry fills the next cell: no layout change.
 */
export interface ClientEntry {
  name: string;
  /** Logo file under /public (monochrome-friendly SVG preferred). */
  logo: string;
  /** Intrinsic logo size, for layout without shift. */
  width: number;
  height: number;
  /** The client's site, only if they approved the link. */
  website?: string;
  /** Written permission to show the name and mark. */
  permission: boolean;
  /** Where the permission is recorded (e.g. "email del 12/03/2027"). */
  source?: string;
}

/** Only approved entries ever render. */
export const approvedClients = (entries: readonly ClientEntry[]) =>
  entries.filter((entry) => entry.permission === true);

export const networkContent = {
  id: "collaboratori",
  /** The act's mark (ACT 08 — Fiducia: collaborators and reviews). */
  chapter: { index: "08", name: "Fiducia · Collaboratori", context: "Con il loro consenso" },
  label: "Collaboratori",
  title: "Aziende che collaborano con BSR.",
  titleLines: ["Aziende che", "collaborano con BSR."] as const,
  intro:
    "Imprese e operatori con cui lavoriamo ogni giorno: dal trasporto alla logistica, fino all'e-commerce.",
  /** Stated where marks appear: names are shown with consent. */
  policy: "Pubblichiamo nomi e loghi dei collaboratori solo con il loro consenso.",
  /** How many cells the grid shows (filled by approved entries first). */
  cells: 8,
  emptyCell: "Spazio logo",
  partnersLabel: "Alcuni collaboratori",
  partners: [
    {
      name: "Transcoop",
      logo: "/assets/images/content/logos/collab-1.webp",
      width: 414,
      height: 120,
    },
    {
      name: "Transmec Group",
      logo: "/assets/images/content/logos/collab-2.webp",
      width: 438,
      height: 120,
    },
    {
      name: "One Express",
      logo: "/assets/images/content/logos/collab-3.webp",
      width: 347,
      height: 120,
    },
    { name: "LogiCo", logo: "/assets/images/content/logos/collab-4.webp", width: 374, height: 120 },
    {
      name: "Done Deliveries",
      logo: "/assets/images/content/logos/collab-5.webp",
      width: 235,
      height: 120,
    },
    {
      name: "Expedia",
      logo: "/assets/images/content/logos/collab-6.webp",
      width: 504,
      height: 120,
    },
  ].map((entry) => ({
    ...entry,
    permission: true,
    source: "Loghi forniti da BSR",
  })) as ClientEntry[],
} as const;
