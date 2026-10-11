import type { Metadata, Viewport } from "next";

import { AdminProviders } from "@/admin/components/providers";

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
  themeColor: "#f7f7f2",
  colorScheme: "light",
};

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    // data-lenis-prevent: the public smooth-scroll stays out of the admin's own scroll areas.
    <div className="adm" data-lenis-prevent="">
      <AdminProviders>{children}</AdminProviders>
    </div>
  );
}
