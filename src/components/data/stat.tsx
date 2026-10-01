import type { ReactNode } from "react";

import { cx } from "@/lib/utils/cx";

interface StatListProps {
  children: ReactNode;
  className?: string;
}

/** A row of figures (a description list: each label names its value). */
export function StatList({ children, className }: StatListProps) {
  return (
    <dl className={cx("grid gap-x-(--spacing-grid-gap) gap-y-10 md:grid-cols-3", className)}>
      {children}
    </dl>
  );
}

interface StatProps {
  value: string;
  /** Unit set smaller after the value (e.g. "min"). */
  unit?: string;
  label: string;
  detail?: string;
}

/**
 * One figure: a hairline, the value in the stat style (tabular, expanded),
 * its label and an optional one-line detail. Only confirmed figures belong
 * here; never an estimate presented as a fact.
 */
export function Stat({ value, unit, label, detail }: StatProps) {
  return (
    <div className="flex flex-col-reverse gap-3 border-t border-border-default pt-5">
      <dt className="flex flex-col gap-1">
        <span className="type-label-md text-text-primary">{label}</span>
        {detail && <span className="max-w-[28ch] type-body-sm text-text-secondary">{detail}</span>}
      </dt>
      <dd className="flex items-baseline gap-2">
        <span className="type-stat-lg">{value}</span>
        {unit && <span className="type-heading-sm text-text-secondary">{unit}</span>}
      </dd>
    </div>
  );
}
