import type { ReactNode } from "react";

import { cx } from "@/lib/utils/cx";

interface LabelProps {
  children: ReactNode;
  /** A small mark before the label: a green state dot, or a red destination. */
  mark?: "green" | "red" | "none";
  /** Rendered element; a paragraph by default. */
  as?: "p" | "span" | "dt" | "h2" | "h3";
  id?: string;
  className?: string;
}

/**
 * The technical label — mono capitals, tracked, in the secondary text colour,
 * opened by a small green dot (state, route) or a red diamond (destination,
 * action). Used for chapter names, indices ("01 / 04"), metadata
 * ("CARPI · MODENA", "ITALIA → EUROPA") and figure captions.
 */
export function Label({ children, mark = "green", as: Element = "p", id, className }: LabelProps) {
  return (
    <Element id={id} className={cx("flex items-center gap-2.5 ed-label text-text-secondary", className)}>
      {mark !== "none" && (
        <span
          aria-hidden="true"
          className={cx(
            "size-1.5 shrink-0",
            mark === "green" ? "rounded-full bg-success-graphic" : "rotate-45 bg-action-primary",
          )}
        />
      )}
      {children}
    </Element>
  );
}
