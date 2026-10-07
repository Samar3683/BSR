import { ArrowUpRight } from "lucide-react";
import type { ReactNode } from "react";

import { Chapter } from "@/components/editorial/chapter";
import { Label } from "@/components/editorial/label";
import { InkTitle } from "@/features/story/components/cine";
import { MediaFrame } from "@/components/media/media-frame";
import { siteConfig } from "@/config/site";

import { aboutContent as about } from "../config/about-content";

/**
 * Chapter 10 — "who is behind the service?", on White: human, not a profile
 * card. On the left the heading in three short lines, what BSR is, the
 * titolare, every channel as one aligned technical list (the site's
 * "Contatti" anchor) and the company data; on the right a large photograph
 * running off the page edge — illustrative, and captioned so (it does not
 * depict the titolare). Nothing here is invented (see about-content.ts).
 */
export function AboutSection() {
  const { contact, company } = siteConfig;
  const { address } = company;
  const titleId = `${about.id}-title`;
  return (
    <Chapter
      id={about.id}
      tone="soft-white"
      labelledBy={titleId}
      className="bg-[linear-gradient(180deg,var(--color-white),var(--color-soft-white)_35%)]"
      {...about.chapter}
    >
      <div className="ed-grid gap-y-8 lg:grid-rows-[auto_auto]">
        <div className="col-span-4 md:col-span-8 lg:col-span-7 lg:row-start-1">
          <header data-reveal="rise" className="flex flex-col gap-5">
            <Label>{about.label}</Label>
            <InkTitle
              id={titleId}
              lines={about.title}
              className="cine-title text-[clamp(2.25rem,1rem+3.6vw,5rem)]"
              from={0.1}
              to={0.32}
            />
            <p className="max-w-[36rem] ed-body text-text-secondary">{about.intro}</p>
          </header>
        </div>

        <div className="col-span-4 md:col-span-8 lg:col-span-8 lg:col-start-9 lg:row-span-2 lg:row-start-1 lg:ed-bleed-r lg:self-center">
          <MediaFrame
            name="about-portrait"
            media={about.media}
            sizes="(min-width: 64rem) 50vw, 100vw"
            reveal="right"
            caption={about.caption}
            className="aspect-[4/3] lg:aspect-auto lg:h-[min(36rem,70svh)]"
          />
        </div>

        <div className="col-span-4 flex flex-col gap-7 md:col-span-8 lg:col-span-7 lg:row-start-2">
          <div
            id={about.contactId}
            className="flex scroll-mt-[calc(var(--header-height)+2rem)] flex-col"
          >
            <h3 className="sr-only">{about.contact.heading}</h3>
            <p className="flex flex-wrap items-baseline gap-x-4 gap-y-1 border-t border-hairline-strong py-3">
              <span className="ed-meta text-text-secondary">{about.contact.owner}</span>
              <span className="ed-h4">{contact.person}</span>
              <span className="ed-small text-text-secondary">{about.contact.place}</span>
            </p>
            <ul className="flex flex-col border-t border-hairline">
              <Channel label={about.contact.phone} href={contact.phoneHref}>
                <span className="tabular-nums">{contact.phoneDisplay}</span>
              </Channel>
              <Channel label={about.contact.whatsapp} href={contact.whatsappHref}>
                {about.contact.whatsappValue}
                <span className="sr-only"> {about.contact.whatsappHint}</span>
              </Channel>
              <Channel label={about.contact.email} href={`mailto:${contact.email}`}>
                {contact.email}
              </Channel>
              <Channel label={about.contact.pec} href={`mailto:${contact.pec}`}>
                {contact.pec}
              </Channel>
            </ul>
          </div>

          <dl
            aria-label={about.detailsLabel}
            className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1.5 sm:grid-cols-[auto_1fr_auto_1fr]"
          >
            <dt className="ed-meta text-text-secondary">{about.labels.name}</dt>
            <dd className="ed-small">{company.legalName}</dd>
            <dt className="ed-meta text-text-secondary">{about.labels.vat}</dt>
            <dd className="ed-small tabular-nums">{company.vatNumber}</dd>
            <dt className="ed-meta text-text-secondary">{about.labels.base}</dt>
            <dd className="ed-small">
              {address.streetFull}, {address.postalCode} {address.locality} ({address.province})
            </dd>
            <dt className="ed-meta text-text-secondary">{about.labels.rea}</dt>
            <dd className="ed-small tabular-nums">{company.rea}</dd>
          </dl>
        </div>
      </div>
    </Chapter>
  );
}

/** One contact channel: a mono label, then the value as a link; the arrow turns green on hover. */
function Channel({ label, href, children }: { label: string; href: string; children: ReactNode }) {
  return (
    <li className="border-b border-hairline">
      <a
        href={href}
        className="group/channel grid min-h-12 grid-cols-[6rem_1fr_auto] items-center gap-3 ed-body text-text-primary transition-colors duration-200 hover:text-success"
      >
        <span className="ed-meta text-text-secondary">{label}</span>
        <span className="truncate">{children}</span>
        <ArrowUpRight
          aria-hidden="true"
          strokeWidth={1.75}
          className="size-4 text-text-secondary transition-[translate,color] duration-200 group-hover/channel:text-success motion-safe:group-hover/channel:translate-x-0.5 motion-safe:group-hover/channel:-translate-y-0.5"
        />
      </a>
    </li>
  );
}
