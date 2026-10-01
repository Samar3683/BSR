import type { MetadataRoute } from "next";

import { siteConfig } from "@/config/site";

/** robots.txt: the public site is indexable; the developer previews are not. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: "/dev/" },
    sitemap: `${siteConfig.url}/sitemap.xml`,
  };
}
