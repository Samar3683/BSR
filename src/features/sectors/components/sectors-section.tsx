import { Container } from "@/components/layout/container";
import { Section } from "@/components/layout/section";
import { SectionHeader } from "@/components/layout/section-header";

import { sectorsContent as sectors } from "../config/sectors-content";
import { SectorExplorer } from "./sector-explorer";

/**
 * Who relies on BSR, on Warm White: the sectors as interactive rows beside one
 * preview stage (SectorExplorer) — recognisable at a glance, each a way into
 * the request with its sector already noted.
 */
export function SectorsSection() {
  return (
    <Section
      tone="warm-white"
      spacing="md"
      id={sectors.id}
      aria-labelledby={`${sectors.id}-title`}
    >
      <Container className="flex flex-col gap-8 lg:gap-10">
        <SectionHeader
          id={`${sectors.id}-title`}
          eyebrow={sectors.eyebrow}
          title={sectors.title}
          intro={sectors.intro}
        />
        <SectorExplorer
          sectors={sectors.items}
          stage={sectors.stage}
          link={{ label: sectors.linkLabel, for: sectors.linkFor }}
        />
      </Container>
    </Section>
  );
}
