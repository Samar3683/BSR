import { Container } from "@/components/layout/container";
import { Eyebrow } from "@/components/layout/eyebrow";
import { Section } from "@/components/layout/section";
import { TextLink } from "@/components/ui/text-link";
import { siteConfig } from "@/config/site";

import { privacyContent as content } from "../config/privacy-content";

/**
 * Privacy and cookie notice (Server Component): a reading page on Soft White,
 * in a text measure. The controller block and the contacts come from
 * siteConfig — the single source of the company's details.
 */
export function PrivacyPage() {
  const { contact, company } = siteConfig;
  const { address } = company;
  const controller = (
    <address className="type-body-md text-text-secondary not-italic">
      {company.legalName} · {address.streetFull}, {address.postalCode} {address.locality} (
      {address.province}), {address.country}
      <br />
      P. IVA {company.vatNumber} · REA {company.rea}
      <br />
      <TextLink href={contact.phoneHref}>{contact.phoneDisplay}</TextLink> ·{" "}
      <TextLink href={`mailto:${contact.email}`}>{contact.email}</TextLink> · PEC{" "}
      <TextLink href={`mailto:${contact.pec}`}>{contact.pec}</TextLink>
    </address>
  );

  return (
    <Section
      tone="soft-white"
      spacing="md"
      aria-labelledby="privacy-title"
      className="pt-[calc(var(--header-height)+var(--spacing-section-sm))]"
    >
      <Container size="text-wide" className="flex flex-col gap-10">
        <header className="flex flex-col gap-4">
          <Eyebrow>{content.eyebrow}</Eyebrow>
          <h1 id="privacy-title" className="type-title">
            {content.title}
          </h1>
          <p className="max-w-text type-lede text-text-secondary">{content.intro}</p>
          <p className="type-caption text-text-muted">{content.updated}</p>
        </header>

        {content.sections.map((section) => (
          <section key={section.heading} className="flex flex-col gap-3 border-t border-border-default pt-6">
            <h2 className="type-heading-md">{section.heading}</h2>
            {section.controller && controller}
            {section.body?.map((paragraph) => (
              <p key={paragraph} className="max-w-text type-body-md text-text-secondary">
                {paragraph}
              </p>
            ))}
          </section>
        ))}

        <TextLink href="/" variant="action" className="self-start">
          {content.back}
        </TextLink>
      </Container>
    </Section>
  );
}
