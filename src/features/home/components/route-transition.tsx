import { RouteMarker } from "@/components/graphics/route-marker";

import { homeContent } from "../config/home-content";

/**
 * The transition out of the hero — the start of the page's route motif,
 * placed by the page right after the hero. It depends on nothing inside the
 * hero (docs/hero-baseline.md, replacement contract):
 *
 * - above it, a fade paints over the hero's last band into Carbon, so the
 *   stage closes on a clean edge whatever its final frame holds;
 * - then a short Carbon band (≈ 11vh): the route line draws from the green
 *   origin (Ritiro) across to the red destination (Destinazione) — the hero's
 *   last line, "Dal ritiro alla destinazione.", made graphic;
 * - then a controlled diagonal cut into Soft White (the page's main surface),
 *   like the livery's cuts.
 *
 * Decorative (the hero states the same words); no layout depends on motion.
 */
export function RouteTransition() {
  const { origin, destination } = homeContent.transition;
  return (
    <div
      aria-hidden="true"
      data-surface="carbon"
      className="pointer-events-none relative z-(--z-content) bg-background-primary"
    >
      <div className="absolute inset-x-0 bottom-full h-24 bg-linear-to-b from-transparent via-background-primary/60 to-background-primary sm:h-48" />
      <div className="container-content flex h-[clamp(4.5rem,11vh,7rem)] items-center gap-4 sm:gap-6">
        <span className="flex shrink-0 items-center gap-3 type-label-sm text-text-secondary">
          <RouteMarker />
          {origin}
        </span>
        <span className="relative h-0.5 flex-1 bg-border-default">
          <span className="absolute inset-0 rule-draw bg-success-graphic" />
        </span>
        <span className="flex shrink-0 items-center gap-3 type-label-sm text-text-primary">
          {destination}
          <RouteMarker
            variant="destination"
            className="seq-pop [--seq-range:cover_28%_cover_42%]"
          />
        </span>
      </div>
      {/* The cut: a solid Soft White band with the Carbon triangle clipped over it (reaching
          a pixel into the band above), so no antialiased edge meets the section below. */}
      <div className="relative h-[clamp(1.5rem,4vw,3.5rem)] bg-soft-white">
        <div className="absolute inset-x-0 -top-px bottom-0 bg-background-primary [clip-path:polygon(0_0,100%_0,0_100%)]" />
      </div>
    </div>
  );
}
