"use client";

import { type CSSProperties, useEffect, useRef, useState } from "react";

import { MediaSlot } from "@/components/media/media-slot";
import { cx } from "@/lib/utils/cx";
import type { SlotMedia } from "@/types/media";

import type { ProcessStep } from "../config/request-process-content";

type StepState = "done" | "active" | "upcoming";

const FADE = "transition-colors duration-500 motion-reduce:transition-none";

/**
 * The shipment's journey — one photograph, one green route, four steps — in
 * about one viewport, driven by the reader's own scroll (no pinning, no
 * hijacking: scroll position is only an input).
 *
 * - From `lg`: a wide photograph band, then the route running under it through
 *   the four steps set in four columns. As the chapter is scrolled through,
 *   the green line fills, a white marker travels along it, the step reached
 *   turns green (those passed keep a green index, those ahead stay neutral),
 *   and the photograph pans a little further along the same journey.
 * - Below `lg`: the photograph, then the steps down a vertical route.
 *
 * One position read per frame, written to one CSS variable (`--p`); React
 * state changes only when the current step does. The scroll listener exists
 * only while the block is within half a viewport of the screen (an
 * IntersectionObserver), so the real-time hero above never pays for it.
 * Without JavaScript every step shows complete; under reduced motion the
 * states follow the scroll but nothing animates between them.
 */
export function ShipmentJourney({
  steps,
  media,
  stageLabel,
}: {
  steps: readonly ProcessStep[];
  media?: SlotMedia;
  stageLabel: string;
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
      const box = element.getBoundingClientRect();
      const vh = window.innerHeight;
      // From the block's top reaching 85% of the viewport to its bottom reaching 60%.
      const p = Math.min(1, Math.max(0, (vh * 0.85 - box.top) / Math.max(box.height + vh * 0.25, 1)));
      element.style.setProperty("--p", p.toFixed(4));
      const step = Math.min(last, Math.floor(p * (last + 1)));
      setActive((current) => (current === step ? current : step));
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };
    let listening = false;
    const listen = (on: boolean) => {
      if (on === listening) return;
      listening = on;
      const method = on ? "addEventListener" : "removeEventListener";
      window[method]("scroll", schedule, { passive: true });
      window[method]("resize", schedule);
    };
    // Near the screen: follow the scroll. Leaving it: settle once, stop.
    const near = new IntersectionObserver(
      ([entry]) => {
        listen(Boolean(entry?.isIntersecting));
        schedule();
      },
      { rootMargin: "50% 0px" },
    );
    near.observe(element);
    return () => {
      near.disconnect();
      listen(false);
      cancelAnimationFrame(frame);
    };
  }, [last]);

  const state = (i: number): StepState =>
    active < 0 || i < active ? "done" : i === active ? "active" : "upcoming";
  const shown = Math.max(active, 0);

  return (
    <div
      ref={root}
      data-live={active >= 0 || undefined}
      style={{ "--p": 1 } as CSSProperties}
      className="flex flex-col gap-8 lg:gap-6"
    >
      {/* The photograph, wider than its frame, panning along with the route. */}
      <div
        data-reveal="left"
        className="relative aspect-[16/10] sm:aspect-[21/9] lg:aspect-auto lg:h-[min(19rem,33svh)]"
      >
        <div className="absolute inset-0 overflow-clip bg-surface-secondary">
          <div
            aria-hidden="true"
            className="absolute inset-y-0 left-0 w-[112%] translate-x-[calc(var(--p)*-10%)] motion-reduce:translate-x-0"
          >
            <MediaSlot
              name="process-main"
              media={media}
              aspect="fill"
              sizes="(min-width: 64rem) 100vw, 100vw"
            />
          </div>
          <p
            aria-hidden="true"
            data-surface="white"
            className="absolute top-0 left-0 flex items-center gap-3 bg-background-primary px-4 py-3 ed-meta text-text-secondary"
          >
            <span className="text-success tabular-nums">
              {String(shown + 1).padStart(2, "0")} / {String(steps.length).padStart(2, "0")}
            </span>
            <span key={shown} className="panel-in">
              {stageLabel} · {steps[shown]!.title}
            </span>
          </p>
        </div>
      </div>

      <div className="relative">
        {/* The route. Horizontal from `lg` (through the four columns), vertical below. */}
        <div aria-hidden="true" className="absolute top-0 bottom-0 left-[5px] w-px lg:hidden">
          <span className="absolute inset-0 bg-hairline-strong" />
          <span className="absolute inset-0 origin-top scale-y-(--p) bg-success-graphic" />
        </div>
        <div aria-hidden="true" className="relative mb-6 hidden h-3 lg:block">
          <span className="absolute inset-x-0 top-1/2 h-px bg-hairline-strong" />
          <span className="absolute inset-x-0 top-1/2 h-px origin-left scale-x-(--p) bg-success-graphic" />
          <span
            className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rotate-45 border border-success-graphic bg-background-primary"
            style={{ left: "calc(var(--p) * 100%)" }}
          />
        </div>

        <ol className="flex flex-col gap-7 pl-7 lg:grid lg:grid-cols-4 lg:gap-x-(--spacing-col-gap) lg:pl-0">
          {steps.map((step, i) => {
            const s = state(i);
            return (
              <li
                key={step.title}
                aria-current={s === "active" ? "step" : undefined}
                className="relative flex flex-col gap-2 lg:pr-6"
              >
                {/* The step's node on the route: green once reached, red at the destination. */}
                <span
                  aria-hidden="true"
                  className={cx(
                    "absolute top-1 -left-7 size-3 lg:hidden",
                    FADE,
                    i === last ? "rotate-45" : "rounded-full",
                    s === "upcoming"
                      ? "border border-hairline-strong bg-background-primary"
                      : i === last
                        ? "bg-action-primary"
                        : "bg-success-graphic",
                  )}
                />
                <span
                  aria-hidden="true"
                  className={cx("ed-label tabular-nums", FADE, s === "upcoming" ? "text-text-secondary" : "text-success")}
                >
                  {String(i + 1).padStart(2, "0")}
                </span>
                <h3 className={cx("ed-h4", FADE, s === "upcoming" ? "text-text-secondary" : "text-text-primary")}>
                  {step.title}
                </h3>
                <p className="max-w-[34ch] ed-small text-text-secondary">{step.body}</p>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
