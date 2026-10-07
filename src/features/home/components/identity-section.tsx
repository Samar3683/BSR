import { MessageCircle } from "lucide-react";

import { CountUp } from "@/components/data/count-up";
import { ActionLink } from "@/components/editorial/action";
import { Chapter } from "@/components/editorial/chapter";
import { Label } from "@/components/editorial/label";
import { RouteLine } from "@/components/editorial/route-line";
import { siteConfig } from "@/config/site";
import { siteNavigation as nav } from "@/features/site/config/site-navigation";

import { homeContent } from "../config/home-content";

/**
 * Chapter 01 — what BSR is, straight after the hero, on White. The visitor
 * should know in about five seconds: express and dedicated transport, Italy
 * and the main European routes, one contact.
 *
 * Left: the label (BSR Trasporti · Carpi), the statement in technical capitals,
 * the one-line promise, the request and WhatsApp. Right: the proof as
 * technical data, stacked on hairlines — a figure, a mono label, one line —
 * counting up once in sequence. Under both, the route from the base to its
 * reach draws in green and arrives on red. Reduced motion: all in place.
 */
export function IdentitySection() {
  const identity = homeContent.identity;
  const { contact } = siteConfig;
  const titleId = `${identity.id}-title`;

  return (
    <Chapter id={identity.id} tone="white" labelledBy={titleId} {...identity.chapter}>
      <div className="ed-grid gap-y-12">
        <div className="col-span-4 flex flex-col gap-7 md:col-span-8 lg:col-span-8 xl:col-span-9">
          <div data-reveal="rise" className="flex flex-col gap-5">
            <Label>{identity.label}</Label>
            <h2 id={titleId} className="flex flex-col gap-3">
              <span className="ed-statement text-balance">{identity.title[0]}</span>
              <span className="max-w-[24ch] ed-h3 text-balance text-text-secondary">{identity.title[1]}</span>
            </h2>
          </div>
          <div data-reveal="rise" className="flex max-w-[34rem] flex-col gap-2">
            <p className="ed-lede text-text-primary">{identity.support}</p>
            <p className="ed-small text-text-secondary">{identity.body}</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <ActionLink href={nav.cta.href} size="lg">
              {nav.cta.label}
            </ActionLink>
            <ActionLink
              href={contact.whatsappHref}
              variant="outline"
              size="lg"
              leadingIcon={MessageCircle}
              icon={null}
            >
              {identity.whatsapp}
              <span className="sr-only"> {identity.whatsappHint}</span>
            </ActionLink>
          </div>
        </div>

        <div className="col-span-4 md:col-span-8 lg:col-span-7 lg:col-start-10 xl:col-span-6 xl:col-start-11">
          <h3 className="sr-only">{identity.metricsLabel}</h3>
          <dl className="grid grid-cols-2 gap-x-(--spacing-col-gap) border-b border-hairline lg:grid-cols-1">
            {identity.metrics.map((metric, i) => (
              <div
                key={metric.label}
                className="grid grid-cols-1 content-start gap-1.5 border-t border-hairline py-4 xl:grid-cols-[minmax(0,12.5rem)_1fr] xl:items-center xl:gap-x-6 xl:py-3.5"
              >
                <dt className="ed-label text-text-primary xl:col-start-2 xl:row-start-1 xl:self-end">
                  {metric.label}
                </dt>
                <dd className="order-first flex items-baseline gap-1.5 ed-stat text-text-primary xl:order-none xl:col-start-1 xl:row-span-2 xl:row-start-1">
                  <CountUp value={metric.value} delay={i * 180} />
                  {"unit" in metric && <span className="ed-label text-success">{metric.unit}</span>}
                </dd>
                <dd className="ed-small text-text-secondary xl:col-start-2 xl:row-start-2 xl:self-start">
                  {metric.detail}
                </dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 ed-meta text-text-secondary">{identity.metricsNote}</p>
        </div>

        <RouteLine stops={identity.route} delay={300} className="col-span-4 md:col-span-8 lg:col-span-16" />
      </div>
    </Chapter>
  );
}
