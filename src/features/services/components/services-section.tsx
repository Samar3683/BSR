import { Chapter } from "@/components/editorial/chapter";
import { Label } from "@/components/editorial/label";

import { servicesContent as services } from "../config/services-content";
import { ServiceStage } from "./service-stage";

/**
 * Chapter 02 — what BSR does, on Soft White: two ways of moving, one contact.
 * The heading on the left, the choice explained on the right; then the two
 * service stories beside one cinematic stage that follows the service in
 * play (ServiceStage), and the route both services run.
 */
export function ServicesSection() {
  const titleId = `${services.id}-title`;
  return (
    <Chapter id={services.id} tone="soft-white" labelledBy={titleId} {...services.chapter}>
      <div className="flex flex-col gap-8 lg:gap-10">
        <header className="ed-grid gap-y-5">
          <div data-reveal="rise" className="col-span-4 flex flex-col gap-5 md:col-span-8 lg:col-span-10">
            <Label>{services.label}</Label>
            <h2 id={titleId} className="ed-h2 text-balance">
              {services.title[0]} <span className="text-success">{services.title[1]}</span>
            </h2>
          </div>
          <p className="col-span-4 max-w-[38rem] ed-body text-text-secondary md:col-span-6 lg:col-span-5 lg:col-start-12 lg:self-end">
            {services.intro}
          </p>
        </header>
        <ServiceStage
          items={services.items}
          connector={services.connector}
          stageLabel={services.stageLabel}
        />
      </div>
    </Chapter>
  );
}
