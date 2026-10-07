import { ActionLink } from "@/components/editorial/action";
import { Chapter } from "@/components/editorial/chapter";
import { Label } from "@/components/editorial/label";

import { vehiclesContent as vehicles } from "../config/vehicles-content";
import { VehicleSelector } from "./vehicle-selector";

/**
 * Chapter 05 — "which vehicle will handle it?", on White. BSR assigns the
 * vehicle to the shipment, so the chapter is a selector (VehicleSelector),
 * not a catalogue: one large photograph, three types, only the verified
 * figures. It closes on the question most visitors have — and the request.
 */
export function VehiclesSection() {
  const titleId = `${vehicles.id}-title`;
  return (
    <Chapter id={vehicles.id} tone="white" labelledBy={titleId} {...vehicles.chapter}>
      <div className="flex flex-col gap-8 lg:gap-10">
        <header className="ed-grid gap-y-5">
          <div data-reveal="rise" className="col-span-4 flex flex-col gap-5 md:col-span-8 lg:col-span-9">
            <Label>{vehicles.label}</Label>
            <h2 id={titleId} className="ed-h2 text-balance">
              {vehicles.title}
            </h2>
          </div>
          <p className="col-span-4 max-w-[38rem] ed-body text-text-secondary md:col-span-6 lg:col-span-5 lg:col-start-12 lg:self-end">
            {vehicles.intro}
          </p>
        </header>
        <VehicleSelector
          categories={vehicles.categories}
          label={vehicles.selectorLabel}
          capacity={vehicles.capacity}
        />
        <div className="flex flex-col gap-4 border-t border-hairline pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:gap-4">
            <span className="ed-h4">{vehicles.undecided.question}</span>
            <span className="ed-body text-text-secondary">{vehicles.undecided.answer}</span>
          </p>
          <ActionLink href={vehicles.undecided.href} className="self-start sm:self-auto">
            {vehicles.undecided.cta}
          </ActionLink>
        </div>
      </div>
    </Chapter>
  );
}
