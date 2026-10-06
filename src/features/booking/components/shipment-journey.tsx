"use client";

import { type CSSProperties, useEffect, useRef, useState } from "react";

import { MediaSlot } from "@/components/media/media-slot";
import { cx } from "@/lib/utils/cx";
import type { SlotMedia } from "@/types/media";

import type { ProcessStep } from "../config/request-process-content";

type StepState = "done" | "active" | "upcoming";

const FADE = "transition-colors duration-500 motion-reduce:transition-none";

/**
 * The signature interaction: a shipment's journey as a controlled system.
 *
 * From `lg`, a sticky stage on the left and the four steps scrolling on the
 * right. The reader's own scroll drives everything — scroll progress → route
 * movement → image transition → content change:
 * - the green route along the foot of the stage fills and its marker moves
 *   continuously with the scroll (an abstract route, four nodes, the last a
 *   red destination — not a map);
 * - the photograph pans along its width from step to step, a horizontal mask
 *   sweeping across as the step changes;
 * - the stage's heading and the current step change together.
 * Below `lg` it is simply stacked — the photograph, the route, then the steps —
 * with the same route and states; no sticky behaviour, natural scrolling.
 *
 * No pinning of the page, no scroll hijacking (position: sticky only). One
 * position read per frame, applied through one CSS variable; React state changes
 * only when the current step does. The scroll listener exists only while the
 * block is within half a viewport of the screen (an IntersectionObserver), so
 * the real-time hero above never pays for it. Without JavaScript every step
 * shows complete; under reduced motion the states follow the scroll but
 * nothing animates between them.
 */
export function ShipmentJourney({
  steps,
  media,
}: {
  steps: readonly ProcessStep[];
  media?: SlotMedia;
}) {
  const root = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLOListElement>(null);
  const [active, setActive] = useState(-1);
  const last = steps.length - 1;

  useEffect(() => {
    const element = root.current;
    const items = list.current ? [...list.current.children] : [];
    if (!element || items.length === 0) return;
    let frame = 0;
    const measure = () => {
      frame = 0;
      const middle = window.innerHeight * 0.5;
      const centres = items.map((item) => {
        const box = item.getBoundingClientRect();
        return box.top + box.height / 2;
      });
      const first = centres[0]!;
      const end = centres[last]!;
      const p = end > first ? Math.min(1, Math.max(0, (middle - first) / (end - first))) : 0;
      element.style.setProperty("--p", p.toFixed(4));
      const step = Math.round(p * last);
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
      className="flex flex-col gap-10 lg:grid lg:grid-cols-12 lg:gap-x-(--spacing-grid-gap) lg:gap-y-0"
    >
      <div className="lg:sticky lg:top-[calc(var(--header-height)+1.5rem)] lg:col-span-6 lg:self-start">
        <div
          data-reveal="slide"
          className="relative aspect-[4/3] overflow-clip bg-surface-secondary lg:aspect-auto lg:h-[min(36rem,72svh)]"
        >
          {/* The photograph, wider than its frame, panned along from step to step. */}
          <div
            aria-hidden="true"
            className="absolute inset-y-0 left-0 w-[125%] transition-transform duration-[900ms] ease-cinematic motion-reduce:transition-none"
            style={{ transform: `translateX(-${(shown * 20) / Math.max(last, 1)}%)` }}
          >
            <MediaSlot
              name="process-main"
              media={media}
              aspect="fill"
              sizes="(min-width: 64rem) 60vw, 100vw"
            />
          </div>
          {/* The horizontal mask: a panel sweeps across as the step changes. */}
          {active >= 0 && (
            <span
              key={active}
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 stage-wipe bg-background-primary"
            />
          )}
          <p
            aria-hidden="true"
            data-surface="carbon"
            className="absolute top-0 left-0 flex items-center gap-3 bg-background-primary px-4 py-3 type-label-sm text-text-primary"
          >
            <span className="text-success tabular-nums">
              {String(shown + 1).padStart(2, "0")} / {String(steps.length).padStart(2, "0")}
            </span>
            <span key={shown} className="panel-in">
              {steps[shown]!.title}
            </span>
          </p>

          {/* The route: four nodes, the green line filling and the marker moving with the scroll. */}
          <div
            aria-hidden="true"
            data-surface="carbon"
            className="absolute inset-x-0 bottom-0 bg-background-primary px-6 pt-5 pb-4 text-text-primary"
          >
            <div className="relative mx-2 h-6">
              <span className="absolute inset-x-0 top-1/2 h-0.5 -translate-y-1/2 bg-border-strong" />
              <span className="absolute inset-x-0 top-1/2 h-0.5 origin-left -translate-y-1/2 scale-x-(--p) bg-success-graphic" />
              {steps.map((step, i) => (
                <span
                  key={step.title}
                  className={cx(
                    "absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2",
                    FADE,
                    i === last ? "rotate-45" : "rounded-full",
                    state(i) === "upcoming"
                      ? "border-2 border-border-strong bg-background-primary"
                      : i === last
                        ? "bg-action-primary"
                        : "bg-success-graphic",
                  )}
                  style={{ left: `${(i / last) * 100}%` }}
                />
              ))}
              <span
                className="absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rotate-45 border-2 border-background-primary bg-white"
                style={{ left: "calc(var(--p) * 100%)" }}
              />
            </div>
            <div className="mt-2 flex justify-between type-metadata text-text-secondary">
              {steps.map((step) => (
                <span key={step.title}>{step.title}</span>
              ))}
            </div>
          </div>
        </div>
      </div>

      <ol ref={list} className="flex flex-col gap-10 lg:col-span-5 lg:col-start-8 lg:gap-0">
        {steps.map((step, i) => {
          const s = state(i);
          return (
            <li
              key={step.title}
              aria-current={s === "active" ? "step" : undefined}
              className="relative flex flex-col gap-3 border-t border-border-strong pt-6 lg:min-h-[52svh] lg:justify-center lg:border-t-0 lg:py-10"
            >
              {/* States change colour, never opacity: every step keeps AA contrast. */}
              <span
                className={cx(
                  "type-figure",
                  FADE,
                  s === "upcoming" ? "text-text-muted" : "text-success",
                )}
                aria-hidden="true"
              >
                {String(i + 1).padStart(2, "0")}
              </span>
              <h3
                className={cx(
                  "type-heading-lg",
                  FADE,
                  s === "upcoming" ? "text-text-muted" : "text-text-primary",
                )}
              >
                {step.title}
              </h3>
              <p
                className={cx(
                  "text-lg max-w-[34ch] leading-relaxed",
                  FADE,
                  s === "upcoming" ? "text-text-muted" : "text-text-secondary",
                )}
              >
                {step.body}
              </p>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
