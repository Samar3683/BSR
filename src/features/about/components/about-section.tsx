import { type LucideIcon, Mail, MessageCircle, Phone, ShieldCheck } from "lucide-react";
import type { ReactNode } from "react";

import { Container } from "@/components/layout/container";
import { Section } from "@/components/layout/section";
import { SectionHeader } from "@/components/layout/section-header";
import { MediaFrame } from "@/components/media/media-frame";
import { siteConfig } from "@/config/site";

import { aboutContent as about } from "../config/about-content";

/**
 * Who we are and how to reach us, on Soft White — documentary, not a profile
 * card. A large photograph (illustrative, and captioned so), and beside it
 * what BSR is, the titolare, every channel as one aligned list (the site's
 * "Contatti" anchor; icons nudge on hover), then the company data on a thin
 * rule. Nothing here is invented (see about-content.ts).
 */
export function AboutSection() {
  const { contact, company } = siteConfig;
  const { address } = company;
  return (
    <Section tone="soft-white" spacing="md" id={about.id} aria-labelledby={`${about.id}-title`}>
      <Container className="flex flex-col gap-10 lg:layout-grid lg:items-center lg:gap-y-0">
        <MediaFrame
          name="about-portrait"
          media={about.media}
          sizes="(min-width: 64rem) 55vw, 100vw"
          reveal="left"
          caption={about.caption}
          className="aspect-[4/3] lg:col-span-7 lg:aspect-auto lg:h-[min(34rem,64svh)]"
        />

        <div className="flex flex-col gap-8 lg:col-span-5 lg:col-start-8">
          <SectionHeader
            id={`${about.id}-title`}
            eyebrow={about.eyebrow}
            title={about.title}
            intro={about.intro}
            layout="stacked"
          />

          <div
            id={about.contactId}
            data-reveal="rise"
            className="flex scroll-mt-[calc(var(--header-height)+2rem)] flex-col gap-4"
          >
            <h3 className="sr-only">{about.contact.heading}</h3>
            <div className="flex flex-col gap-0.5 border-l-4 border-success-graphic pl-4">
              <p className="type-label-sm text-text-muted">{about.contact.owner}</p>
              <p className="type-heading-md">{contact.person}</p>
              <p className="type-body-sm text-text-secondary">{about.contact.place}</p>
            </div>
            <ul className="flex flex-col border-t border-border-default">
              <Channel icon={Phone} label={about.contact.phone} href={contact.phoneHref}>
                <span className="tabular-nums">{contact.phoneDisplay}</span>
              </Channel>
              <Channel icon={MessageCircle} label={about.contact.whatsapp} href={contact.whatsappHref}>
                {about.contact.whatsappValue}
                <span className="sr-only"> {about.contact.whatsappHint}</span>
              </Channel>
              <Channel icon={Mail} label={about.contact.email} href={`mailto:${contact.email}`}>
                {contact.email}
              </Channel>
              <Channel icon={ShieldCheck} label={about.contact.pec} href={`mailto:${contact.pec}`}>
                {contact.pec}
              </Channel>
            </ul>
          </div>

          <dl
            aria-label={about.detailsLabel}
            className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1 border-t border-border-default pt-4 type-caption"
          >
            <dt className="text-text-muted">{about.labels.name}</dt>
            <dd>{company.legalName}</dd>
            <dt className="text-text-muted">{about.labels.base}</dt>
            <dd>
              {address.streetFull}, {address.postalCode} {address.locality} ({address.province})
            </dd>
            <dt className="text-text-muted">{about.labels.vat}</dt>
            <dd className="tabular-nums">{company.vatNumber}</dd>
            <dt className="text-text-muted">{about.labels.rea}</dt>
            <dd className="tabular-nums">{company.rea}</dd>
          </dl>
        </div>
      </Container>
    </Section>
  );
}

/** One contact channel: a label, then the value as a link; the icon nudges on hover. */
function Channel({
  icon: Icon,
  label,
  href,
  children,
}: {
  icon: LucideIcon;
  label: string;
  href: string;
  children: ReactNode;
}) {
  return (
    <li className="border-b border-border-default">
      <a
        href={href}
        className="group/channel grid min-h-12 grid-cols-[1.5rem_5.5rem_1fr] items-center gap-2 type-label-md transition-ui hover:text-success"
      >
        <Icon
          aria-hidden="true"
          strokeWidth={2}
          className="size-4 text-success transition-transform duration-200 motion-safe:group-hover/channel:translate-x-0.5 motion-safe:group-hover/channel:-rotate-12"
        />
        <span className="type-label-sm text-text-muted">{label}</span>
        <span className="truncate">{children}</span>
      </a>
    </li>
  );
}
