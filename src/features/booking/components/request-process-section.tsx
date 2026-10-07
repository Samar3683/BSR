import { ActionLink } from "@/components/editorial/action";
import { Chapter } from "@/components/editorial/chapter";
import { Label } from "@/components/editorial/label";

import { requestProcessContent as process } from "../config/request-process-content";
import { ShipmentJourney } from "./shipment-journey";

/**
 * Chapter 04 — "what happens after I contact you?", on Soft White. The
 * heading on the left, the promise and the request on the right; then the
 * journey: one photograph, one green route through the four steps, driven by
 * the reader's own scroll (ShipmentJourney).
 */
export function RequestProcessSection() {
  const titleId = `${process.id}-title`;
  return (
    <Chapter id={process.id} tone="soft-white" labelledBy={titleId} {...process.chapter}>
      <div className="flex flex-col gap-10 lg:gap-12">
        <header className="ed-grid gap-y-5">
          <div data-reveal="rise" className="col-span-4 flex flex-col gap-5 md:col-span-8 lg:col-span-9">
            <Label>{process.label}</Label>
            <h2 id={titleId} className="ed-h2 text-balance">
              {process.title}
            </h2>
          </div>
          <div className="col-span-4 flex flex-col items-start gap-5 md:col-span-6 lg:col-span-5 lg:col-start-12 lg:self-end">
            <p className="max-w-[38rem] ed-body text-text-secondary">{process.intro}</p>
            <ActionLink href={process.action.href}>{process.action.label}</ActionLink>
          </div>
        </header>
        <ShipmentJourney steps={process.steps} media={process.media} stageLabel={process.stageLabel} />
      </div>
    </Chapter>
  );
}
