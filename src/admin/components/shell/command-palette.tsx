"use client";

import { useQuery } from "@tanstack/react-query";
import { CornerDownLeft, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useRef, useState } from "react";

import { useT } from "../../i18n/provider";
import { NAV_SECTIONS } from "../../config/navigation";
import { useAdminConfig } from "../../hooks/use-admin-config";
import type { EntityKey } from "../../lib/fields/types";
import { STATUS_LABELS } from "../../services/operations";
import { ENTITY_PATHS, globalSearch } from "../../services/records";

interface Result {
  id: string;
  group: string;
  title: string;
  subtitle?: string | null;
  href: string;
}

/** True when the keyboard is in a text field (single-key shortcuts stay off). */
function typing(target: EventTarget | null) {
  const el = target as HTMLElement | null;
  return Boolean(
    el && (el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName)),
  );
}

/**
 * Global search (Ctrl/⌘ + K or "/"): orders by number or customer,
 * customers, vehicles and drivers by name (and their searchable fields),
 * plus the panel's pages.
 */
export function CommandPalette() {
  const router = useRouter();
  const t = useT();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState("");
  const [debounced, setDebounced] = useState("");
  const [active, setActive] = useState(0);
  const { data: config } = useAdminConfig();

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.key === "k" || event.key === "K") && (event.ctrlKey || event.metaKey)) {
        event.preventDefault();
        setOpen(true);
      } else if (event.key === "/" && !typing(event.target) && !open) {
        event.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      inputRef.current?.focus();
    }
    if (!open && dialog.open) dialog.close();
  }, [open]);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(term.trim()), 180);
    return () => clearTimeout(timer);
  }, [term]);

  const hits = useQuery({
    queryKey: ["global-search", debounced],
    queryFn: () => globalSearch(debounced, 5),
    enabled: open && debounced.length >= 2,
    staleTime: 10_000,
  });

  const results = useMemo<Result[]>(() => {
    const q = term.trim().toLowerCase();
    const pages: Result[] = NAV_SECTIONS.flatMap((s) => s.items)
      .map((item) => ({
        id: `page:${item.href}`,
        group: t("Pages"),
        title: t(
          item.entity && config
            ? (config.entities[item.entity]?.plural_display_name ?? item.label)
            : item.label,
        ),
        href: item.href,
      }))
      .filter((page) => !q || page.title.toLowerCase().includes(q));
    const groupName = (entity: EntityKey) =>
      config?.entities[entity]?.plural_display_name ?? entity;
    const records: Result[] = (debounced.length >= 2 ? (hits.data ?? []) : []).map((hit) => ({
      id: `${hit.entity}:${hit.id}`,
      group: groupName(hit.entity),
      title: hit.title,
      subtitle: [
        hit.subtitle,
        hit.status ? t(STATUS_LABELS[hit.status]) : null,
        hit.archived ? "archived" : null,
      ]
        .filter(Boolean)
        .join(" · "),
      href: `${ENTITY_PATHS[hit.entity]}/${hit.id}`,
    }));
    const profile: Result = {
      id: "page:/admin/profile",
      group: t("Pages"),
      title: t("Profile and security"),
      href: "/admin/profile",
    };
    if (!q || profile.title.toLowerCase().includes(q)) pages.push(profile);
    return [...records, ...(q ? pages : pages.slice(0, 6))];
  }, [term, debounced, hits.data, config, t]);

  const close = () => {
    setOpen(false);
    setTerm("");
    setActive(0);
  };
  const go = (result: Result | undefined) => {
    if (!result) return;
    close();
    router.push(result.href);
  };

  return (
    <>
      <button
        type="button"
        className="a-search-trigger"
        onClick={() => setOpen(true)}
        aria-keyshortcuts="Control+K /"
      >
        <Search aria-hidden="true" />
        <span className="a-search-trigger-label">{t("Search orders, customers, vehicles…")}</span>
        <kbd className="a-kbd">Ctrl K</kbd>
      </button>
      <dialog
        ref={dialogRef}
        className="a-dialog a-palette"
        aria-label="Search"
        onCancel={(event) => {
          event.preventDefault();
          close();
        }}
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) close();
        }}
      >
        {open ? (
          <div className="a-palette-body">
            <div className="a-palette-input">
              <Search aria-hidden="true" />
              <input
                ref={inputRef}
                role="combobox"
                aria-expanded="true"
                aria-controls={listId}
                aria-autocomplete="list"
                aria-activedescendant={results[active] ? `${listId}-${active}` : undefined}
                placeholder={t("Search by order number, customer, plate, driver or page…")}
                value={term}
                onChange={(e) => {
                  setTerm(e.target.value);
                  setActive(0);
                }}
                onKeyDown={(e) => {
                  if (e.key === "ArrowDown") {
                    e.preventDefault();
                    setActive((i) => Math.min(i + 1, results.length - 1));
                  } else if (e.key === "ArrowUp") {
                    e.preventDefault();
                    setActive((i) => Math.max(i - 1, 0));
                  } else if (e.key === "Enter") {
                    e.preventDefault();
                    go(results[active]);
                  }
                }}
              />
            </div>
            <ul className="a-palette-list" id={listId} role="listbox" aria-label="Results">
              {results.map((result, index) => {
                const heading =
                  index === 0 || results[index - 1]?.group !== result.group ? result.group : null;
                return (
                  <li key={result.id} role="presentation">
                    {heading ? (
                      <div className="a-palette-group" role="presentation">
                        {heading}
                      </div>
                    ) : null}
                    <div
                      id={`${listId}-${index}`}
                      role="option"
                      aria-selected={index === active}
                      className="a-palette-item"
                      onMouseEnter={() => setActive(index)}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        go(result);
                      }}
                    >
                      <span className="a-palette-title">{result.title}</span>
                      {result.subtitle ? <span className="a-help">{result.subtitle}</span> : null}
                      {index === active ? (
                        <CornerDownLeft className="a-palette-enter" aria-hidden="true" />
                      ) : null}
                    </div>
                  </li>
                );
              })}
              {debounced.length >= 2 && hits.isFetching && !hits.data ? (
                <li className="a-combo-empty" role="presentation">
                  Searching…
                </li>
              ) : null}
              {debounced.length >= 2 && hits.data && results.length === 0 ? (
                <li className="a-combo-empty" role="presentation">
                  Nothing matches “{debounced}”.
                </li>
              ) : null}
            </ul>
            <p className="a-palette-foot a-help">
              {t("↑ ↓ to move · Enter to open · Esc to close")}
            </p>
          </div>
        ) : null}
      </dialog>
    </>
  );
}
