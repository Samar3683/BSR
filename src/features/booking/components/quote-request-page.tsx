import { Suspense } from "react";

import { RouteMarker } from "@/components/graphics/route-marker";
import { Container } from "@/components/layout/container";
import { Eyebrow } from "@/components/layout/eyebrow";
import { Section } from "@/components/layout/section";
import { TextLink } from "@/components/ui/text-link";
import { siteConfig } from "@/config/site";
import { coverage } from "@/config/site-content";

import { quoteRequestContent as content } from "../config/quote-request-content";
import { QuoteComposer } from "./quote-composer";
import { QuoteComposerFromUrl } from "./quote-composer-from-url";

/**
 * Quote-request page (Server Component) — the continuation of the home page's
 * request form, in its visual language (Soft White, a green eyebrow, the
 * section title style, a flat white panel). Left: the composer, filled with
 * whatever the home page passed (QuoteComposerFromUrl; the empty composer is
 * the prerendered fallback, same layout). Right: what happens next, where BSR
 * operates, the direct contacts. The request is sent from the composer: see quote-composer.tsx.
 */
export function QuoteRequestPage() {
  const { contact } = siteConfig;
  return (
    <Section
      tone="soft-white"
      spacing="md"
      aria-labelledby="quote-request-title"
      className="pt-[calc(var(--header-height)+var(--spacing-section-sm))]"
    >
      <Container className="flex flex-col gap-10 lg:layout-grid lg:items-start lg:gap-y-0">
        <div className="flex flex-col gap-8 lg:col-span-7">
          <header className="flex flex-col gap-4">
            <Eyebrow>{content.eyebrow}</Eyebrow>
            <h1 id="quote-request-title" className="type-title">
              {content.headline}
            </h1>
            <p className="max-w-text type-lede text-text-secondary">{content.intro}</p>
          </header>
          <div className="bg-background-secondary p-6 sm:p-8" data-slot="quote-request-form">
            <Suspense fallback={<QuoteComposer initial={{}} />}>
              <QuoteComposerFromUrl />
            </Suspense>
          </div>
        </div>

        <aside
          aria-label={content.next.heading}
          className="flex flex-col gap-8 lg:col-span-4 lg:col-start-9 lg:pt-28"
        >
          <section aria-labelledby="quote-next" className="flex flex-col gap-4">
            <h2 id="quote-next" className="type-heading-sm">
              {content.next.heading}
            </h2>
            <ol className="flex flex-col border-t border-border-default">
              {content.next.items.map((step, i) => (
                <li
                  key={step}
                  className="grid grid-cols-[2rem_1fr] gap-2 border-b border-border-default py-3 type-body-sm"
                >
                  <span aria-hidden="true" className="type-metadata text-success tabular-nums">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </section>

          <section aria-labelledby="quote-coverage" className="flex flex-col gap-3">
            <h2 id="quote-coverage" className="type-heading-sm">
              {content.coverage.heading}
            </h2>
            <p className="flex items-center gap-2.5 type-body-sm text-text-secondary">
              <RouteMarker />
              {coverage.italy}
            </p>
            <ul className="flex flex-wrap gap-x-4 gap-y-1 type-body-sm text-text-secondary">
              {coverage.europe.map((route) => (
                <li key={route.country}>{route.country}</li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="quote-contacts" className="flex flex-col gap-2">
            <h2 id="quote-contacts" className="type-heading-sm">
              {content.contactsHeading}
            </h2>
            <p className="flex flex-col type-body-sm">
              <TextLink
                href={contact.phoneHref}
                className="inline-flex min-h-8 items-center self-start tabular-nums"
              >
                {contact.phoneDisplay}
              </TextLink>
              <TextLink
                href={`mailto:${contact.email}`}
                className="inline-flex min-h-8 items-center self-start"
              >
                {contact.email}
              </TextLink>
            </p>
          </section>

          <TextLink href="/" variant="action" className="self-start">
            {content.back}
          </TextLink>
        </aside>
      </Container>
    </Section>
  );
}
