import { MessageCircle } from "lucide-react";

import { ActionLink } from "@/components/editorial/action";
import { Chapter } from "@/components/editorial/chapter";
import { Label } from "@/components/editorial/label";
import { siteConfig } from "@/config/site";
import { InkTitle, seg } from "@/features/story/components/cine";
import { TruckTop } from "@/features/story/components/truck";

import { bookingContent as booking } from "../config/booking-content";
import { BookingFlow } from "./booking-flow";

/**
 * The route arriving: from Carpi to the red destination, drawn as the act
 * arrives, the truck (from above) running to the end of it. Decorative — the
 * form beside it asks for both ends.
 */
function Arrival() {
  const { origin, destination } = booking.arrival;
  return (
    <div aria-hidden="true" data-reveal="group" className="relative mb-[clamp(2.5rem,6svh,4.5rem)]">
      <div className="relative h-10">
        <span className="absolute inset-x-0 top-1/2 h-px bg-hairline-strong" />
        <span
          className="absolute inset-x-0 top-1/2 h-px origin-left bg-success-graphic seg scrub:[scale:var(--e)_1]"
          style={seg(0.05, 0.32)}
        />
        <span className="absolute top-1/2 left-0 size-2.5 -translate-y-1/2 rounded-full bg-success-graphic" />
        <span className="absolute top-1/2 right-0 grid size-8 translate-x-1/2 -translate-y-1/2 place-items-center">
          <span className="absolute inset-0 ring-pulse rounded-full bg-action-primary/20 pending:[animation-play-state:paused]" />
          <span className="size-3 rotate-45 bg-action-primary" />
        </span>
        <div
          className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 seg scrub:[translate:calc(var(--e)*100%)_-50%]"
          style={seg(0.05, 0.32)}
        >
          <TruckTop
            sizes="12rem"
            className="absolute top-0 left-0 w-[clamp(6rem,10vw,10rem)] -translate-x-full -translate-y-1/2"
          />
        </div>
      </div>
      <div className="mt-2 flex justify-between ed-meta text-text-secondary">
        <span>{origin}</span>
        <span className="text-text-primary">{destination}</span>
      </div>
    </div>
  );
}

/**
 * ACT 10 — Richiesta. The route that started in Carpi reaches its
 * destination (Arrival), and the request continues it: the question, large,
 * then the quote form (BookingFlow) — contacts, pick-up and delivery
 * addresses — a plain GET to the quote-request page, which opens WhatsApp and
 * email with the request already written. Nothing is sent from here.
 */
export function BookingSection() {
  const titleId = `${booking.id}-title`;
  return (
    <Chapter
      id={booking.id}
      tone="white"
      labelledBy={titleId}
      conversion
      className="bg-[linear-gradient(180deg,var(--color-soft-white),var(--color-white)_30%)]"
      {...booking.chapter}
    >
      <Arrival />
      <div className="flex flex-col gap-10">
        <header data-reveal="rise" className="flex flex-col gap-5">
          <Label mark="red">{booking.label}</Label>
          <InkTitle
            id={titleId}
            lines={booking.title}
            className="cine-title text-[clamp(2.25rem,1rem+3.4vw,4.75rem)]"
            from={0.12}
            to={0.3}
          />
          <p className="max-w-[34rem] ed-body text-text-secondary">{booking.intro}</p>
        </header>

        <BookingFlow />

        <div className="flex flex-col gap-6">
          <p className="max-w-[44rem] ed-small text-text-secondary">{booking.privacy}</p>
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
