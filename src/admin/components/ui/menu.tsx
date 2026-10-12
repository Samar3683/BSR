"use client";

import { ChevronDown } from "lucide-react";
import Link from "next/link";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";

import { buttonClass, type ButtonVariant } from "./button";

export interface MenuItem {
  label: string;
  icon?: ReactNode;
  onSelect?: () => void;
  href?: string;
  tone?: "danger";
  disabled?: boolean;
  /** Why the item is disabled (shown as its description). */
  hint?: string;
}

/**
 * A button that opens a list of actions (WAI-ARIA menu button pattern):
 * arrow keys move between items, Escape closes and returns focus.
 */
export function MenuButton({
  label,
  icon,
  items,
  variant,
  size,
  align = "end",
}: {
  label: ReactNode;
  icon?: ReactNode;
  items: MenuItem[];
  variant?: ButtonVariant;
  size?: "md" | "sm";
  align?: "start" | "end";
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();
  const visible = items.filter(Boolean);

  const focusItem = (index: number) => {
    const nodes = rootRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not([aria-disabled="true"])');
    if (!nodes?.length) return;
    nodes[(index + nodes.length) % nodes.length]?.focus();
  };

  useEffect(() => {
    if (!open) return;
    rootRef.current?.querySelector<HTMLElement>('[role="menuitem"]:not([aria-disabled="true"])')?.focus();
    const onDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const close = (refocus = true) => {
    setOpen(false);
    if (refocus) buttonRef.current?.focus();
  };

  return (
    <div
      className="a-menu"
      ref={rootRef}
      onKeyDown={(event) => {
        if (!open) return;
        const nodes = Array.from(
          rootRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not([aria-disabled="true"])') ?? [],
        );
        const index = nodes.indexOf(document.activeElement as HTMLElement);
        if (event.key === "ArrowDown") {
          event.preventDefault();
          focusItem(index + 1);
        } else if (event.key === "ArrowUp") {
          event.preventDefault();
          focusItem(index - 1);
        } else if (event.key === "Home") {
          event.preventDefault();
          focusItem(0);
        } else if (event.key === "End") {
          event.preventDefault();
          focusItem(nodes.length - 1);
        } else if (event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          close();
        } else if (event.key === "Tab") {
          close(false);
        }
      }}
    >
      <button
        ref={buttonRef}
        type="button"
        className={buttonClass({ variant, size })}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((value) => !value)}
      >
        {icon}
        {label}
        <ChevronDown aria-hidden="true" />
      </button>
      {open ? (
        <ul className="a-menu-list" role="menu" id={menuId} data-align={align}>
          {visible.map((item) => (
            <li key={item.label} role="none">
              {item.href && !item.disabled ? (
                <Link
                  role="menuitem"
                  tabIndex={-1}
                  href={item.href}
                  className="a-menu-item"
                  data-tone={item.tone}
                  onClick={() => close(false)}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </Link>
              ) : (
                <button
                  type="button"
                  role="menuitem"
                  tabIndex={-1}
                  className="a-menu-item"
                  data-tone={item.tone}
                  aria-disabled={item.disabled || undefined}
                  onClick={() => {
                    if (item.disabled) return;
                    close(false);
                    item.onSelect?.();
                  }}
                >
                  {item.icon}
                  <span className="a-menu-text">
                    {item.label}
                    {item.hint ? <span className="a-help">{item.hint}</span> : null}
                  </span>
                </button>
              )}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
