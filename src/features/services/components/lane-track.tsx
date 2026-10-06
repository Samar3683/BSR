"use client";

import { type ReactNode, useEffect, useRef, useState } from "react";

import { cx } from "@/lib/utils/cx";

/**
 * The service panels, as lanes. From `md` the track is a flex row (the lanes'
 * own hover and focus behaviour is CSS, in services-section.tsx). On phones it
 * is a horizontal swipe track — native scroll snapping, so touch scrolling
 * stays natural — with the first service in view and a visible pagination
 * indicator (one 44 px button per panel; the current one is marked by shape
 * and colour). Which panel is in view is read by one IntersectionObserver.
 */
export function LaneTrack({
  labels,
  groupLabel,
  children,
}: {
  /** One label per panel, for the pagination buttons. */
  labels: readonly string[];
  groupLabel: string;
  children: ReactNode;
}) {
  const track = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);

  useEffect(() => {
    const element = track.current;
    if (!element) return;
    const lanes = [...element.querySelectorAll<HTMLElement>("[data-lane]")];
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActive(lanes.indexOf(entry.target as HTMLElement));
        }
      },
      { root: element, threshold: 0.6 },
    );
    lanes.forEach((lane) => observer.observe(lane));
    return () => observer.disconnect();
  }, []);

  const go = (index: number) => {
    const lane = track.current?.querySelectorAll<HTMLElement>("[data-lane]")[index];
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    lane?.scrollIntoView({
      behavior: reduced ? "auto" : "smooth",
      inline: "center",
      block: "nearest",
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <div
        ref={track}
        className="lanes -mx-(--spacing-gutter) flex snap-x snap-mandatory gap-4 overflow-x-auto px-(--spacing-gutter) pb-1 [scrollbar-width:none] md:mx-0 md:snap-none md:gap-5 md:overflow-visible md:px-0 md:pb-0 [&::-webkit-scrollbar]:hidden"
      >
        {children}
      </div>
      <div
        role="group"
        aria-label={groupLabel}
        className="flex items-center justify-center gap-1 md:hidden"
      >
        {labels.map((label, i) => (
          <button
            key={label}
            type="button"
            onClick={() => go(i)}
            aria-label={label}
            aria-current={i === active ? "true" : undefined}
            className="grid size-11 place-items-center"
          >
            <span
              aria-hidden="true"
              className={cx(
                "h-1.5 rounded-full transition-[width,background-color] duration-300 motion-reduce:transition-none",
                i === active ? "w-8 bg-success-graphic" : "w-3 bg-border-strong",
              )}
            />
          </button>
        ))}
      </div>
    </div>
  );
}
