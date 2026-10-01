import type { ReactNode } from "react";

import { RouteMarker } from "@/components/graphics/route-marker";
import { Divider } from "@/components/layout/divider";
import { cx } from "@/lib/utils/cx";

export interface ProofPoint {
  headline: string;
  detail?: ReactNode;
  /** The one point a block stands on: a red rule and the destination mark. Use once, if at all. */
  emphasis?: boolean;
}

interface ProofListProps {
  items: readonly ProofPoint[];
  /** `stack` (default): one column, hairlines between. `row`: side by side from `sm`, each on its own rule. */
  layout?: "stack" | "row";
  className?: string;
}

/**
 * A short list of claims, each a headline and an optional one-line detail,
 * separated by hairlines — disciplined typography standing in for icon
 * chips or stat cards. Used wherever a block backs up a claim with a few
 * confirmed points (services, coverage), never estimates presented as fact.
 */
export function ProofList({ items, layout = "stack", className }: ProofListProps) {
  const row = layout === "row";
  return (
    <dl
      className={cx(
        row
          ? cx(
              "grid gap-x-(--spacing-grid-gap) gap-y-6",
              items.length === 2 ? "sm:grid-cols-2" : "sm:grid-cols-3",
            )
          : "flex flex-col gap-5",
        className,
      )}
    >
      {items.map((item, i) => (
        <div key={item.headline} className="flex flex-col gap-2">
          {(row || i > 0) && (
            <Divider
              tone={item.emphasis ? "accent" : "default"}
              draw={row}
              className={row ? "mb-2" : "mb-3"}
            />
          )}
          <dt className="flex items-center gap-2.5 type-heading-sm">
            {item.emphasis && <RouteMarker variant="destination" className="size-2" />}
            {item.headline}
          </dt>
          {item.detail && <dd className="type-body-sm text-text-secondary">{item.detail}</dd>}
        </div>
      ))}
    </dl>
  );
}
