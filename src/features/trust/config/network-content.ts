import { sectors } from "@/config/site-content";

/**
 * Clients. A client appears only with `permission: true` — the relationship
 * AND the right to show its mark confirmed in writing by BSR (record where in
 * `source`). The list is empty: the official site shows six partner marks
 * whose relationships and permissions are unconfirmed (docs/content-audit.md),
 * so none is carried over. Until an approved entry exists the section shows
 * the sectors BSR serves — never a placeholder company or an empty grid.
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
  eyebrow: "Clienti",
  title: "Le aziende che serviamo.",
  intro:
    "Imprese che devono spedire con tempi chiari e un contatto diretto: dalla produzione ai punti vendita, fino all'e-commerce.",
  categoriesLabel: "Settori serviti",
  categories: Object.values(sectors),
  partnersLabel: "Alcuni clienti",
  partners: [] as ClientEntry[],
} as const;
