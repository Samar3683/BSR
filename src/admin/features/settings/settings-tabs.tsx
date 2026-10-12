"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { useT } from "../../i18n/provider";

const TABS = [
  { href: "/admin/settings/fields", label: "Fields" },
  { href: "/admin/settings/entities", label: "Entities" },
  { href: "/admin/settings/dispatch-rules", label: "Dispatch rules" },
  { href: "/admin/settings/administrators", label: "Administrators" },
];

export function SettingsTabs() {
  const pathname = usePathname();
  const t = useT();
  return (
    <nav className="a-tabs" aria-label="Settings sections">
      {TABS.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          className="a-tab"
          aria-current={pathname === tab.href ? "page" : undefined}
        >
          {t(tab.label)}
        </Link>
      ))}
    </nav>
  );
}
