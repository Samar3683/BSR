/**
 * Clients. A client appears only with `permission: true` — the relationship
 * AND the right to show its mark confirmed in writing by BSR (record where in
 * `source`). The list is empty: the official site shows six partner marks
 * whose relationships and permissions are unconfirmed (docs/content-audit.md),
 * so none is carried over. Until an approved entry exists the section shows
 * its logo grid as an empty, clearly-labelled frame ("Spazio logo") with the
 * policy stated beside it — never a placeholder company, a sample mark or a
 * generated brand. Adding an approved entry fills the next cell: no layout
 * change.
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
  id: "clienti",
  chapter: { index: "08", name: "Clienti", context: "Con il loro consenso" },
  label: "Clienti",
  title: "Aziende che scelgono BSR.",
  intro:
    "Imprese che devono spedire con tempi chiari e un contatto diretto: dalla produzione ai punti vendita, fino all'e-commerce.",
  /** Stated where marks would be: names appear only with written consent. */
  policy: "Pubblichiamo nomi e loghi dei clienti solo con il loro consenso scritto.",
  /** How many cells the grid shows (filled by approved entries first). */
  cells: 8,
  emptyCell: "Spazio logo",
  partnersLabel: "Alcuni clienti",
  partners: [] as ClientEntry[],
} as const;
