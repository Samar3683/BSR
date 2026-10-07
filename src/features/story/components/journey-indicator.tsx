"use client";

import { useEffect, useState } from "react";

import { cx } from "@/lib/utils/cx";

import { ACTS } from "../config/acts";

const ROUTE_LABEL = {
  origin: "Origine",
  loading: "Carico",
  transit: "In viaggio",
  network: "In rete",
  destination: "Destinazione",
} as const;

/**
 * The film's timeline: a thin route down the left edge with one stop per act
 * — completed acts green and muted, the current one green with its number
 * and name, the next ones a hairline. Each stop jumps to its act. Large
 * screens only; hidden over the hero and the footer (and without
 * JavaScript, where it has nothing to follow). The current act is read with
 * one IntersectionObserver (the act crossing the middle of the viewport):
 * React re-renders only when the act changes.
 */
export function JourneyIndicator() {
  const [current, setCurrent] = useState(-1);

  useEffect(() => {
    const sections = ACTS.flatMap((act, index) =>
      act.sections.map((id) => ({ index, element: document.getElementById(id) })),
    ).filter((entry): entry is { index: number; element: HTMLElement } => Boolean(entry.element));
    const inView = new Set<number>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const index = sections.find((s) => s.element === entry.target)!.index;
          if (entry.isIntersecting) inView.add(index);
          else inView.delete(index);
        }
        setCurrent(inView.size ? Math.max(...inView) : -1);
      },
      { rootMargin: "-50% 0px -50% 0px" },
    );
    for (const { element } of sections) observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const act = ACTS[current];
  const surface =
    !act || act.tone === "light" ? "white" : act.tone === "green" ? "green" : "carbon";
  return (
    <nav
      aria-label="Atti del viaggio"
      data-surface={surface}
      data-visible={act ? "true" : undefined}
      className={cx(
        // Lives in the page margin (≥ 1280px wide): dots, the current act's number, names on hover/focus.
        "pointer-events-none fixed top-1/2 left-2 z-(--z-sticky) hidden -translate-y-1/2 bg-transparent",
        "opacity-0 transition-opacity duration-500 data-visible:pointer-events-auto data-visible:opacity-100",
        "[@media(min-width:80rem)_and_(min-height:40rem)]:block [html[data-hero-in-view]_&]:hidden",
      )}
    >
      <ol className="relative flex flex-col">
        <span
          aria-hidden="true"
          className="absolute top-3 bottom-3 left-[11.5px] w-px bg-hairline-strong"
        />
        {ACTS.map((entry, index) => {
          const state = index < current ? "past" : index === current ? "current" : "next";
          return (
            <li key={entry.act} className="relative">
              <a
                href={`/#${entry.sections[0]}`}
                aria-current={state === "current" ? "step" : undefined}
                className="group/stop relative flex h-6 items-center rounded-sm"
              >
                <span className="grid size-6 shrink-0 place-items-center">
                  <span
                    className={cx(
                      "rounded-full transition-[scale,background-color] duration-300",
                      state === "current" &&
                        "size-2.5 bg-success-graphic ring-4 ring-success-graphic/25",
                      state === "past" && "size-1.5 bg-success-graphic",
                      state === "next" && "size-1.5 bg-hairline-strong",
                    )}
                  />
                </span>
                <span
                  aria-hidden="true"
                  className={cx(
                    // A small backing in the act's surface: readable over any frame (a fade to dusk).
                    "bg-background-primary px-1 ed-meta text-success",
                    state !== "current" && "invisible",
                  )}
                >
                  {entry.act}
                </span>
                {/* The name: for assistive technology always; on screen on hover or focus. */}
                <span className="pointer-events-none absolute top-1/2 left-12 -translate-y-1/2 bg-background-primary px-2 py-1 ed-meta whitespace-nowrap text-text-primary opacity-0 shadow-ambient transition-opacity duration-200 group-hover/stop:opacity-100 group-focus-visible/stop:opacity-100">
                  <span className="sr-only">Atto {entry.act}: </span>
                  {entry.name}
                </span>
              </a>
            </li>
          );
        })}
      </ol>
      {act && (
        <p
          aria-hidden="true"
          className="mt-5 ml-[5px] rotate-180 bg-background-primary py-1 ed-meta text-text-secondary [writing-mode:vertical-rl]"
        >
          {ROUTE_LABEL[act.route]}
        </p>
      )}
    </nav>
  );
}
