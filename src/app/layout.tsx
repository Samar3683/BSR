import type { Metadata, Viewport } from "next";

import { SkipLink } from "@/components/accessibility/skip-link";
import { siteConfig } from "@/config/site";
import { MAIN_CONTENT_ID } from "@/constants/landmarks";
import { AppProviders } from "@/providers/app-providers";
import { archivo, plexMono, saira } from "@/styles/fonts";

import "./globals.css";

/**
 * Site-wide metadata (Italian, from config/site.ts). Pages add their own
 * title, description and canonical; the Open Graph image is the file
 * convention app/opengraph-image.jpg. Developer previews set `noindex`.
 */
export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: {
    default: siteConfig.title,
    template: `%s — ${siteConfig.name}`,
  },
  description: siteConfig.description,
  applicationName: siteConfig.name,
  alternates: { canonical: "/" },
  robots: { index: true, follow: true },
  openGraph: {
    type: "website",
    locale: siteConfig.locale,
    siteName: siteConfig.name,
    url: "/",
    title: siteConfig.title,
    description: siteConfig.description,
  },
  twitter: {
    card: "summary_large_image",
    title: siteConfig.title,
    description: siteConfig.description,
  },
};

export const viewport: Viewport = {
  themeColor: siteConfig.themeColor,
  colorScheme: "dark",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang={siteConfig.lang} className={`${archivo.variable} ${saira.variable} ${plexMono.variable}`}>
      <body>
        <SkipLink targetId={MAIN_CONTENT_ID} label={siteConfig.labels.skipToContent} />
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
