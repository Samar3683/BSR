"use client";

import { ArrowRight } from "lucide-react";
import { type KeyboardEvent, useId, useRef, useState, useSyncExternalStore } from "react";

import { MediaSlot } from "@/components/media/media-slot";
import { ButtonLink } from "@/components/ui/button";
import { cx } from "@/lib/utils/cx";

import type { VehicleCategory } from "../config/vehicles-content";
import { VehicleSchematic } from "./vehicle-schematic";

/** Nothing to subscribe to: only the server/client distinction matters. */
const subscribeNever = () => () => {};

/**
 * The vehicle selector: one dominant media stage and small tabs above the
 * details (WAI-ARIA tabs, automatic activation — arrows move and select,
 * Home/End jump). Choosing a type crossfades the photograph and fades the new
 * details in (500ms; instant under reduced motion) — name, use case, the
 * verified figures (van only) or where they come from, the request.
 *
 * Progressive: rendered without JavaScript (and before hydration) as the three
 * types stacked, every one fully readable; the tabbed stage takes over once the
 * page is interactive. Under reduced motion the swap is instant.
 */
interface CapacityCopy {
  label: string;
  pending: string;
}

export function VehicleSelector({
  categories,
  label,
  capacity,
}: {
  categories: readonly VehicleCategory[];
  label: string;
  capacity: CapacityCopy;
}) {
  // False on the server and through hydration, true once interactive.
  const enhanced = useSyncExternalStore(
    subscribeNever,
    () => true,
    () => false,
  );
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

  if (!enhanced) {
    return (
      <div className="flex flex-col gap-16">
        {categories.map((vehicle) => (
          <section key={vehicle.id} aria-labelledby={`${base}-${vehicle.id}-name`}>
            <MediaSlot
              name={`vehicle-${vehicle.id}`}
              media={vehicle.media}
              aspect="16/9"
              sizes="100vw"
            />
            <Details
              vehicle={vehicle}
              capacity={capacity}
              headingId={`${base}-${vehicle.id}-name`}
            />
          </section>
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-12 lg:grid-rows-[auto_1fr] lg:gap-x-(--spacing-grid-gap) lg:gap-y-8">
      <div
        role="tablist"
        aria-label={label}
        onKeyDown={onKeyDown}
        className="grid grid-cols-3 border-b border-border-default lg:col-span-4 lg:col-start-9 lg:row-start-1"
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
                "-mb-px flex min-h-(--target-min) items-center justify-center gap-2 border-b-2 px-2 type-label-sm transition-colors duration-200 motion-reduce:transition-none",
                selected
                  ? "border-success-graphic text-text-primary"
                  : "border-transparent text-text-muted hover:text-text-primary",
              )}
            >
              <span
                aria-hidden="true"
                className={cx(
                  "size-1.5 rounded-full transition-colors duration-200",
                  selected ? "bg-success-graphic" : "bg-border-strong",
                )}
              />
              {vehicle.label}
            </button>
          );
        })}
      </div>

      {/* The stage: the photograph, dominant — beside the details from `lg`. The
          pictures sit on a track and the track slides sideways: each vehicle drives
          into frame, its picture moving a little more slowly than its frame
          (mechanical, not a crossfade). On a touch screen a horizontal swipe
          moves to the next vehicle. */}
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
        className="relative aspect-[16/10] touch-pan-y overflow-clip bg-surface-secondary lg:col-span-8 lg:col-start-1 lg:row-span-2 lg:row-start-1 lg:aspect-auto lg:h-[min(34rem,62svh)]"
      >
        {/* One layer for the entry wipe; the track slides inside it. */}
        <div className="absolute inset-0">
          <div
            className="flex h-full transition-transform duration-[800ms] ease-cinematic motion-reduce:transition-none"
            style={{ transform: `translateX(-${active * 100}%)` }}
          >
            {categories.map((vehicle, i) => (
              <div key={vehicle.id} className="relative h-full w-full shrink-0 overflow-clip">
                <div
                  className="absolute inset-0 transition-transform duration-[800ms] ease-cinematic motion-reduce:transition-none"
                  style={{ transform: `translateX(${(i - active) * 12}%)` }}
                >
                  <MediaSlot
                    name={`vehicle-${vehicle.id}`}
                    media={vehicle.media}
                    aspect="fill"
                    sizes="(min-width: 64rem) 66vw, 100vw"
                  />
                </div>
              </div>
            ))}
          </div>
          <span className="absolute inset-x-0 bottom-0 h-1 bg-success-graphic" />
        </div>
      </div>

      {categories.map((vehicle, i) => (
        <div
          key={vehicle.id}
          id={`${base}-panel-${vehicle.id}`}
          role="tabpanel"
          aria-labelledby={`${base}-tab-${vehicle.id}`}
          tabIndex={0}
          hidden={i !== active}
          className="panel-in lg:col-span-4 lg:col-start-9 lg:row-start-2"
        >
          <Details vehicle={vehicle} capacity={capacity} schematic={false} />
        </div>
      ))}

      {/* Phones and tablets: the technical elevation closes the sheet. */}
      <div
        aria-hidden="true"
        className="relative aspect-[600/290] border-t border-border-default sm:w-2/3 lg:hidden"
      >
        {categories.map((vehicle, i) => (
          <div
            key={vehicle.id}
            className={cx(
              "absolute inset-0 transition-opacity duration-500 motion-reduce:transition-none",
              i === active ? "opacity-100" : "opacity-0",
            )}
          >
            <VehicleSchematic kind={vehicle.kind} />
          </div>
        ))}
      </div>
    </div>
  );
}

/** A type's name, use case, verified figures and (unless the stage shows it) technical elevation. */
function Details({
  vehicle,
  capacity,
  headingId,
  schematic = true,
}: {
  vehicle: VehicleCategory;
  capacity: CapacityCopy;
  headingId?: string;
  schematic?: boolean;
}) {
  return (
    <div className="flex flex-col gap-5">
      <h3 id={headingId} className="type-heading-lg">
        {vehicle.name}
      </h3>
      <p className="max-w-[36ch] type-lede text-text-secondary">{vehicle.useCase}</p>
      <dl className="grid gap-4 border-t border-border-default pt-5">
        {(vehicle.specs ?? [{ label: capacity.label, value: capacity.pending }]).map((spec) => (
          <div key={spec.label} className="flex flex-col gap-0.5">
            <dt className="type-label-sm text-success">{spec.label}</dt>
            <dd className={vehicle.specs ? "type-heading-md tabular-nums" : "type-body-md"}>
              {spec.value}
            </dd>
          </div>
        ))}
      </dl>
      {vehicle.note && <p className="max-w-[40ch] type-caption text-text-muted">{vehicle.note}</p>}
      <ButtonLink href={vehicle.action.href} trailingIcon={ArrowRight} className="self-start">
        {vehicle.action.label}
        <span className="sr-only"> {vehicle.action.context}</span>
      </ButtonLink>
      {schematic && (
        <div className="relative mt-2 aspect-[600/290] border-t border-border-default">
          <VehicleSchematic kind={vehicle.kind} />
        </div>
      )}
    </div>
  );
}
