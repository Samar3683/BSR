import { MessageCircle } from "lucide-react";

import { ActionLink } from "@/components/editorial/action";
import { Chapter } from "@/components/editorial/chapter";
import { Label } from "@/components/editorial/label";
import { siteConfig } from "@/config/site";

import { bookingContent as booking } from "../config/booking-content";
import { BookingFlow } from "./booking-flow";

/**
 * Chapter 11 — "how do I request it?", on Soft White: the conversion point,
 * made to feel like seconds of effort. On the left the statement and the three
 * questions the starter answers, numbered like a checklist, then how the
 * request travels (nothing is sent from here) and WhatsApp for whoever prefers
 * to write at once. On the right the quote starter (BookingFlow): a plain GET
 * to the quote-request page, which opens WhatsApp and email with the request
 * already written.
 */
export function BookingSection() {
  const titleId = `${booking.id}-title`;
  return (
    <Chapter id={booking.id} tone="soft-white" labelledBy={titleId} conversion {...booking.chapter}>
      <div className="ed-grid gap-y-8 lg:grid-rows-[auto_1fr]">
        <div className="col-span-4 flex flex-col gap-7 md:col-span-8 lg:col-span-6 lg:row-start-1">
          <header data-reveal="rise" className="flex flex-col gap-5">
            <Label mark="red">{booking.label}</Label>
            <h2 id={titleId} className="ed-h2 text-balance">
              {booking.title}
            </h2>
          </header>
          <ol className="flex flex-col border-t border-hairline">
            {booking.questions.map((question, i) => (
              <li key={question} className="flex items-baseline gap-5 border-b border-hairline py-3">
                <span aria-hidden="true" className="ed-label text-success tabular-nums">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="ed-h4 normal-case tracking-normal">{question}</span>
              </li>
            ))}
          </ol>
        </div>

        <div className="col-span-4 md:col-span-8 lg:col-span-8 lg:col-start-9 lg:row-span-2 lg:row-start-1">
          <BookingFlow />
        </div>

        <div className="col-span-4 flex flex-col gap-6 md:col-span-8 lg:col-span-6 lg:row-start-2">
          <div className="flex flex-col gap-2">
            <p className="max-w-[34rem] ed-small text-text-secondary">{booking.intro}</p>
            <p className="max-w-[34rem] ed-small text-text-secondary">{booking.privacy}</p>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <span className="ed-small text-text-primary">{booking.alternative}</span>
            <ActionLink
              href={siteConfig.contact.whatsappHref}
              variant="outline"
              leadingIcon={MessageCircle}
              icon={null}
            >
              {booking.whatsapp}
              <span className="sr-only"> {booking.whatsappHint}</span>
            </ActionLink>
          </div>
        </div>
      </div>
    </Chapter>
  );
}
