import { siteConfig } from "@/config/site";
import { company, contact, coverage } from "@/config/site-content";

/**
 * The organisation as structured data (schema.org), from verified facts only
 * (config/site-content.ts, docs/content-audit.md): names, address, phone,
 * email, VAT number, the areas served. Never opening hours, ratings, reviews
 * or a price range — BSR has not supplied them.
 */
export function organizationJsonLd() {
  const { address } = company;
  return {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    "@id": `${siteConfig.url}/#organization`,
    name: company.brand,
    legalName: company.legalName,
    description: siteConfig.description,
    url: siteConfig.url,
    image: `${siteConfig.url}/opengraph-image.jpg`,
    telephone: contact.phoneE164,
    email: contact.email,
    vatID: `${address.countryCode}${company.vatNumber}`,
    address: {
      "@type": "PostalAddress",
      streetAddress: address.streetFull,
      postalCode: address.postalCode,
      addressLocality: address.locality,
      addressRegion: address.province,
      addressCountry: address.countryCode,
    },
    areaServed: [
      { "@type": "Country", name: "Italia" },
      ...coverage.europe.map((route) => ({ "@type": "Country", name: route.country })),
    ],
  };
}

/** The payload for a `<script type="application/ld+json">` (`<` escaped, per the Next.js guide). */
export const jsonLdScript = (data: object) => JSON.stringify(data).replace(/</g, "\\u003c");
