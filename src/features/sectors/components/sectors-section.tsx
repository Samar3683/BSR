import { Chapter } from "@/components/editorial/chapter";
import { Label } from "@/components/editorial/label";

import { sectorsContent as sectors } from "../config/sectors-content";
import { SectorExplorer } from "./sector-explorer";

/**
 * Chapter 03 — "is BSR relevant to me?", on White. The question on the left,
 * how to use the list on the right; then the four sectors as a large list
 * beside one photographic stage that reframes for the row in play
 * (SectorExplorer). Each row opens the request with its sector noted.
 */
export function SectorsSection() {
  const titleId = `${sectors.id}-title`;
  return (
    <Chapter id={sectors.id} tone="white" labelledBy={titleId} {...sectors.chapter}>
      <div className="flex flex-col gap-10 lg:gap-12">
        <header className="ed-grid gap-y-5">
          <div data-reveal="rise" className="col-span-4 flex flex-col gap-5 md:col-span-8 lg:col-span-9">
            <Label>{sectors.label}</Label>
            <h2 id={titleId} className="ed-h2 text-balance">
              {sectors.title}
            </h2>
          </div>
          <p className="col-span-4 max-w-[38rem] ed-body text-text-secondary md:col-span-6 lg:col-span-5 lg:col-start-12 lg:self-end">
            {sectors.intro}
          </p>
        </header>
        <SectorExplorer
          sectors={sectors.items}
          stage={sectors.stage}
          link={{ label: sectors.linkLabel, for: sectors.linkFor }}
        />
      </div>
    </Chapter>
  );
}
