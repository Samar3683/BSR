import { cx } from "@/lib/utils/cx";

import { RouteMarker } from "./route-marker";

interface ThreadProps {
  /** How the thread ends: on a green stage node, or on the red destination. */
  end?: "origin" | "destination";
  className?: string;
}

/**
 * A vertical route line in the route colour, fading in from above and ending
 * on a marker — the route arriving somewhere. Draws itself downwards on entry
 * (`rule-draw-down`). Size and place it with `className` (it fills its box);
 * decorative.
 */
export function Thread({ end = "origin", className }: ThreadProps) {
  return (
    <span aria-hidden="true" className={cx("pointer-events-none block", className)}>
      <span className="absolute inset-y-0 left-0 w-px rule-draw-down bg-linear-to-b from-transparent to-success-graphic" />
      <RouteMarker
        variant={end}
        className="absolute bottom-0 left-0 translate-x-[calc(-50%+0.5px)] translate-y-1/2"
      />
    </span>
  );
}
