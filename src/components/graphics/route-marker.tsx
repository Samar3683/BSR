import { cx } from "@/lib/utils/cx";

interface RouteMarkerProps {
  /**
   * `origin` (default): a node in the route green — a stage on a path.
   * `destination`: a small diamond in BSR red — where a route arrives
   * (red is action and destination, never decoration).
   */
  variant?: "origin" | "destination";
  className?: string;
}

/**
 * The route motif's two marks. Never decorative on their own — always paired
 * with a line (a step's rule, a route) or a labelled point, so they read as
 * movement from origin to destination, not ornament.
 */
export function RouteMarker({ variant = "origin", className }: RouteMarkerProps) {
  return (
    <span
      aria-hidden="true"
      className={cx(
        "block",
        variant === "origin"
          ? "size-2.5 rounded-full bg-success-graphic"
          : "size-2.5 rotate-45 bg-action-primary",
        className,
      )}
    />
  );
}
