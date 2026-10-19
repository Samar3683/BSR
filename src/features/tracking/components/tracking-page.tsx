import { Suspense } from "react";

import { Container } from "@/components/layout/container";
import { Eyebrow } from "@/components/layout/eyebrow";
import { Section } from "@/components/layout/section";
import { TextLink } from "@/components/ui/text-link";
import { siteConfig } from "@/config/site";

import { trackingContent as content } from "../config/tracking-content";
import { TrackingView } from "./tracking-view";

/** Tracking page (Server Component): the lookup form and what it finds. */
export function TrackingPage() {
  return (
    <Section
      tone="soft-white"
      spacing="md"
      aria-labelledby="tracking-title"
      className="pt-[calc(var(--header-height)+var(--spacing-section-sm))]"
    >
      <Container className="flex flex-col gap-10 lg:layout-grid lg:items-start lg:gap-y-0">
        <div className="flex flex-col gap-8 lg:col-span-8">
          <header className="flex flex-col gap-4">
            <Eyebrow>{content.eyebrow}</Eyebrow>
            <h1 id="tracking-title" className="type-title">
              {content.headline}
            </h1>
            <p className="max-w-text type-lede text-text-secondary">{content.intro}</p>
          </header>
          <Suspense fallback={null}>
            <TrackingView />
          </Suspense>
        </div>

        <aside
          aria-label={content.other.heading}
          className="flex flex-col gap-3 lg:col-span-3 lg:col-start-10 lg:pt-28"
        >
          <h2 className="type-heading-sm">{content.other.heading}</h2>
          <TextLink href="/contatti" variant="action" className="self-start">
            {content.other.message}
          </TextLink>
          <TextLink href={siteConfig.routes.quoteRequest} variant="action" className="self-start">
            {content.other.quote}
          </TextLink>
          <TextLink href="/" variant="action" className="self-start">
            {content.back}
          </TextLink>
        </aside>
      </Container>
    </Section>
  );
}
