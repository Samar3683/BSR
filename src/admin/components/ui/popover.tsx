"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";

import { buttonClass } from "./button";

/** A button that opens a small non-modal panel (closes on Escape or outside click). */
export function Popover({
  label,
  icon,
  title,
  children,
  size = "sm",
}: {
  label: ReactNode;
  icon?: ReactNode;
  /** Accessible name of the panel. */
  title: string;
  children: ReactNode;
  size?: "sm" | "md";
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  return (
    <div
      className="a-menu"
      ref={rootRef}
      onKeyDown={(event) => {
        if (open && event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          setOpen(false);
          buttonRef.current?.focus();
        }
      }}
    >
      <button
        ref={buttonRef}
        type="button"
        className={buttonClass({ size })}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={() => setOpen((value) => !value)}
      >
        {icon}
        {label}
      </button>
      {open ? (
        <div className="a-menu-list a-popover" id={panelId} role="dialog" aria-label={title}>
          {children}
        </div>
      ) : null}
    </div>
  );
}
