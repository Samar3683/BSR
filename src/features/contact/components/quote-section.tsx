import { ArrowRight, MessageCircle, Phone } from "lucide-react";
import type { CSSProperties } from "react";

import { RouteMarker } from "@/components/graphics/route-marker";
import { Container } from "@/components/layout/container";
import { Section } from "@/components/layout/section";
import { MediaFrame } from "@/components/media/media-frame";
import { ButtonLink } from "@/components/ui/button";
import { siteConfig } from "@/config/site";

import { quoteContent as quote } from "../config/quote-content";

/**
 * The close — the final scene. A departure at dawn fills the chapter under a
 * Carbon scrim (left-weighted from `lg`, where the text keeps to the left and
 * the vehicle stays clear on the right) and a faint green atmosphere; the page
 * darkens into it from the FAQ. Calm and powerful: the photograph pushes in
 * slowly as it is scrolled through (up to 8%) and drifts a few percent, while
 * the content stays still; the heading (up to 96px) is wiped in along its
 * line, the actions last. Instant under reduced motion.
 *
 * Colour roles: red for the request, white for WhatsApp, green only for the
 * small route above the heading (arriving on its red destination).
 */
export function QuoteSection() {
  const { contact } = siteConfig;
  return (
    <Section
      tone="carbon"
      spacing="lg"
      id={quote.id}
      data-conversion
      data-reveal="group"
      aria-labelledby={`${quote.id}-title`}
      className="relative isolate overflow-clip"
    >
      <div className="absolute inset-0 -z-10">
        <MediaFrame
          name="quote-background"
          media={quote.media}
          sizes="100vw"
          parallax
          scrollScale="push"
          decorative
          className="h-full"
        />
      </div>
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-linear-to-t from-background-primary/90 via-background-primary/60 to-background-primary/20 lg:bg-linear-to-r lg:from-background-primary/85 lg:via-background-primary/45 lg:to-background-primary/0"
      />
      {/* A subtle green atmosphere over the photograph, and the page darkening
          into the scene from the FAQ above. */}
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-green-800/25 mix-blend-multiply"
      />
      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-0 -z-10 h-[22%] bg-linear-to-b from-background-primary to-transparent"
      />
      <Container className="flex flex-col justify-center gap-8 lg:min-h-[min(34rem,58svh)]">
        <header data-reveal="editorial" className="flex max-w-[64rem] flex-col gap-6">
          <p className="flex items-center gap-3 type-label-sm text-success">
            <span aria-hidden="true" className="flex items-center gap-1.5">
              <RouteMarker />
              <span className="h-0.5 w-10 origin-left bg-success-graphic transition-[scale] delay-300 duration-700 ease-cinematic pending:scale-x-0" />
              <RouteMarker variant="destination" />
            </span>
            {quote.eyebrow}
          </p>
          <h2 id={`${quote.id}-title`} className="type-finale text-balance">
            {quote.title[0]} {quote.title[1]}
          </h2>
          <p className="type-lede text-text-secondary">{quote.body}</p>
        </header>
        <div
          data-reveal="rise"
          style={{ "--reveal-delay": "700ms" } as CSSProperties}
          className="flex flex-col gap-5"
        >
          <div className="flex flex-col gap-3 sm:flex-row">
            <ButtonLink
              href={quote.primary.href}
              size="lg"
              trailingIcon={ArrowRight}
              className="text-lg min-h-16 px-10 motion-safe:hover:scale-[1.04]"
            >
              {quote.primary.label}
            </ButtonLink>
            <ButtonLink
              href={quote.whatsapp.href}
              variant="inverse"
              size="lg"
              leadingIcon={MessageCircle}
            >
              {quote.whatsapp.label}
              <span className="sr-only"> {quote.whatsapp.hint}</span>
            </ButtonLink>
          </div>
          <div>
            <a
              href={contact.phoneHref}
              className="group/call inline-flex min-h-(--target-min) items-center gap-2 type-label-md text-text-secondary transition-ui hover:text-text-primary"
            >
              <Phone
                aria-hidden="true"
                strokeWidth={2}
                className="size-4 text-success transition-transform duration-200 motion-safe:group-hover/call:-rotate-12"
              />
              {quote.callLabel}
              <span className="text-text-primary tabular-nums">{contact.phoneDisplay}</span>
            </a>
          </div>
        </div>
      </Container>
    </Section>
  );
}
