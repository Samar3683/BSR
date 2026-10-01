"use client";

import { type CSSProperties, useEffect, useRef, useState } from "react";

import { RouteMarker } from "@/components/graphics/route-marker";
import { MediaFrame } from "@/components/media/media-frame";
import { cx } from "@/lib/utils/cx";
import type { SlotMedia } from "@/types/media";

import type { ProcessStep } from "../config/request-process-content";

type StepState = "done" | "active" | "upcoming";

const FADE = "transition-colors duration-500 motion-reduce:transition-none";

/**
 * One shipment's journey through the four steps, over one photograph of the
 * work itself. From `lg` the steps run horizontally and the photograph's
 * bottom edge is the route: as the block crosses the viewport, one green line
 * fills from node to node and each step switches on in turn — active green,
 * completed dark green, still to come neutral. On phones the same route runs
 * down the side of the steps.
 *
 * No pinning, no scroll hijacking: the reader's own scroll drives it, in both
 * directions — one position read per frame, applied through one CSS variable,
 * and React state that changes only when the current step does. Without
 * JavaScript every step shows complete; under reduced motion the states
 * follow the scroll but nothing animates between them.
 */
export function ShipmentJourney({
  steps,
  media,
}: {
  steps: readonly ProcessStep[];
  media?: SlotMedia;
}) {
  const root = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(-1);
  const last = steps.length - 1;

  useEffect(() => {
    const element = root.current;
    if (!element) return;
    let frame = 0;
    const measure = () => {
      frame = 0;
      const rect = element.getBoundingClientRect();
      const progress = Math.min(
        1,
        Math.max(0, (window.innerHeight * 0.65 - rect.top) / rect.height),
      );
      // The line reaches each node around the middle of that step's share.
      const line = Math.min(1, Math.max(0, (progress * steps.length - 0.5) / last));
      element.style.setProperty("--journey", line.toFixed(3));
      const step = Math.min(last, Math.floor(progress * steps.length));
      setActive((current) => (current === step ? current : step));
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };
    measure();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, [steps.length, last]);

  const state = (i: number): StepState =>
    active < 0 || i < active ? "done" : i === active ? "active" : "upcoming";

  return (
    <div
      ref={root}
      data-live={active >= 0 || undefined}
      style={{ "--journey": 1 } as CSSProperties}
      className="flex flex-col"
    >
      <MediaFrame
        name="process-main"
        media={media}
        sizes="(min-width: 80rem) 80rem, 100vw"
        reveal="bottom"
        parallax
        className="aspect-[16/10] sm:aspect-[21/9] lg:aspect-auto lg:h-[min(24rem,40svh)]"
      />

      <ol className="grid gap-7 pt-8 lg:grid-cols-4 lg:gap-x-(--spacing-grid-gap) lg:pt-0">
        {steps.map((step, i) => {
          const s = state(i);
          // Share of the route from this node to the next that has been travelled.
          const fill = "clamp(0,calc(var(--journey)*3 - var(--k)),1)";
          return (
            <li
              key={step.title}
              aria-current={s === "active" ? "step" : undefined}
              className="relative pl-10 lg:pt-9 lg:pl-0"
              style={{ "--k": i, "--fill": fill } as CSSProperties}
            >
              {i < last && (
                // From this node to the next: the neutral track and the green
                // route over it — down the side on phones, along the photograph's
                // edge from `lg`.
                <span aria-hidden="true">
                  <span className="absolute top-3 left-1 h-[calc(100%+1.75rem)] w-0.5 bg-border-default lg:hidden" />
                  <span className="absolute top-3 left-1 h-[calc(100%+1.75rem)] w-0.5 origin-top [scale:1_var(--fill)] bg-success-graphic lg:hidden" />
                  <span className="absolute top-0 left-0 hidden h-1 w-[calc(100%+var(--spacing-grid-gap))] -translate-y-1/2 bg-border-default lg:block" />
                  <span className="absolute top-0 left-0 hidden h-1 w-[calc(100%+var(--spacing-grid-gap))] origin-left -translate-y-1/2 [scale:var(--fill)_1] bg-success-graphic lg:block" />
                </span>
              )}
              <span
                aria-hidden="true"
                className="absolute top-3 left-0 -translate-y-1/2 lg:top-0 lg:left-0"
              >
                {i === last ? (
                  <RouteMarker
                    variant="destination"
                    className={cx(
                      "size-3 transition-opacity duration-500 motion-reduce:transition-none lg:size-3.5",
                      s === "upcoming" && "opacity-40",
                    )}
                  />
                ) : (
                  <span
                    className={cx(
                      "block size-3 rounded-full border-2 lg:size-3.5",
                      FADE,
                      s === "upcoming" && "border-border-strong bg-background-primary",
                      s === "active" &&
                        "border-success-graphic bg-success-graphic ring-4 ring-success-graphic/25",
                      s === "done" && "border-success-strong bg-success-strong",
                    )}
                  />
                )}
              </span>
              {/* States change colour, never opacity: every step keeps AA contrast. */}
              <div className="flex flex-col gap-1.5">
                <span
                  className={cx(
                    "type-metadata tabular-nums",
                    FADE,
                    s === "upcoming" ? "text-text-muted" : "text-success",
                  )}
                >
                  {String(i + 1).padStart(2, "0")}
                </span>
                <h3
                  className={cx(
                    "type-heading-md",
                    FADE,
                    s === "upcoming" ? "text-text-muted" : "text-text-primary",
                  )}
                >
                  {step.title}
                </h3>
                <p
                  className={cx(
                    "max-w-[32ch] type-body-sm",
                    FADE,
                    s === "upcoming" ? "text-text-muted" : "text-text-secondary",
                  )}
                >
                  {step.body}
                </p>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
