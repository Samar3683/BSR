"use client";

import { Check, ChevronDown, LogOut, Monitor, Moon, Sun, UserRound } from "lucide-react";
import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";

import { useI18n } from "../../i18n/provider";
import type { Lang } from "../../i18n/lang";
import type { ThemePreference } from "../../theme/constants";
import { useTheme } from "../../theme/theme-provider";
import { useSession } from "./session";

const THEMES: { value: ThemePreference; label: string; icon: typeof Sun }[] = [
  { value: "system", label: "System", icon: Monitor },
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
];

const LANGUAGES: { value: Lang; label: string }[] = [
  { value: "it", label: "Italiano" },
  { value: "en", label: "English" },
];

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

/**
 * The signed-in administrator in the header: name and role, with a panel for
 * profile, appearance, language and sign out.
 */
export function AccountMenu() {
  const { admin, signOut } = useSession();
  const { t, lang, setLang } = useI18n();
  const { theme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="a-account" ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        className="a-account-trigger"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        aria-haspopup="true"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="a-avatar" aria-hidden="true">
          {initials(admin.display_name)}
        </span>
        <span className="a-account-meta">
          <span className="a-account-name">{admin.display_name}</span>
          <span className="a-account-role">
            {admin.role === "admin" ? t("Administrator") : admin.role}
          </span>
        </span>
        <ChevronDown aria-hidden="true" className="a-account-caret" />
        <span className="a-sr-only">{t("Account menu")}</span>
      </button>

      {open ? (
        <div className="a-account-panel" id={panelId} role="group" aria-label={t("Account menu")}>
          <div className="a-account-card">
            <span className="a-avatar a-avatar--lg" aria-hidden="true">
              {initials(admin.display_name)}
            </span>
            <div>
              <strong>{admin.display_name}</strong>
              <div className="a-small a-muted">{admin.email}</div>
            </div>
          </div>

          <Link href="/admin/profile" className="a-account-item" onClick={() => setOpen(false)}>
            <UserRound aria-hidden="true" />
            {t("Profile and security")}
          </Link>

          <div className="a-account-group" role="group" aria-label={t("Color theme")}>
            <div className="a-account-label">{t("Appearance")}</div>
            <div className="a-account-choices">
              {THEMES.map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={theme === value}
                  onClick={() => setTheme(value)}
                >
                  <Icon aria-hidden="true" />
                  {t(label)}
                </button>
              ))}
            </div>
          </div>

          <div className="a-account-group" role="group" aria-label={t("Language")}>
            <div className="a-account-label">{t("Language")}</div>
            <div className="a-account-list">
              {LANGUAGES.map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  className="a-account-item"
                  aria-pressed={lang === value}
                  onClick={() => setLang(value)}
                >
                  {label}
                  {lang === value ? <Check aria-hidden="true" className="a-account-check" /> : null}
                </button>
              ))}
            </div>
          </div>

          <button
            type="button"
            className="a-account-item a-account-signout"
            disabled={signingOut}
            onClick={async () => {
              setSigningOut(true);
              await signOut();
            }}
          >
            <LogOut aria-hidden="true" />
            {t("Sign out")}
          </button>
        </div>
      ) : null}
    </div>
  );
}
