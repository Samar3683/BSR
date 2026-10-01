import type { ReactNode } from "react";

import { cx } from "@/lib/utils/cx";

import { Eyebrow } from "./eyebrow";

interface SectionHeaderProps {
  /** Heading id: point the section's `aria-labelledby` at it. */
  id: string;
  eyebrow: string;
  title: ReactNode;
  intro?: ReactNode;
  /** A single secondary action (text link); primary actions live in the section body. */
  action?: ReactNode;
  /**
   * `row` (default): headline and explanation side by side on large screens —
   * one compact band. `stacked`: one column (narrow columns, split sections).
   */
  layout?: "row" | "stacked";
  className?: string;
}

/**
 * Section opening: a green eyebrow, a strong headline (at most two lines) and
 * one sentence that explains it. Compact by design — every section is sized to
 * about one viewport, so the header states the message and gets out of the way.
 */
export function SectionHeader({
  id,
  eyebrow,
  title,
  intro,
  action,
  layout = "row",
  className,
}: SectionHeaderProps) {
  const row = layout === "row";
  return (
    <header
      data-reveal="rise"
      className={cx("flex flex-col gap-4", row && "lg:layout-grid lg:items-end", className)}
    >
      <Eyebrow className={cx(row && "lg:col-span-12")}>{eyebrow}</Eyebrow>
      <h2
        id={id}
        className={cx("max-w-[24ch] type-title text-balance", row && "lg:col-span-7")}
      >
        {title}
      </h2>
      {(intro || action) && (
        <div className={cx("flex flex-col gap-4", row && "lg:col-span-5 lg:pb-1")}>
          {intro && <p className="max-w-text type-lede text-text-secondary">{intro}</p>}
          {action && <div>{action}</div>}
        </div>
      )}
    </header>
  );
}
