"use client";

import { useQuery } from "@tanstack/react-query";
import { Menu, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

import { MAIN_CONTENT_ID } from "@/constants/landmarks";

import { isNavActive, NAV_SECTIONS, type NavItem } from "../../config/navigation";
import { useAdminConfig } from "../../hooks/use-admin-config";
import { useI18n } from "../../i18n/provider";
import { fetchNavCounts } from "../../services/records";
import { Button } from "../ui/button";
import { AccountMenu } from "./account-menu";
import { CommandPalette } from "./command-palette";

const COLLAPSE_KEY = "bsr-admin:sidebar";

function readCollapsed(): boolean {
  try {
    const stored = window.localStorage.getItem(COLLAPSE_KEY);
    if (stored) return stored === "collapsed";
  } catch {
    // storage unavailable
  }
  return window.matchMedia("(max-width: 1024px)").matches;
}

export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { t } = useI18n();
  const { data: config } = useAdminConfig();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const counts = useQuery({
    queryKey: ["nav-counts"],
    queryFn: fetchNavCounts,
    refetchInterval: 60_000,
  });
  const badges: Record<
    string,
    { value: number; tone: "red" | "green"; label: string } | undefined
  > = {
    "/admin/orders": counts.data?.overdue
      ? { value: counts.data.overdue, tone: "red", label: `${counts.data.overdue} overdue` }
      : undefined,
    "/admin/dispatch": counts.data?.awaiting_dispatch
      ? {
          value: counts.data.awaiting_dispatch,
          tone: "green",
          label: `${counts.data.awaiting_dispatch} awaiting dispatch`,
        }
      : undefined,
  };

  const [navPath, setNavPath] = useState(pathname);
  if (navPath !== pathname) {
    // A navigation closes the mobile drawer.
    setNavPath(pathname);
    setMobileOpen(false);
  }

  useEffect(() => {
    // The persisted preference exists only in the browser: read it after hydration.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time client-only read
    setCollapsed(readCollapsed());
  }, []);

  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setMobileOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mobileOpen]);

  const toggleCollapsed = () => {
    setCollapsed((value) => {
      try {
        window.localStorage.setItem(COLLAPSE_KEY, value ? "expanded" : "collapsed");
      } catch {
        // storage unavailable
      }
      return !value;
    });
  };

  const labelFor = (item: NavItem) =>
    t(
      item.entity && config
        ? (config.entities[item.entity]?.plural_display_name ?? item.label)
        : item.label,
    );

  return (
    <div
      className="a-shell"
      data-sidebar={collapsed ? "collapsed" : "expanded"}
      data-mobile-nav={mobileOpen ? "open" : "closed"}
    >
      <aside className="a-sidebar" aria-label="Admin navigation" id="admin-sidebar">
        <Link href="/admin" className="a-brand" aria-label="BSR Trasporti admin, dashboard">
          {/* Same typeset wordmark as the public site (until the official logo exists). */}
          <span className="a-wordmark" aria-hidden="true">
            BSR
          </span>
          <span className="a-brand-text" aria-hidden="true">
            <span className="a-wordmark-tag">Trasporti</span>
            <span className="a-brand-tag">Admin</span>
          </span>
        </Link>
        <nav className="a-nav">
          {NAV_SECTIONS.map((section) => (
            <div key={section.label}>
              <div className="a-nav-section">{t(section.label)}</div>
              <ul>
                {section.items.map((item) => {
                  const active = isNavActive(item, pathname);
                  const label = labelFor(item);
                  const muted =
                    item.entity && config ? !config.entities[item.entity]?.active : false;
                  const Icon = item.icon;
                  const badge = badges[item.href];
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        className="a-nav-link"
                        aria-current={active ? "page" : undefined}
                        data-muted={muted || undefined}
                        title={collapsed ? label : undefined}
                      >
                        <Icon aria-hidden="true" />
                        <span className="a-nav-label">{label}</span>
                        {badge ? (
                          <span className="a-nav-badge" data-tone={badge.tone}>
                            <span aria-hidden="true">{badge.value}</span>
                            <span className="a-sr-only">, {badge.label}</span>
                          </span>
                        ) : null}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>
        <div className="a-sidebar-foot">
          <Button
            variant="ghost"
            size="sm"
            block
            className="a-collapse-toggle"
            onClick={toggleCollapsed}
            aria-expanded={!collapsed}
            aria-controls="admin-sidebar"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? (
              <PanelLeftOpen aria-hidden="true" />
            ) : (
              <PanelLeftClose aria-hidden="true" />
            )}
            <span className="a-sidebar-foot-label">{t("Collapse")}</span>
          </Button>
        </div>
      </aside>
      <div className="a-scrim" onClick={() => setMobileOpen(false)} aria-hidden="true" />

      <div className="a-main-col">
        <header className="a-topbar">
          <Button
            variant="ghost"
            icon
            className="a-menu-toggle"
            aria-label="Open navigation"
            aria-expanded={mobileOpen}
            aria-controls="admin-sidebar"
            onClick={() => setMobileOpen(true)}
          >
            <Menu aria-hidden="true" />
          </Button>
          <CommandPalette />
          <span className="a-topbar-spacer" />
          <AccountMenu />
        </header>
        <main id={MAIN_CONTENT_ID} className="a-main" tabIndex={-1}>
          {children}
        </main>
      </div>
    </div>
  );
}
