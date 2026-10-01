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
 * The close, on a photograph — the story arriving. A departure at dawn fills
 * the chapter under a light Carbon scrim (left-weighted from `lg`, where the
 * text keeps to the left and the vehicle stays clear on the right). As the
 * chapter enters, the picture settles from 1.03 to rest and the heading, then
 * the actions, rise into place (≈ 0.9 s; instant under reduced motion).
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
          settle
          decorative
          className="h-full"
        />
      </div>
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-linear-to-t from-background-primary/90 via-background-primary/60 to-background-primary/20 lg:bg-linear-to-r lg:from-background-primary/85 lg:via-background-primary/45 lg:to-background-primary/0"
      />
      <Container className="flex flex-col justify-center gap-8 lg:min-h-[min(34rem,58svh)]">
        <header data-reveal="rise" className="flex max-w-text flex-col gap-5">
          <p className="flex items-center gap-3 type-label-sm text-success">
            <span aria-hidden="true" className="flex items-center gap-1.5">
              <RouteMarker />
              <span className="h-0.5 w-10 origin-left bg-success-graphic transition-[scale] delay-300 duration-700 ease-cinematic pending:scale-x-0" />
              <RouteMarker variant="destination" />
            </span>
            {quote.eyebrow}
          </p>
          <h2 id={`${quote.id}-title`} className="type-title-lg text-balance">
            {quote.title[0]} {quote.title[1]}
          </h2>
          <p className="type-lede text-text-secondary">{quote.body}</p>
        </header>
        <div
          data-reveal="rise"
          style={{ "--reveal-delay": "150ms" } as CSSProperties}
          className="flex flex-col gap-5"
        >
          <div className="flex flex-col gap-3 sm:flex-row">
            <ButtonLink href={quote.primary.href} size="lg" trailingIcon={ArrowRight}>
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
