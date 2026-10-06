import { Container } from "@/components/layout/container";
import { Eyebrow } from "@/components/layout/eyebrow";
import { Section } from "@/components/layout/section";

import { requestProcessContent as process } from "../config/request-process-content";
import { ShipmentJourney } from "./shipment-journey";

/**
 * How it works, on Soft White — the signature section: the shipment's journey
 * as a controlled system (ShipmentJourney). A statement heading, then a sticky
 * stage beside the four steps, driven by the reader's own scroll.
 */
export function RequestProcessSection() {
  return (
    <Section tone="soft-white" spacing="md" id={process.id} aria-labelledby={`${process.id}-title`}>
      <Container className="flex flex-col gap-10 lg:gap-14">
        <header data-reveal="editorial" className="flex max-w-[56rem] flex-col gap-5">
          <Eyebrow>{process.eyebrow}</Eyebrow>
          <h2 id={`${process.id}-title`} className="type-statement text-balance">
            {process.title}
          </h2>
          <p className="max-w-text type-lede text-text-secondary">{process.intro}</p>
        </header>
        <ShipmentJourney steps={process.steps} media={process.media} />
      </Container>
    </Section>
  );
}
