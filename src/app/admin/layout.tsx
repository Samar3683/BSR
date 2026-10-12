import type { Metadata, Viewport } from "next";
import { cookies, headers } from "next/headers";

import { AdminProviders } from "@/admin/components/providers";
import { LANG_COOKIE, type Lang } from "@/admin/i18n/lang";
import { parseTheme, THEME_COOKIE } from "@/admin/theme/constants";

import "@/admin/styles/admin.css";

/**
 * The admin area: a separate product inside the same app. Its styles,
 * providers and data layer load only on /admin routes; nothing here is
 * imported by the public site. Pages are never indexed.
 */
export const metadata: Metadata = {
  title: { default: "BSR Admin", template: "%s · BSR Admin" },
  robots: { index: false, follow: false, nocache: true },
  alternates: { canonical: null },
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
  colorScheme: "light dark",
};

/** The saved choice wins; otherwise the browser's language (Italian or English). */
async function resolveLang(): Promise<Lang> {
  const saved = (await cookies()).get(LANG_COOKIE)?.value;
  if (saved === "it" || saved === "en") return saved;
  const accept = (await headers()).get("accept-language") ?? "";
  return /^\s*it(?![a-z])/i.test(accept) ? "it" : "en";
}

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const lang = await resolveLang();
  const theme = parseTheme((await cookies()).get(THEME_COOKIE)?.value);
  return (
    // data-lenis-prevent: the public smooth-scroll stays out of the admin's own scroll areas.
    <div className="adm" data-lenis-prevent="" lang={lang} data-theme={theme}>
      <AdminProviders lang={lang} theme={theme}>
        {children}
      </AdminProviders>
    </div>
  );
}
