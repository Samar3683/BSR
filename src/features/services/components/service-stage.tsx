"use client";

import { useState } from "react";

import { ActionLink } from "@/components/editorial/action";
import { RouteLine } from "@/components/editorial/route-line";
import { MediaSlot } from "@/components/media/media-slot";
import { cx } from "@/lib/utils/cx";

import type { ServiceItem } from "../config/services-content";

/**
 * The two services as two stories beside one cinematic stage.
 *
 * Both stories are always complete (nothing is hidden behind the interaction):
 * the service in play — hovered, focused or tapped — takes the green indicator
 * and its index turns green, and the stage beside it changes picture (a 700 ms
 * crossfade with a 3% settle; instant under reduced motion). Its caption names
 * the service and its indicative time. Under the stage, the route the service
 * runs draws once: Ritiro → In viaggio → Consegna.
 *
 * Without JavaScript the first service is in play and the stage shows it.
 */
export function ServiceStage({
  items,
  connector,
  stageLabel,
}: {
  items: readonly ServiceItem[];
  connector: readonly string[];
  stageLabel: string;
}) {
  const [active, setActive] = useState(0);
  const current = items[active]!;

  return (
    <div className="ed-grid gap-y-8">
      <div className="col-span-4 flex flex-col border-b border-hairline md:col-span-8 lg:col-span-7">
        {items.map((item, i) => {
          const on = i === active;
          return (
            <article
              key={item.id}
              id={item.id}
              aria-labelledby={`${item.id}-title`}
              data-active={on || undefined}
              onPointerEnter={(event) => {
                if (event.pointerType === "mouse") setActive(i);
              }}
              onFocusCapture={() => setActive(i)}
              onClick={() => setActive(i)}
              className="relative flex flex-col gap-2 border-t border-hairline py-4 pl-5 sm:pl-7"
            >
              {/* The indicator: green while the service is in play. */}
              <span
                aria-hidden="true"
                className={cx(
                  "absolute top-4 bottom-4 left-0 w-0.5 origin-top bg-success-graphic transition-[scale] duration-300 ease-ui motion-reduce:transition-none",
                  on ? "scale-y-100" : "scale-y-0",
                )}
              />
              <div className="flex items-center justify-between gap-4">
              <p className="flex items-center gap-3 ed-label">
                <span
                  className={cx(
                    "tabular-nums transition-colors duration-200",
                    on ? "text-success" : "text-text-secondary",
                  )}
                >
                  {item.code}
                </span>
                <span className="text-text-secondary">{item.label}</span>
              </p>
                <ActionLink href={item.action.href} variant="quiet" className="max-sm:hidden">
                  {item.action.label}
                  <span className="sr-only"> {item.action.context}</span>
                </ActionLink>
              </div>
              <h3 id={`${item.id}-title`} className="ed-h3">
                {item.title}
              </h3>
              <p className="ed-lede font-medium text-text-primary">{item.message}</p>
              <p className="max-w-[54ch] ed-body text-text-secondary">{item.body}</p>
              <dl className="mt-1 flex flex-wrap gap-x-8 gap-y-2">
                {item.facts.map((fact) => (
                  <div key={fact.label} className="flex items-baseline gap-2">
                    <dt className="ed-meta text-text-secondary">{fact.label}</dt>
                    <dd className="ed-small font-semibold text-text-primary">{fact.value}</dd>
                  </div>
                ))}
              </dl>
              <ActionLink href={item.action.href} variant="quiet" className="self-start sm:hidden!">
                {item.action.label}
                <span className="sr-only"> {item.action.context}</span>
              </ActionLink>
            </article>
          );
        })}
      </div>

      <div className="order-first col-span-4 flex flex-col gap-4 md:col-span-8 lg:order-none lg:col-span-8 lg:col-start-9">
        <div
          data-reveal="right"
          className="relative aspect-[4/3] lg:ed-bleed-r lg:aspect-auto lg:min-h-[min(26rem,50svh)] lg:flex-1"
        >
          <div className="absolute inset-0 overflow-clip bg-surface-secondary">
            {items.map((item, i) => (
              <div
                key={item.id}
                aria-hidden={i !== active || undefined}
                className={cx(
                  "absolute inset-0 transition-[opacity,scale] duration-700 ease-enter motion-reduce:transition-none",
                  i === active ? "scale-100 opacity-100" : "scale-[1.03] opacity-0",
                )}
              >
                <MediaSlot
                  name={`service-${item.id}`}
                  media={item.media}
                  aspect="fill"
                  sizes="(min-width: 64rem) 55vw, 100vw"
                />
              </div>
            ))}
            <p
              aria-hidden="true"
              data-surface="white"
              className="absolute top-0 left-0 flex items-center gap-3 bg-background-primary px-4 py-3 ed-meta text-text-secondary"
            >
              <span className="text-success">
                {current.code} / {String(items.length).padStart(2, "0")}
              </span>
              <span>
                {stageLabel} · {current.label}
              </span>
            </p>
          </div>
        </div>
        <RouteLine stops={connector} delay={400} className="lg:mr-0" />
      </div>
    </div>
  );
}
