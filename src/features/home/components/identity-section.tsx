import { ArrowRight, MessageCircle } from "lucide-react";
import type { CSSProperties } from "react";

import { CountUp } from "@/components/data/count-up";
import { RouteMarker } from "@/components/graphics/route-marker";
import { Container } from "@/components/layout/container";
import { Eyebrow } from "@/components/layout/eyebrow";
import { Section } from "@/components/layout/section";
import { ButtonLink } from "@/components/ui/button";
import { siteConfig } from "@/config/site";
import { siteNavigation as nav } from "@/features/site/config/site-navigation";
import { cx } from "@/lib/utils/cx";

import { homeContent } from "../config/home-content";

/**
 * Who BSR is, straight after the hero, on Soft White — the company
 * introducing itself. On the left the promise in two lines (the second in the
 * brand green), one sentence, the way to start, the base. On the right an
 * operational dashboard: four figures on thin dividers — no boxes, no cards —
 * each with a green indicator that switches on as the dashboard enters (the
 * dot pulses once, its bar draws) while the figure counts up once.
 */
export function IdentitySection() {
  const identity = homeContent.identity;
  const { contact } = siteConfig;
  return (
    <Section
      tone="soft-white"
      spacing="md"
      id={identity.id}
      aria-labelledby={`${identity.id}-title`}
    >
      <Container className="flex flex-col gap-12 lg:layout-grid lg:items-center">
        <div data-reveal="rise" className="flex flex-col gap-6 lg:col-span-5">
          <Eyebrow>{identity.eyebrow}</Eyebrow>
          <h2 id={`${identity.id}-title`} className="type-title-lg">
            {identity.title[0]}
            <br />
            <span className="text-success">{identity.title[1]}</span>
          </h2>
          <p className="max-w-text type-lede text-text-secondary">{identity.body}</p>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            <ButtonLink href={nav.cta.href} trailingIcon={ArrowRight}>
              {nav.cta.label}
            </ButtonLink>
            <a
              href={contact.whatsappHref}
              className="group/wa inline-flex min-h-(--target-min) items-center gap-2 type-label-md text-text-primary transition-ui hover:text-success"
            >
              <MessageCircle
                aria-hidden="true"
                className="size-4 transition-transform duration-200 motion-safe:group-hover/wa:-rotate-12"
                strokeWidth={2}
              />
              {identity.whatsapp}
              <span className="sr-only"> {nav.menu.whatsappHint}</span>
            </a>
          </div>
          <p className="flex items-center gap-3 type-label-sm text-text-muted">
            <RouteMarker />
            {identity.base}
          </p>
        </div>

        <div data-reveal="group" className="lg:col-span-7 lg:col-start-6">
          <p className="flex items-center justify-between border-b border-border-strong pb-3 type-label-sm text-text-muted">
            <span className="text-text-primary">{identity.metricsLabel}</span>
            <span>{identity.metricsNote}</span>
          </p>
          <dl aria-label={identity.metricsLabel} className="grid grid-cols-2">
            {identity.metrics.map((metric, i) => (
              // dt before dd in the markup; the figure is shown first.
              <div
                key={metric.label}
                style={{ "--d": `${i * 120}ms` } as CSSProperties}
                className={cx(
                  "flex flex-col-reverse justify-end gap-3 py-6 sm:py-8",
                  i % 2 === 0 ? "border-r border-border-default pr-4 sm:pr-8" : "pl-4 sm:pl-8",
                  i < 2 && "border-b border-border-default",
                )}
              >
                <dt className="flex flex-col gap-1">
                  <span className="type-label-md">{metric.label}</span>
                  <span className="max-w-[30ch] type-caption text-text-muted">{metric.detail}</span>
                </dt>
                <dd className="flex flex-col gap-4">
                  <span aria-hidden="true" className="flex items-center gap-2">
                    <span className="relative size-2 rounded-full bg-success-graphic transition-[scale] delay-(--d) duration-500 ease-enter pending:scale-0">
                      <span className="absolute inset-0 rounded-full bg-success-graphic opacity-0 motion-safe:[[data-inview]_&]:animate-[pulse-once_1.4s_var(--ease-enter)_var(--d)_1]" />
                    </span>
                    <span className="h-0.5 w-10 origin-left bg-success-graphic transition-[scale] delay-(--d) duration-700 ease-cinematic pending:scale-x-0" />
                  </span>
                  <span className="flex items-baseline gap-2 whitespace-nowrap">
                    <CountUp value={metric.value} className="type-metric" />
                    {"unit" in metric && (
                      <span className="type-heading-sm text-text-secondary">{metric.unit}</span>
                    )}
                  </span>
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </Container>
    </Section>
  );
}
