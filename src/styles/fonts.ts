import { Archivo } from "next/font/google";

/**
 * Archivo (Omnibus-Type, SIL Open Font License). One variable family with
 * weight (100–900) and width (62–125) axes serves both expanded display type
 * and normal-width reading text, so the site loads a single font file.
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
