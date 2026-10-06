import type { SurfaceTone } from "./surface";

const COLOUR: Record<SurfaceTone, string> = {
  carbon: "var(--color-carbon)",
  graphite: "var(--color-graphite)",
  asphalt: "var(--color-asphalt)",
  white: "var(--color-white)",
  "soft-white": "var(--color-soft-white)",
  "warm-white": "var(--color-warm-white)",
  green: "var(--color-green-700)",
};

/**
 * The seam between two sections of very different weight — a slow colour wash
 * from one surface to the next (so the page never restarts on a hard edge),
 * placed by the page between the two. Decorative (`aria-hidden`), flat colour
 * only: the one place the site uses a gradient besides photographic scrims.
 */
export function SectionBridge({
  from,
  to,
  size = "md",
}: {
  from: SurfaceTone;
  to: SurfaceTone;
  size?: "sm" | "md" | "lg";
}) {
  return (
    <div
      aria-hidden="true"
      className={
        size === "lg"
          ? "h-[clamp(6rem,20vh,14rem)]"
          : size === "sm"
            ? "h-[clamp(2rem,6vh,4rem)]"
            : "h-[clamp(4rem,12vh,9rem)]"
      }
      style={{ backgroundImage: `linear-gradient(to bottom, ${COLOUR[from]}, ${COLOUR[to]})` }}
    />
  );
}
