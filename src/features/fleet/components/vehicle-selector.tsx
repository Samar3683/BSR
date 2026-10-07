"use client";

import { type KeyboardEvent, useId, useRef, useState } from "react";

import { ActionLink } from "@/components/editorial/action";
import { MediaSlot } from "@/components/media/media-slot";
import { cx } from "@/lib/utils/cx";

import type { VehicleCategory } from "../config/vehicles-content";

interface CapacityCopy {
  label: string;
  pending: string;
}

/**
 * The vehicle selector: one large photograph running off the left edge of the
 * page, and beside it a small technical navigation (WAI-ARIA tabs, automatic
 * activation — arrows move and select, Home/End jump) above the details.
 *
 * Choosing a type crossfades the photograph (700 ms, a 3% settle), slides the
 * green route marker under the tabs to it, and brings in its details: name,
 * use, the verified figures (the van only) or that the configuration depends
 * on the shipment, the request with this vehicle chosen. Instant under
 * reduced motion.
 *
 * The tabbed layout is rendered from the server, so hydration never moves the
 * page. Without JavaScript a <noscript> rule shows every type's details, one
 * after another (the stage keeps the first photograph).
 */
export function VehicleSelector({
  categories,
  label,
  capacity,
}: {
  categories: readonly VehicleCategory[];
  label: string;
  capacity: CapacityCopy;
}) {
  const [active, setActive] = useState(0);
  const tabs = useRef<Array<HTMLButtonElement | null>>([]);
  const swipe = useRef<number | null>(null);
  const base = useId();

  const select = (index: number) => {
    const next = (index + categories.length) % categories.length;
    setActive(next);
    tabs.current[next]?.focus();
  };
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const keys: Record<string, () => void> = {
      ArrowRight: () => select(active + 1),
      ArrowDown: () => select(active + 1),
      ArrowLeft: () => select(active - 1),
      ArrowUp: () => select(active - 1),
      Home: () => select(0),
      End: () => select(categories.length - 1),
    };
    const action = keys[event.key];
    if (action) {
      event.preventDefault();
      action();
    }
  };

  return (
    <div className="ed-grid gap-y-6">
      <noscript>
        <style>
          {
            "[data-fleet-tabs]{display:none!important}[data-fleet-panel]{display:block!important;grid-row:auto!important}"
          }
        </style>
      </noscript>

      {/* The stage: the photograph, dominant, running to the left edge of the page.
          On a touch screen a horizontal swipe moves to the next vehicle. */}
      <div
        aria-hidden="true"
        data-reveal="left"
        onTouchStart={(event) => {
          swipe.current = event.touches[0]?.clientX ?? null;
        }}
        onTouchEnd={(event) => {
          const from = swipe.current;
          swipe.current = null;
          const to = event.changedTouches[0]?.clientX;
          if (from === null || to === undefined || Math.abs(to - from) < 48) return;
          setActive((current) =>
            Math.min(categories.length - 1, Math.max(0, current + (to < from ? 1 : -1))),
          );
        }}
        className="relative col-span-4 aspect-[16/10] touch-pan-y md:col-span-8 lg:col-span-9 lg:row-span-2 lg:row-start-1 lg:ed-bleed-l lg:aspect-auto lg:h-[min(26rem,50svh)]"
      >
        <div className="absolute inset-0 overflow-clip bg-surface-secondary">
          {categories.map((vehicle, i) => (
            <div
              key={vehicle.id}
              className={cx(
                "absolute inset-0 transition-[opacity,scale] duration-700 ease-enter motion-reduce:transition-none",
                i === active ? "scale-100 opacity-100" : "scale-[1.03] opacity-0",
              )}
            >
              <MediaSlot
                name={`vehicle-${vehicle.id}`}
                media={vehicle.media}
                aspect="fill"
                sizes="(min-width: 64rem) 62vw, 100vw"
              />
            </div>
          ))}
          <p
            data-surface="white"
            className="absolute right-0 bottom-0 flex items-center gap-3 bg-background-primary px-4 py-3 ed-meta text-text-secondary"
          >
            <span className="text-success tabular-nums">
              {categories[active]!.code} / {String(categories.length).padStart(2, "0")}
            </span>
            <span key={active} className="panel-in">
              {categories[active]!.name}
            </span>
          </p>
        </div>
      </div>

      {/* The technical navigation, with the route marker sliding to the type chosen. */}
      <div
        role="tablist"
        aria-label={label}
        data-fleet-tabs=""
        onKeyDown={onKeyDown}
        className="relative col-span-4 grid grid-cols-3 border-b border-hairline md:col-span-8 lg:col-span-6 lg:col-start-11 lg:row-start-1 lg:self-start"
      >
        {categories.map((vehicle, i) => {
          const selected = i === active;
          return (
            <button
              key={vehicle.id}
              ref={(node) => {
                tabs.current[i] = node;
              }}
              id={`${base}-tab-${vehicle.id}`}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={`${base}-panel-${vehicle.id}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => setActive(i)}
              className={cx(
                "flex min-h-12 items-center gap-2 pr-2 text-left ed-label transition-colors duration-200 motion-reduce:transition-none",
                selected ? "text-text-primary" : "text-text-secondary hover:text-text-primary",
              )}
            >
              <span aria-hidden="true" className={cx("tabular-nums", selected && "text-success")}>
                {vehicle.code}
              </span>
              {vehicle.label}
            </button>
          );
        })}
        <span
          aria-hidden="true"
          className="absolute -bottom-px left-0 h-0.5 w-1/3 bg-success-graphic transition-transform duration-500 ease-cinematic motion-reduce:transition-none"
          style={{ transform: `translateX(${active * 100}%)` }}
        />
      </div>

      {categories.map((vehicle, i) => (
        <div
          key={vehicle.id}
          id={`${base}-panel-${vehicle.id}`}
          role="tabpanel"
          aria-labelledby={`${base}-tab-${vehicle.id}`}
          data-fleet-panel=""
          tabIndex={0}
          hidden={i !== active}
          className="panel-in col-span-4 md:col-span-8 lg:col-span-6 lg:col-start-11 lg:row-start-2"
        >
          <Details vehicle={vehicle} capacity={capacity} />
        </div>
      ))}
    </div>
  );
}

/** A type's name, use, verified figures (or where they come from) and its request. */
function Details({ vehicle, capacity }: { vehicle: VehicleCategory; capacity: CapacityCopy }) {
  return (
    <div className="flex flex-col gap-5 pt-2">
      <h3 className="ed-h3">{vehicle.name}</h3>
      <p className="max-w-[36ch] ed-body text-text-secondary">{vehicle.useCase}</p>
      <dl className="border-t border-hairline">
        {(vehicle.specs ?? [{ label: capacity.label, value: capacity.pending }]).map((spec) => (
          <div
            key={spec.label}
            className="grid grid-cols-1 gap-1 border-b border-hairline py-3 sm:grid-cols-[minmax(0,11rem)_1fr] sm:items-baseline sm:gap-4"
          >
            <dt className="ed-meta text-text-secondary">{spec.label}</dt>
            <dd className={vehicle.specs ? "ed-h4 normal-case tabular-nums" : "ed-small text-text-primary"}>
              {spec.value}
            </dd>
          </div>
        ))}
      </dl>
      {vehicle.note && <p className="ed-meta text-text-secondary">{vehicle.note}</p>}
      <ActionLink href={vehicle.action.href} variant="quiet" className="self-start">
        {vehicle.action.label}
        <span className="sr-only"> {vehicle.action.context}</span>
      </ActionLink>
    </div>
  );
}
