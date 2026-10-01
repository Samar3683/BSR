import { Container } from "@/components/layout/container";
import { Section } from "@/components/layout/section";
import { SectionHeader } from "@/components/layout/section-header";
import { TextLink } from "@/components/ui/text-link";

import { vehiclesContent as vehicles } from "../config/vehicles-content";
import { VehicleSelector } from "./vehicle-selector";

/**
 * Fleet, on White: BSR assigns the vehicle to the shipment — so the
 * chapter is a selector (VehicleSelector), not a catalogue. One media stage,
 * three types (van first; nothing truck-led), each with its use case, only
 * the verified figures, and its technical elevation. Photographs come from
 * content (`MediaSlot`): the fleet's new imagery drops in without layout work.
 */
export function VehiclesSection() {
  return (
    <Section
      tone="white"
      spacing="md"
      id={vehicles.id}
      aria-labelledby={`${vehicles.id}-title`}
    >
      <Container className="flex flex-col gap-8 lg:gap-10">
        <SectionHeader
          id={`${vehicles.id}-title`}
          eyebrow={vehicles.eyebrow}
          title={vehicles.title}
          intro={vehicles.intro}
        />
        <VehicleSelector
          categories={vehicles.categories}
          label={vehicles.selectorLabel}
          capacity={vehicles.capacity}
        />
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 type-body-md text-text-secondary">
          <span className="type-label-md text-text-primary">{vehicles.undecided.question}</span>
          {vehicles.undecided.answer}
          <TextLink variant="action" href={vehicles.undecided.href}>
            {vehicles.undecided.cta}
          </TextLink>
        </p>
      </Container>
    </Section>
  );
}
