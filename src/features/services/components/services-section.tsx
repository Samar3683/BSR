import { ArrowRight } from "lucide-react";

import { Container } from "@/components/layout/container";
import { Section } from "@/components/layout/section";
import { SectionHeader } from "@/components/layout/section-header";
import { MediaFrame } from "@/components/media/media-frame";
import { ButtonLink } from "@/components/ui/button";
import { cx } from "@/lib/utils/cx";

import { servicesContent as services } from "../config/services-content";
import { LaneTrack } from "./lane-track";

/**
 * The service's action: outlined at rest, red while the lane is hovered or
 * holds focus (the one action the reader is weighing); red on touch screens.
 * `!`: these win over the outline variant's own colours.
 */
const ACTION =
  "group-hover/lane:border-action-primary! group-hover/lane:bg-action-primary! group-hover/lane:text-on-action-primary! " +
  "group-focus-within/lane:border-action-primary! group-focus-within/lane:bg-action-primary! group-focus-within/lane:text-on-action-primary! " +
  "[@media(hover:none)]:border-action-primary! [@media(hover:none)]:bg-action-primary! [@media(hover:none)]:text-on-action-primary!";

/** Height of the photograph on large screens (the lane line and the stripe are placed from it). */
const PHOTO = "md:h-[min(24rem,44svh)]";

/**
 * Services, on White — the decision point: two ways of moving, as two
 * transport lanes side by side, entering from opposite sides.
 *
 * - Express is the energetic lane: a diagonal-cut photograph with a green
 *   speed stripe. Dedicated is the controlled one: a square photograph in a
 *   thin inset frame, a double rule.
 * - Hovering or focusing a lane widens it ≈ 10% (the other eases back and
 *   loses some colour — styles/motion.css `.lanes`), scales its photograph
 *   1.03 and runs its green lane line out to the end. The first sentence
 *   leads, the rest is secondary — nothing is hidden.
 * - On phones the lanes are a swipe track with pagination (LaneTrack).
 */
export function ServicesSection() {
  return (
    <Section
      tone="white"
      spacing="md"
      id={services.id}
      aria-labelledby={`${services.id}-title`}
      className="overflow-x-clip"
    >
      <Container className="flex flex-col gap-10 lg:gap-12">
        <SectionHeader
          id={`${services.id}-title`}
          eyebrow={services.eyebrow}
          title={services.title}
          intro={services.intro}
        />
        <LaneTrack labels={services.items.map((item) => item.title)} groupLabel="Scegli il servizio">
          {services.items.map((item) => {
            const express = item.id === "espresso";
            return (
              <article
                key={item.id}
                id={item.id}
                data-lane
                aria-labelledby={`${item.id}-title`}
                data-reveal={express ? "lane-left" : "lane-right"}
                className="lane group/lane group/media relative min-w-0 shrink-0 basis-[86%] snap-center border border-border-strong bg-background-secondary md:flex-1 md:basis-0"
              >
                <div className="flex h-full flex-col">
                  <MediaFrame
                    name={`service-${item.id}`}
                    media={item.media}
                    sizes="(min-width: 64rem) 46vw, 86vw"
                    zoom
                    className={cx(
                      "aspect-[4/3] md:aspect-auto",
                      express
                        ? cx(PHOTO, "md:[clip-path:polygon(0_0,100%_0,100%_90%,0_100%)]")
                        : "md:mx-3 md:mt-3 md:h-[calc(min(24rem,44svh)-0.75rem)]",
                    )}
                  />
                  {express ? (
                    <span
                      aria-hidden="true"
                      className="absolute right-0 hidden h-1 w-2/3 bg-success-graphic md:top-[min(21.6rem,39.6svh)] md:block"
                    />
                  ) : (
                    <span
                      aria-hidden="true"
                      className="pointer-events-none absolute top-6 right-6 left-6 hidden h-[calc(min(24rem,44svh)-3rem)] border border-white/70 md:block"
                    />
                  )}

                  <div className="flex flex-1 flex-col gap-4 p-5 sm:p-7">
                    <p className="flex items-center gap-3 type-label-sm text-success">
                      <span aria-hidden="true" className="h-0.5 w-8 bg-success-graphic" />
                      <span className="tabular-nums">{item.code}</span>
                      {item.label}
                    </p>
                    <h3 id={`${item.id}-title`} className="type-heading-lg">
                      {item.title}
                    </h3>
                    <p className="text-lg leading-snug font-semibold sm:text-xl">{item.message}</p>
                    <p className="max-w-[44ch] text-[1.0625rem] leading-relaxed text-text-secondary">
                      {item.body}
                    </p>
                    <dl className="mt-auto grid grid-cols-3 gap-x-4 border-t border-border-default pt-4">
                      {item.facts.map((fact) => (
                        <div key={fact.label} className="flex flex-col-reverse justify-end gap-1">
                          <dt className="text-sm text-text-muted">{fact.label}</dt>
                          <dd className="text-base font-semibold tabular-nums">{fact.value}</dd>
                        </div>
                      ))}
                    </dl>
                    <div className="pt-1">
                      <ButtonLink
                        href={item.action.href}
                        variant="secondary"
                        size="lg"
                        trailingIcon={ArrowRight}
                        className={ACTION}
                      >
                        {item.action.label}
                        <span className="sr-only"> {item.action.context}</span>
                      </ButtonLink>
                    </div>
                  </div>

                  {/* The lane line: part of the way at rest, to the end while the lane is in play. */}
                  <span aria-hidden="true" className="relative block h-1.5 bg-border-default">
                    <span
                      className={cx(
                        "absolute inset-y-0 left-0 w-full origin-left bg-success-graphic transition-[scale] duration-700 ease-cinematic group-focus-within/lane:scale-x-100 group-hover/lane:scale-x-100 motion-reduce:transition-none",
                        express ? "scale-x-[0.35]" : "scale-x-[0.2]",
                      )}
                    />
                    {!express && (
                      <span className="absolute inset-x-0 top-0.5 h-px bg-background-secondary" />
                    )}
                  </span>
                </div>
              </article>
            );
          })}
        </LaneTrack>
      </Container>
    </Section>
  );
}
