import { ActionLink } from "@/components/editorial/action";
import { MediaSlot } from "@/components/media/media-slot";
import { ActLabel, GiantWord, InkTitle, seg } from "@/features/story/components/cine";
import { RoadSkyline, RoadVerge } from "@/features/story/components/road";
import { PinnedScene } from "@/features/story/components/scene";
import { TruckSide } from "@/features/story/components/truck";
import { actOf } from "@/features/story/config/acts";

import { vehiclesContent as vehicles } from "../config/vehicles-content";
import { VehicleSchematic } from "./vehicle-schematic";

/** The fleet's share of the act; the departure plays after it. */
const FLEET = [0.04, 0.56] as const;
/** The camera pans from the yard to the road. */
const PAN = seg(0.58, 0.68);

/**
 * ACT 06 — Partenza. The vehicle, then the departure.
 *
 * Pinned (≈ 4.6 viewports).
 *  - The yard (0 → 0.56): the three types in turn — van, rigid, articulated —
 *    each as a large photograph, and beside it the story: what it is for, the verified figures (the van only),
 *    its line drawing, the request with the vehicle already chosen. A small
 *    index moves the scroll to any type. "Non sai quale mezzo serve?" stays.
 *  - The pan (0.58 → 0.68): the camera turns from the yard to the road.
 *  - The departure (0.66 → 1): the BSR truck, from the side, pulls away —
 *    the far sheds, the poplars and guardrail and the lane markings slide past
 *    at their own speeds, accelerating, the wheels turning, the speed readout
 *    climbing; it leaves the frame on the right as the light turns to dusk
 *    (the next act is the network, at night).
 *
 * Unpinned: the title, the three types one after another (pictures side by
 * side), then the truck on the road as a still.
 */
export function VehiclesSection() {
  const titleId = `${vehicles.id}-title`;
  const act = actOf(vehicles.id);
  const total = String(vehicles.categories.length).padStart(2, "0");
  const { departure } = vehicles;

  return (
    <PinnedScene
      id={vehicles.id}
      act={act}
      tone="soft-white"
      labelledBy={titleId}
      steps={vehicles.categories.length}
      stepRange={FLEET}
      className="group/scene"
    >
      {/* ---- The yard ---- */}
      <div
        className="relative seg pin:absolute pin:inset-0 pinned:[translate:calc(-110vw*var(--e))_0]"
        style={PAN}
      >
        <div className="relative ed-frame flex flex-col gap-10 py-[clamp(4rem,10svh,7rem)] pin:h-full pin:justify-center pin:py-0 pin:pt-(--header-height) max-md:pin:justify-start max-md:pin:pt-[calc(var(--header-height)+1rem)] max-md:pin:pb-24">
          <div className="ed-grid gap-y-10">
            <div className="col-span-4 flex flex-col gap-[clamp(1rem,2.6svh,2rem)] md:col-span-8 lg:col-span-6">
              <ActLabel act={act.act} name={vehicles.act.name} meta={vehicles.act.meta} />
              <InkTitle
                id={titleId}
                lines={vehicles.titleLines}
                className="cine-title text-[clamp(1.875rem,0.6rem+3.6vw,4.5rem)]"
                from={0}
                to={0.06}
              />
              <p className="max-w-[34rem] ed-body text-text-secondary max-lg:pin:hidden [@media(max-height:52rem)]:pin:hidden">
                {vehicles.intro}
              </p>

              <div className="grid gap-10">
                {vehicles.categories.map((vehicle, i) => (
                  <article
                    key={vehicle.id}
                    aria-labelledby={`${vehicle.id}-title`}
                    data-step-item={i}
                    className="swap flex flex-col gap-3 border-t border-hairline-strong pt-4"
                  >
                    <p className="flex items-center gap-3 ed-label">
                      <span className="text-success tabular-nums">
                        {vehicle.code} / {total}
                      </span>
                      <span className="text-text-secondary">{vehicle.label}</span>
                    </p>
                    <h3
                      id={`${vehicle.id}-title`}
                      className="cine-h3 text-[clamp(1.625rem,0.9rem+2vw,3rem)]"
                    >
                      {vehicle.name}
                    </h3>
                    <p className="max-w-[44ch] ed-lede text-text-primary">{vehicle.useCase}</p>
                    <dl className="flex flex-wrap gap-x-8 gap-y-2">
                      {(
                        vehicle.specs ?? [
                          { label: vehicles.capacity.label, value: vehicles.capacity.pending },
                        ]
                      ).map((spec) => (
                        <div key={spec.label} className="flex flex-col gap-0.5">
                          <dt className="ed-meta text-text-secondary">{spec.label}</dt>
                          <dd
                            className={
                              vehicle.specs
                                ? "ed-label text-text-primary"
                                : "ed-small text-text-primary"
                            }
                          >
                            {spec.value}
                          </dd>
                        </div>
                      ))}
                    </dl>
                    {vehicle.note && <p className="ed-meta text-text-secondary">{vehicle.note}</p>}
                    <div className="flex flex-wrap items-end justify-between gap-4">
                      <ActionLink href={vehicle.action.href} variant="outline">
                        {vehicle.action.label}
                        <span className="sr-only"> {vehicle.action.context}</span>
                      </ActionLink>
                      {/* The vehicle's side elevation: the silhouette that changes with the type. */}
                      <div className="relative hidden h-16 w-36 md:block [@media(max-height:52rem)]:pin:hidden">
                        <VehicleSchematic kind={vehicle.kind} />
                      </div>
                    </div>
                  </article>
                ))}
              </div>

              <div className="flex flex-col gap-3 border-t border-hairline pt-4 sm:flex-row sm:items-center sm:justify-between max-md:pin:hidden [@media(max-height:52rem)]:pin:hidden">
                <p className="flex flex-col gap-0.5">
                  <span className="ed-label text-text-primary">{vehicles.undecided.question}</span>
                  <span className="ed-small text-text-secondary">{vehicles.undecided.answer}</span>
                </p>
                <ActionLink
                  href={vehicles.undecided.href}
                  variant="quiet"
                  className="self-start sm:self-auto"
                >
                  {vehicles.undecided.cta}
                </ActionLink>
              </div>
            </div>

            {/* The pictures: one at a time when pinned, side by side otherwise. */}
            <div className="col-span-4 flex flex-col gap-5 max-lg:order-first md:col-span-8 lg:col-span-9 lg:col-start-8">
              <div className="grid grid-cols-3 gap-3 pin:relative pin:block pin:aspect-[16/10] pin:max-h-[24svh] pin:w-full pin:overflow-clip pin:bg-surface-secondary md:pin:max-h-[56svh] lg:pin:-mr-(--spacing-edge) lg:pin:w-[calc(100%+var(--spacing-edge))]">
                {vehicles.categories.map((vehicle, i) => (
                  <figure
                    key={vehicle.id}
                    data-step-item={i}
                    className="flex swap-media flex-col gap-2 pin:absolute pin:inset-0"
                  >
                    <MediaSlot
                      name={`fleet-${vehicle.id}`}
                      media={vehicle.media}
                      aspect="4/3"
                      sizes="(min-width: 64rem) 58vw, 100vw"
                      className="bg-surface-secondary pin:absolute pin:inset-0 pin:aspect-auto"
                    />
                    <figcaption className="ed-meta text-text-secondary pin:absolute pin:bottom-0 pin:left-0 pin:bg-background-primary pin:px-4 pin:py-3">
                      <span className="text-success">{vehicle.code}</span> · {vehicle.label}
                    </figcaption>
                  </figure>
                ))}
                <span
                  aria-hidden="true"
                  className="absolute top-4 right-4 hidden size-5 border-t border-r border-white/80 pin:block"
                />
              </div>
              {/* The index: each moves the scroll to its type. */}
              <div className="hidden items-center gap-3 pin:flex">
                <span className="ed-meta text-text-secondary max-sm:sr-only">
                  {vehicles.selectorLabel}
                </span>
                {vehicles.categories.map((vehicle, i) => (
                  <button
                    key={vehicle.id}
                    type="button"
                    data-scene-jump={i}
                    className={`min-h-11 rounded-full border border-hairline-strong px-4 ed-action text-text-secondary transition-colors hover:border-border-interactive ${
                      [
                        "group-data-[step=0]/scene:border-success-graphic group-data-[step=0]/scene:text-text-primary",
                        "group-data-[step=1]/scene:border-success-graphic group-data-[step=1]/scene:text-text-primary",
                        "group-data-[step=2]/scene:border-success-graphic group-data-[step=2]/scene:text-text-primary",
                      ][i]
                    }`}
                  >
                    <span className="sr-only">Mostra: </span>
                    {vehicle.code} {vehicle.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ---- The departure ---- */}
      <div
        aria-hidden="true"
        className="relative h-[clamp(20rem,62svh,36rem)] overflow-clip bg-[linear-gradient(180deg,#eef3ef_0%,var(--color-soft-white)_62%)] seg pin:absolute pin:inset-0 pin:h-auto pinned:[translate:calc(100vw*(1-var(--e)))_0]"
        style={PAN}
      >
        {/* The far edge, the verge and the road, each sliding at its own speed. */}
        <div
          className="absolute inset-x-0 bottom-[30%] seg pinned:[translate:calc(-50vw*var(--t)*var(--t))_0]"
          style={seg(0.66, 1)}
        >
          <RoadSkyline className="h-[clamp(7rem,22svh,13rem)] w-[220vw]" />
        </div>
        <div
          className="absolute inset-x-0 bottom-[22%] seg pinned:[translate:calc(-110vw*var(--t)*var(--t))_0]"
          style={seg(0.66, 1)}
        >
          <RoadVerge className="h-[clamp(5rem,16svh,9rem)] w-[260vw]" />
        </div>
        <div className="absolute inset-x-0 bottom-0 h-[22%] bg-[#2a2f2c]">
          <span className="absolute inset-x-0 top-[12%] h-px bg-white/25" />
          <div
            className="absolute top-[52%] left-0 h-1 w-[400vw] dashes text-white/80 seg pinned:[translate:calc(-300vw*var(--t)*var(--t))_0]"
            style={seg(0.66, 1)}
          />
        </div>

        <GiantWord
          className="absolute top-[24%] left-0 hidden text-[#e3e7e1] seg md:top-[10%] pin:block pinned:[translate:calc(60vw-90vw*var(--t))_0]"
          style={seg(0.62, 1)}
        >
          {departure.word}
        </GiantWord>

        {/* The truck: holds the centre while the world moves, then pulls away right. */}
        <div
          className="absolute bottom-[19%] left-1/2 w-[min(80vw,74rem)] -translate-x-1/2 seg pinned:[translate:calc(-50%+90vw*var(--t)*var(--t))_0]"
          style={seg(0.9, 1, { "--turns": 46 })}
        >
          <TruckSide sizes="(min-width: 64rem) 74rem, 80vw" className="w-full" />
        </div>

        {/* Readouts. */}
        <div className="absolute inset-x-0 top-[calc(var(--header-height)+1.5rem)] ed-frame flex items-start justify-between">
          <p className="flex items-baseline gap-2">
            <span
              className="font-tech text-[clamp(2.5rem,1.5rem+2.4vw,4rem)] leading-none font-bold text-text-primary speedometer seg"
              style={seg(0.66, 0.94)}
            />
            <span className="ed-label text-text-secondary">{departure.speedUnit}</span>
          </p>
          <p className="flex items-center gap-3 ed-meta text-text-secondary">
            <span className="size-1.5 rounded-full bg-success-graphic" />
            {departure.route}
          </p>
        </div>

        {/* Dusk: the light falls towards the night of the network (the next act). */}
        <div
          className="absolute inset-0 hidden bg-carbon seg pinned:block pinned:opacity-(--t)"
          style={seg(0.93, 1)}
        />
      </div>
    </PinnedScene>
  );
}
