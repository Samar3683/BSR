import { Container } from "@/components/layout/container";
import { Eyebrow } from "@/components/layout/eyebrow";
import { Section } from "@/components/layout/section";

import { sectorsContent as sectors } from "../config/sectors-content";
import { SectorExplorer } from "./sector-explorer";

/**
 * The load, on Warm White — "what exactly are we trusted to move?" A large
 * statement over an editorial composition: the sectors as rows on the left,
 * and the cargo photograph breaking the grid, running off the right edge of
 * the page (SectorExplorer). Loading-bay motion: the picture opens from the
 * centre like a door, then eases from 1.07 to rest as it is scrolled past —
 * and only 1–2% after that.
 */
export function SectorsSection() {
  return (
    <Section
      tone="warm-white"
      spacing="md"
      id={sectors.id}
      aria-labelledby={`${sectors.id}-title`}
      className="overflow-x-clip"
    >
      <Container className="flex flex-col gap-10 lg:gap-14">
        <header data-reveal="editorial" className="flex max-w-[56rem] flex-col gap-5">
          <Eyebrow>{sectors.eyebrow}</Eyebrow>
          <h2 id={`${sectors.id}-title`} className="type-statement text-balance">
            {sectors.title}
          </h2>
          <p className="max-w-text type-lede text-text-secondary">{sectors.intro}</p>
        </header>
        <SectorExplorer
          sectors={sectors.items}
          stage={sectors.stage}
          link={{ label: sectors.linkLabel, for: sectors.linkFor }}
        />
      </Container>
    </Section>
  );
}
