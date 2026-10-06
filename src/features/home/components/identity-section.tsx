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

import { homeContent } from "../config/home-content";

/**
 * Who BSR is, straight after the hero, on Soft White — the credibility
 * statement: "can I trust these people with my shipment?" One dominant line
 * (up to 72px, about half the width, on a vertical green marker that runs in
 * from the hero's route), then the four figures set large (56–96px) on thin
 * rules, each opened by a green bar, and last the explanation and the way in.
 *
 * Motion is editorial and precise, not the hero's: the statement is wiped in
 * slowly along its line; the figures count up once, one after another (200 ms
 * apart), beginning slightly transparent. Reduced motion: all in place.
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
      <Container className="flex flex-col gap-12 lg:gap-16">
        <div data-reveal="group" className="relative max-w-[40rem] pl-6 sm:pl-8 lg:max-w-[46rem]">
          {/* The vertical marker: runs down alongside the statement. */}
          <span
            aria-hidden="true"
            className="absolute inset-y-0 left-0 w-1 origin-top bg-success-graphic transition-[scale] duration-[1400ms] ease-cinematic pending:scale-y-0"
          />
          <div data-reveal="editorial" className="flex flex-col gap-5">
            <Eyebrow>{identity.eyebrow}</Eyebrow>
            <h2 id={`${identity.id}-title`} className="type-statement">
              {identity.title[0]}
              <br />
              <span className="text-success">{identity.title[1]}</span>
            </h2>
          </div>
        </div>

        <dl
          aria-label={identity.metricsLabel}
          className="grid grid-cols-2 gap-x-6 gap-y-10 xl:grid-cols-4 xl:gap-x-10"
        >
          {identity.metrics.map((metric, i) => (
            // dt before dd in the markup; the figure is shown first.
            <div
              key={metric.label}
              data-reveal="group"
              style={{ "--d": `${i * 200}ms` } as CSSProperties}
              className="flex flex-col-reverse justify-end gap-4 border-t border-border-strong pt-5"
            >
              <dt className="flex flex-col gap-1">
                <span className="text-base font-semibold sm:text-[1.0625rem]">{metric.label}</span>
                <span className="max-w-[28ch] text-[0.9375rem] leading-snug text-text-secondary">
                  {metric.detail}
                </span>
              </dt>
              <dd className="flex flex-col gap-4">
                <span aria-hidden="true" className="flex items-center gap-2">
                  <span className="relative size-2.5 rounded-full bg-success-graphic transition-[scale] delay-(--d) duration-500 ease-enter pending:scale-0">
                    <span className="absolute inset-0 rounded-full bg-success-graphic opacity-0 motion-safe:[[data-inview]_&]:animate-[pulse-once_1.4s_var(--ease-enter)_var(--d)_1]" />
                  </span>
                  <span className="h-1 w-12 origin-left bg-success-graphic transition-[scale] delay-(--d) duration-700 ease-cinematic pending:scale-x-0" />
                </span>
                <span className="flex items-baseline gap-2 whitespace-nowrap">
                  <CountUp value={metric.value} delay={i * 200} className="type-figure" />
                  {"unit" in metric && (
                    <span className="type-heading-md text-success">{metric.unit}</span>
                  )}
                </span>
              </dd>
            </div>
          ))}
        </dl>

        <div className="flex max-w-[46rem] flex-col gap-6">
          <p className="type-lede text-text-secondary">{identity.body}</p>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            <ButtonLink href={nav.cta.href} size="lg" trailingIcon={ArrowRight}>
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
      </Container>
    </Section>
  );
}
