import { Container } from "@/components/layout/container";
import { Eyebrow } from "@/components/layout/eyebrow";
import { Section } from "@/components/layout/section";
import { TextLink } from "@/components/ui/text-link";
import { siteConfig } from "@/config/site";

import { messageContent as content } from "../config/message-content";
import { MessageForm } from "./message-form";

/** "Scrivici un messaggio" page (Server Component): the form and the direct contacts. */
export function MessagePage() {
  const { contact } = siteConfig;
  return (
    <Section
      tone="soft-white"
      spacing="md"
      aria-labelledby="message-title"
      className="pt-[calc(var(--header-height)+var(--spacing-section-sm))]"
    >
      <Container className="flex flex-col gap-10 lg:layout-grid lg:items-start lg:gap-y-0">
        <div className="flex flex-col gap-8 lg:col-span-7">
          <header className="flex flex-col gap-4">
            <Eyebrow>{content.eyebrow}</Eyebrow>
            <h1 id="message-title" className="type-title">
              {content.headline}
            </h1>
            <p className="max-w-text type-lede text-text-secondary">{content.intro}</p>
          </header>
          <div className="bg-background-secondary p-6 sm:p-8">
            <MessageForm />
          </div>
        </div>

        <aside
          aria-label={content.other.heading}
          className="flex flex-col gap-4 lg:col-span-4 lg:col-start-9 lg:pt-28"
        >
          <h2 className="type-heading-sm">{content.other.heading}</h2>
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
          <TextLink href={siteConfig.routes.quoteRequest} variant="action" className="self-start">
            {content.other.quote}
          </TextLink>
          <TextLink href="/tracciamento" variant="action" className="self-start">
            {content.other.track}
          </TextLink>
        </aside>
      </Container>
    </Section>
  );
}
