"use client";

import { LogOut, Menu, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

import { MAIN_CONTENT_ID } from "@/constants/landmarks";

import { isNavActive, NAV_SECTIONS } from "../../config/navigation";
import { useAdminConfig } from "../../hooks/use-admin-config";
import { Button } from "../ui/button";
import { useSession } from "./session";

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

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { admin, signOut } = useSession();
  const { data: config } = useAdminConfig();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

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

  const items = NAV_SECTIONS.flatMap((section) => section.items);
  const current = items.find((item) => isNavActive(item, pathname));
  const labelFor = (item: (typeof items)[number]) =>
    item.entity && config
      ? (config.entities[item.entity]?.plural_display_name ?? item.label)
      : item.label;

  return (
    <div
      className="a-shell"
      data-sidebar={collapsed ? "collapsed" : "expanded"}
      data-mobile-nav={mobileOpen ? "open" : "closed"}
    >
      <aside className="a-sidebar" aria-label="Admin navigation" id="admin-sidebar">
        <Link href="/admin" className="a-brand">
          <span className="a-brand-mark" aria-hidden="true">
            BSR
          </span>
          <span className="a-brand-text">
            <span className="a-brand-name">BSR Trasporti</span>
            <br />
            <span className="a-brand-tag">Admin</span>
          </span>
        </Link>
        <nav className="a-nav">
          {NAV_SECTIONS.map((section) => (
            <div key={section.label}>
              <div className="a-nav-section">{section.label}</div>
              <ul>
                {section.items.map((item) => {
                  const active = isNavActive(item, pathname);
                  const label = labelFor(item);
                  const muted =
                    item.entity && config ? !config.entities[item.entity]?.active : false;
                  const Icon = item.icon;
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
            <span className="a-sidebar-foot-label">Collapse</span>
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
          <span className="a-topbar-title">{current ? labelFor(current) : "BSR Admin"}</span>
          <span className="a-topbar-spacer" />
          <div className="a-user">
            <span className="a-avatar" aria-hidden="true">
              {initials(admin.display_name)}
            </span>
            <span className="a-user-name" title={admin.email ?? undefined}>
              {admin.display_name}
            </span>
            <Button
              variant="ghost"
              size="sm"
              loading={signingOut}
              onClick={async () => {
                setSigningOut(true);
                await signOut();
              }}
            >
              <LogOut aria-hidden="true" />
              Sign out
            </Button>
          </div>
        </header>
        <main id={MAIN_CONTENT_ID} className="a-main" tabIndex={-1}>
          {children}
        </main>
      </div>
    </div>
  );
}
