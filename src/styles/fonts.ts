import { Archivo, IBM_Plex_Mono, Saira } from "next/font/google";

/**
 * Archivo (Omnibus-Type, SIL Open Font License). One variable family with
 * weight (100–900) and width (62–125) axes serves both expanded display type
 * and normal-width reading text. It stays the hero's face and the site's
 * reading face (body copy, forms).
 *
 * Below the hero the editorial system adds two voices (styles/editorial.css):
 * - Saira (Omnibus-Type, OFL), variable weight and width: the technical
 *   display face for headings, statements and figures, set in capitals;
 * - IBM Plex Mono (IBM, OFL), 400 and 500: technical labels, indices,
 *   metadata and the action buttons.
 * They are separate CSS variables, never the hero's `--font-display` or
 * `--font-mono`, so the locked hero renders exactly as before.
 *
 * next/font self-hosts the files at build time (no runtime request to Google)
 * and generates metric-adjusted fallbacks to avoid layout shift. The Latin
 * subset covers Italian and Western European languages.
 */
export const archivo = Archivo({
  subsets: ["latin"],
  axes: ["wdth"],
  display: "swap",
  variable: "--font-archivo",
});

export const saira = Saira({
  subsets: ["latin"],
  axes: ["wdth"],
  display: "swap",
  variable: "--font-saira",
  // Used only below the hero: never preloaded, so it never competes with the
  // hero's first frame (the mono face is preloaded: the header uses it).
  preload: false,
});

export const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
  variable: "--font-plex-mono",
});
