import { MessageCircle, Phone } from "lucide-react";

import { ActionLink } from "@/components/editorial/action";
import { Chapter } from "@/components/editorial/chapter";
import { Label } from "@/components/editorial/label";
import { siteConfig } from "@/config/site";

import { approvedTestimonials, reviewsContent as reviews } from "../config/reviews-content";

/** The editorial quotation mark: a large hairline glyph in BSR green. */
function QuoteMark({ className }: { className?: string }) {
  return (
    <span aria-hidden="true" className={`block font-tech text-[7rem] leading-[0.7] text-success-graphic ${className ?? ""}`}>
      “
    </span>
  );
}

/**
 * Chapter 09 — "what do customers say?", on Soft White.
 * - With real, consented testimonials (reviews-content.ts): the first as an
 *   editorial quotation (a large green quotation mark, the quote in display
 *   capitals, the person, the company and the route on a hairline), any others
 *   in a ruled row. No stars unless a rating is genuinely provided.
 * - Until then: the empty space becomes an invitation — "La prossima storia
 *   potrebbe essere la tua." — with WhatsApp (red), the request and the phone.
 *   No invented quote, person or rating.
 */
export function ReviewsSection() {
  const [lead, ...others] = approvedTestimonials(reviews.testimonials);
  const titleId = `${reviews.id}-title`;
  if (!lead) return <Invitation />;
  return (
    <Chapter id={reviews.id} tone="soft-white" labelledBy={titleId} {...reviews.chapter}>
      <div className="ed-grid gap-y-10">
        <div className="col-span-4 flex flex-col gap-5 md:col-span-8 lg:col-span-5">
          <Label>{reviews.label}</Label>
          <h2 id={titleId} className="ed-h2 text-balance">
            {reviews.title}
          </h2>
        </div>
        <figure data-reveal="rise" className="col-span-4 flex flex-col gap-6 md:col-span-8 lg:col-span-10 lg:col-start-7">
          <QuoteMark />
          <blockquote className="max-w-[30ch] ed-h3 normal-case">{lead.quote}</blockquote>
          <figcaption className="flex flex-wrap items-baseline gap-x-4 gap-y-1 border-t border-hairline pt-4">
            <span className="ed-label text-text-primary">{lead.person}</span>
            {(lead.role || lead.company) && (
              <span className="ed-small text-text-secondary">
                {[lead.role, lead.company].filter(Boolean).join(", ")}
              </span>
            )}
            {lead.context && <span className="ed-meta text-success">{lead.context}</span>}
          </figcaption>
        </figure>
        {others.length > 0 && (
          <ul className="col-span-4 grid gap-x-(--spacing-col-gap) border-t border-hairline md:col-span-8 md:grid-cols-3 lg:col-span-16">
            {others.map((item) => (
              <li key={item.person} className="flex flex-col gap-4 py-6">
                <blockquote className="ed-body">“{item.quote}”</blockquote>
                <p className="ed-label">
                  {item.person}
                  {item.company && <span className="text-text-secondary"> · {item.company}</span>}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Chapter>
  );
}

function Invitation() {
  const { invitation } = reviews;
  const { contact } = siteConfig;
  const titleId = `${reviews.id}-title`;
  return (
    <Chapter id={reviews.id} tone="soft-white" labelledBy={titleId} conversion {...reviews.chapter}>
      <div className="ed-grid gap-y-8 lg:items-end">
        <div data-reveal="rise" className="col-span-4 flex flex-col gap-5 md:col-span-8 lg:col-span-9">
          <Label>{invitation.label}</Label>
          <h2 id={titleId} className="ed-h2 text-balance">
            {invitation.title[0]} <span className="text-success">{invitation.title[1]}</span>
          </h2>
        </div>
        <div className="col-span-4 flex flex-col gap-5 md:col-span-8 lg:col-span-6 lg:col-start-11">
          <p className="flex flex-col gap-1 border-t border-hairline pt-4">
            <span className="ed-h4">{invitation.question}</span>
            <span className="ed-body text-text-secondary">{invitation.body}</span>
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <ActionLink href={contact.whatsappHref} leadingIcon={MessageCircle}>
              {invitation.write.label}
              <span className="sr-only"> {invitation.write.hint}</span>
            </ActionLink>
            <ActionLink href={invitation.quote.href} variant="outline">
              {invitation.quote.label}
            </ActionLink>
            <a
              href={contact.phoneHref}
              className="inline-flex min-h-(--target-min) items-center gap-2 px-1 ed-action text-text-primary transition-colors duration-200 hover:text-success"
            >
              <Phone aria-hidden="true" strokeWidth={1.75} className="size-4 text-success" />
              <span className="sr-only">{invitation.call} </span>
              <span className="tabular-nums">{contact.phoneDisplay}</span>
            </a>
          </div>
        </div>
      </div>
    </Chapter>
  );
}
