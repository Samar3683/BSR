import { Container } from "@/components/layout/container";
import { Section } from "@/components/layout/section";
import { SectionHeader } from "@/components/layout/section-header";

import { requestProcessContent as process } from "../config/request-process-content";
import { ShipmentJourney } from "./shipment-journey";

/**
 * How it works, on Soft White: the request flow as one shipment's journey
 * (ShipmentJourney) — one wide photograph of a load going on, its bottom edge
 * the route, and the four steps switching on in turn as the green line fills.
 */
export function RequestProcessSection() {
  return (
    <Section
      tone="soft-white"
      spacing="md"
      id={process.id}
      aria-labelledby={`${process.id}-title`}
    >
      <Container className="flex flex-col gap-8 lg:gap-10">
        <SectionHeader
          id={`${process.id}-title`}
          eyebrow={process.eyebrow}
          title={process.title}
          intro={process.intro}
        />
        <ShipmentJourney steps={process.steps} media={process.media} />
      </Container>
    </Section>
  );
}
