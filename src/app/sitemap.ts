import type { MetadataRoute } from "next";

import { siteConfig } from "@/config/site";

/** sitemap.xml: the public pages (the developer previews are left out). */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: siteConfig.url, changeFrequency: "monthly", priority: 1 },
    { url: `${siteConfig.url}${siteConfig.routes.quoteRequest}`, changeFrequency: "yearly", priority: 0.8 },
    { url: `${siteConfig.url}${siteConfig.routes.privacy}`, changeFrequency: "yearly", priority: 0.2 },
  ];
}
