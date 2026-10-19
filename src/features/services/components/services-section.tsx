import { ActionLink } from "@/components/editorial/action";
import { MediaSlot } from "@/components/media/media-slot";
import { GiantWord, InkTitle, seg } from "@/features/story/components/cine";
import { PinnedScene } from "@/features/story/components/scene";
import { TruckFront34 } from "@/features/story/components/truck";
import { actOf } from "@/features/story/config/acts";
import { cx } from "@/lib/utils/cx";

import { type ServiceItem, servicesContent as services } from "../config/services-content";

/** A service's route under the truck: green stops, the red destination, a note. */
function ServiceRoute({ route }: { route: ServiceItem["route"] }) {
  const last = route.stops.length - 1;
  return (
    <div aria-hidden="true" className="flex flex-col gap-2.5">
      <div className="relative mx-1 h-3">
        <span className="absolute inset-x-0 top-1/2 h-px bg-success-graphic" />
        {route.stops.map((stop, i) => (
          <span
            key={stop}
            className={cx(
              "absolute top-1/2 size-2 -translate-x-1/2 -translate-y-1/2",
              i === last ? "rotate-45 bg-action-primary" : "rounded-full bg-success-graphic",
            )}
            style={{ left: `${(i / Math.max(last, 1)) * 100}%` }}
          />
        ))}
      </div>
      <div className="flex justify-between ed-meta text-text-secondary">
        {route.stops.map((stop, i) => (
          <span key={stop} className={cx(i === last && "text-text-primary")}>
            {stop}
          </span>
        ))}
      </div>
      <span className="self-end ed-meta text-success">{route.note}</span>
    </div>
  );
}

/**
 * ACT 03 — Il servizio. The two services as two modes of the same truck.
 *
 * Pinned from `lg` (≈ 3 viewports). The BSR truck, in three-quarter view,
 * holds the right of the frame; behind it the mode's name runs across the
 * screen as a giant word (ESPRESSO, then DEDICATO), a small photograph of
 * the mode sits above, and under the truck the mode's route: three stops
 * and the indicative time for the express, one direct line and "nessun
 * trasbordo" for the dedicated. Scrolling is the switch — the left column
 * swaps the service story at the half; the switch under the stage moves the
 * scroll to either mode (for pointer and keyboard).
 *
 * Phones and unpinned: the title, the truck, then the two services one after
 * the other, each with its picture and route.
 */
export function ServicesSection() {
  const titleId = `${services.id}-title`;
  const act = actOf(services.id);
  return (
    <PinnedScene
      id={services.id}
      act={act}
      tone="white"
      labelledBy={titleId}
      steps={services.items.length}
      stepRange={[0.08, 0.92]}
      pinFrom="lg"
      className="group/scene"
    >
      {/* Giant words: the mode, running across behind the truck (decorative). */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-[44%] hidden h-[34%] lg:pin:block"
      >
        <GiantWord
          className="absolute left-0 text-[#eff1ec] seg pinned:[translate:calc(18vw-62vw*var(--e))_0]"
          style={seg(0, 0.6)}
        >
          {services.items[0]!.label}
        </GiantWord>
        <GiantWord
          className="absolute left-0 [translate:100vw_0] text-[#eff1ec] seg pinned:[translate:calc(100vw-86vw*var(--e))_0]"
          style={seg(0.42, 1)}
        >
          {services.items[1]!.label}
        </GiantWord>
      </div>

      <div className="relative ed-frame flex flex-col gap-10 py-[clamp(4rem,10svh,7rem)] lg:pin:h-full lg:pin:justify-center lg:pin:gap-0 lg:pin:py-0 lg:pin:pt-(--header-height)">
        <div className="ed-grid gap-y-10 lg:gap-y-[clamp(1.5rem,3.5svh,2.5rem)]">
          {/* The story (left). */}
          <div className="order-1 col-span-4 flex flex-col gap-[clamp(1.5rem,3.5svh,2.5rem)] md:col-span-8 lg:col-span-7 lg:row-start-1">
            <InkTitle
              id={titleId}
              lines={services.title}
              muted={[1]}
              className="cine-title text-[clamp(2.25rem,0.8rem+3.6vw,4.75rem)]"
              from={0}
              to={0.1}
            />
            <p className="max-w-[34rem] ed-body text-text-secondary lg:pin:hidden">
              {services.intro}
            </p>
          </div>

          {/* The two services: one at a time when pinned. */}
          <div className="order-3 col-span-4 md:col-span-8 lg:col-span-7 lg:row-start-2">
            <div className="grid gap-12">
              {services.items.map((item, i) => (
                <article
                  key={item.id}
                  id={item.id}
                  aria-labelledby={`${item.id}-title`}
                  data-step-item={i}
                  className="swap flex flex-col gap-3 border-t border-hairline-strong pt-5"
                >
                  <h3
                    id={`${item.id}-title`}
                    className="cine-h3 text-[clamp(1.75rem,0.9rem+1.9vw,2.875rem)]"
                  >
                    {item.title}
                  </h3>
                  <p className="ed-lede font-medium text-text-primary">{item.message}</p>
                  <p className="max-w-[50ch] ed-body text-text-secondary">{item.body}</p>
                  <dl className="mt-1 flex flex-wrap gap-x-8 gap-y-2">
                    {item.facts.map((fact) => (
                      <div key={fact.label} className="flex flex-col gap-0.5">
                        <dt className="ed-meta text-text-secondary">{fact.label}</dt>
                        <dd className="ed-label text-text-primary">{fact.value}</dd>
                      </div>
                    ))}
                  </dl>
                  <ActionLink href={item.action.href} className="mt-2 self-start">
                    {item.action.label}
                    <span className="sr-only"> {item.action.context}</span>
                  </ActionLink>
                  {/* Unpinned: the mode's route follows its story. */}
                  <div className="mt-4 lg:pin:hidden">
                    <ServiceRoute route={item.route} />
                  </div>
                </article>
              ))}
            </div>
          </div>

          {/* The truck and the mode (right), pinned only. */}
          <div
            aria-hidden="true"
            className="relative order-2 col-span-4 md:col-span-8 lg:col-span-9 lg:col-start-8 lg:row-span-2 lg:row-start-1 lg:pin:h-[calc(100svh-var(--header-height))]"
          >
            {/* The mode's photograph: small above the truck when pinned (crossfading with the
                mode), the two side by side otherwise. */}
            <div className="mb-8 grid grid-cols-2 gap-(--spacing-col-gap) lg:pin:absolute lg:pin:top-[7%] lg:pin:right-0 lg:pin:mb-0 lg:pin:block lg:pin:aspect-[16/10] lg:pin:w-[min(22vw,22rem)] lg:pin:overflow-clip lg:pin:bg-surface-secondary">
              {services.items.map((item, i) => (
                <figure
                  key={item.id}
                  data-step-item={i}
                  className="swap-media flex flex-col gap-2 lg:pin:absolute lg:pin:inset-0"
                >
                  <MediaSlot
                    name={`service-${item.id}`}
                    media={item.media}
                    aspect="16/9"
                    sizes="(min-width: 64rem) 22vw, 50vw"
                    className="bg-surface-secondary lg:pin:absolute lg:pin:inset-0 lg:pin:aspect-auto"
                  />
                </figure>
              ))}
            </div>

            <div className="relative lg:pin:absolute lg:pin:inset-x-0 lg:pin:bottom-[16%]">
              {/* The dedicated mode moves the truck forward a little: a different journey. */}
              <div className="transition-[translate] duration-[1400ms] ease-cinematic pinned:group-data-[step=1]/scene:[translate:3vw_0]">
                <TruckFront34
                  sizes="(min-width: 64rem) 52vw, 100vw"
                  className="w-full seg lg:pin:ml-[6%] lg:pin:w-[100%] pinned:[translate:calc(9vw-9vw*var(--e))_0]"
                  style={seg(0, 0.35)}
                />
              </div>
              <div className="mt-4 hidden w-[min(34rem,70%)] lg:pin:ml-auto lg:pin:grid">
                {services.items.map((item, i) => (
                  <div key={item.id} data-step-item={i} className="swap">
                    <ServiceRoute route={item.route} />
                  </div>
                ))}
              </div>
            </div>

            {/* The switch: scrolling is the interaction; these move the scroll. */}
            <div className="absolute bottom-[4%] left-[8%] hidden items-center gap-4 xl:pin:flex">
              <span className="ed-meta text-text-secondary">{services.switchLabel}</span>
              {services.items.map((item, i) => (
                <button
                  key={item.id}
                  type="button"
                  data-scene-jump={i}
                  tabIndex={-1}
                  className="min-h-11 rounded-full border border-hairline-strong px-4 ed-action text-text-secondary transition-colors group-data-[step=0]/scene:first-of-type:border-success-graphic group-data-[step=0]/scene:first-of-type:text-text-primary group-data-[step=1]/scene:last-of-type:border-success-graphic group-data-[step=1]/scene:last-of-type:text-text-primary hover:border-border-interactive"
                >
                  {item.code} {item.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </PinnedScene>
  );
}
