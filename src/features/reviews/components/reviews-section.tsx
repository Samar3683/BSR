import { ArrowRight, MessageCircle, Phone } from "lucide-react";

import { Container } from "@/components/layout/container";
import { Eyebrow } from "@/components/layout/eyebrow";
import { Section } from "@/components/layout/section";
import { SectionHeader } from "@/components/layout/section-header";
import { ButtonLink } from "@/components/ui/button";
import { siteConfig } from "@/config/site";

import { approvedTestimonials, reviewsContent as reviews } from "../config/reviews-content";

/**
 * Reviews, on White.
 * - With real, consented testimonials: the first as a large quote on a green
 *   rule (author, company, the route or service), any others in a ruled row.
 * - Until then: a short invitation to talk — one question, one sentence, the
 *   request (red), WhatsApp and the phone. No invented quote, person or rating.
 */
export function ReviewsSection() {
  const [lead, ...others] = approvedTestimonials(reviews.testimonials);
  if (!lead) return <Invitation />;
  return (
    <Section tone="white" spacing="md" id={reviews.id} aria-labelledby={`${reviews.id}-title`}>
      <Container className="flex flex-col gap-10 lg:gap-12">
        <SectionHeader id={`${reviews.id}-title`} eyebrow={reviews.eyebrow} title={reviews.title} />
        <figure
          data-reveal="rise"
          className="flex flex-col gap-6 border-l-4 border-success-graphic pl-6 sm:pl-10"
        >
          <blockquote className="max-w-[32ch] type-heading-lg">“{lead.quote}”</blockquote>
          <figcaption className="flex flex-col gap-0.5">
            <span className="type-label-lg">{lead.person}</span>
            {(lead.role || lead.company) && (
              <span className="type-body-sm text-text-secondary">
                {[lead.role, lead.company].filter(Boolean).join(", ")}
              </span>
            )}
            {lead.context && <span className="type-caption text-success">{lead.context}</span>}
          </figcaption>
        </figure>
        {others.length > 0 && (
          <ul className="grid gap-x-(--spacing-grid-gap) border-t border-border-default md:grid-cols-3">
            {others.map((item) => (
              <li key={item.person} className="flex flex-col gap-4 py-6">
                <blockquote className="type-body-lg">“{item.quote}”</blockquote>
                <p className="type-label-md">
                  {item.person}
                  {item.company && <span className="text-text-secondary"> · {item.company}</span>}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Container>
    </Section>
  );
}

function Invitation() {
  const { invitation } = reviews;
  const { contact } = siteConfig;
  return (
    <Section
      tone="white"
      spacing="sm"
      id={reviews.id}
      data-conversion
      aria-labelledby={`${reviews.id}-title`}
    >
      <Container
        data-reveal="rise"
        className="flex flex-col gap-6 border-y border-border-default py-8 lg:layout-grid lg:items-center lg:py-10"
      >
        <div className="flex flex-col gap-3 lg:col-span-6">
          <Eyebrow>{invitation.eyebrow}</Eyebrow>
          <h2 id={`${reviews.id}-title`} className="type-heading-lg">
            {invitation.title}
          </h2>
          <p className="max-w-text type-lede text-text-secondary">{invitation.body}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3 lg:col-span-6 lg:justify-end">
          <ButtonLink href={invitation.quote.href} trailingIcon={ArrowRight}>
            {invitation.quote.label}
          </ButtonLink>
          <ButtonLink href={contact.whatsappHref} variant="secondary" leadingIcon={MessageCircle}>
            {invitation.whatsapp.label}
            <span className="sr-only"> {invitation.whatsapp.hint}</span>
          </ButtonLink>
          <a
            href={contact.phoneHref}
            className="group/call inline-flex min-h-(--target-min) items-center gap-2 px-2 type-label-md tabular-nums text-text-primary transition-ui hover:text-success"
          >
            <Phone
              aria-hidden="true"
              strokeWidth={2}
              className="size-4 transition-transform duration-200 motion-safe:group-hover/call:-rotate-12"
            />
            <span className="sr-only">{invitation.call} </span>
            {contact.phoneDisplay}
          </a>
        </div>
      </Container>
    </Section>
  );
}
