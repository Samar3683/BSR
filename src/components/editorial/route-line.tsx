import type { CSSProperties } from "react";

import { cx } from "@/lib/utils/cx";

interface RouteLineProps {
  /** Labelled stops along the line, e.g. ["Ritiro", "In viaggio", "Consegna"]. */
  stops: readonly string[];
  className?: string;
  /** Delay before the line draws (ms). */
  delay?: number;
}

/**
 * A horizontal route: a hairline with a green line drawing over it from the
 * first stop to the last as it enters (once motion is allowed), green nodes
 * at the stops and a red diamond at the destination, each labelled in mono
 * capitals. Decorative — the words it shows are said in the text around it.
 */
export function RouteLine({ stops, className, delay = 0 }: RouteLineProps) {
  const last = stops.length - 1;
  return (
    <div
      aria-hidden="true"
      data-reveal="group"
      style={{ "--route-delay": `${delay}ms` } as CSSProperties}
      className={cx("relative", className)}
    >
      <div className="relative mx-1 h-3">
        <span className="absolute inset-x-0 top-1/2 h-px bg-hairline-strong" />
        <span className="absolute inset-x-0 top-1/2 h-px origin-left bg-success-graphic transition-[scale] delay-(--route-delay) duration-[1100ms] ease-cinematic pending:scale-x-0" />
        {stops.map((stop, i) => (
          <span
            key={stop}
            className={cx(
              "absolute top-1/2 size-2 -translate-x-1/2 -translate-y-1/2 transition-[scale] duration-300 ease-enter pending:scale-0",
              i === last ? "rotate-45 bg-action-primary" : "rounded-full bg-success-graphic",
            )}
            style={{
              left: `${(i / Math.max(last, 1)) * 100}%`,
              transitionDelay: `calc(var(--route-delay) + ${200 + i * 300}ms)`,
            }}
          />
        ))}
      </div>
      <div className="mt-2.5 flex justify-between ed-meta text-text-secondary">
        {stops.map((stop, i) => (
          <span key={stop} className={cx(i === last && "text-text-primary")}>
            {stop}
          </span>
        ))}
      </div>
    </div>
  );
}
