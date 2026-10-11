"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/admin/settings/fields", label: "Fields" },
  { href: "/admin/settings/entities", label: "Entities" },
  { href: "/admin/settings/administrators", label: "Administrators" },
];

export function SettingsTabs() {
  const pathname = usePathname();
  return (
    <nav className="a-tabs" aria-label="Settings sections">
      {TABS.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          className="a-tab"
          aria-current={pathname === tab.href ? "page" : undefined}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
