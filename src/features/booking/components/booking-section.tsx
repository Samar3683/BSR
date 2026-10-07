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
 * destination (Arrival), and the request continues it: on White, the
 * question, large; the conversion point,
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
    <Chapter
      id={booking.id}
      tone="white"
      labelledBy={titleId}
      conversion
      className="bg-[linear-gradient(180deg,var(--color-soft-white),var(--color-white)_30%)]"
      {...booking.chapter}
    >
      <Arrival />
      <div className="ed-grid gap-y-8 lg:grid-rows-[auto_1fr]">
        <div className="col-span-4 flex flex-col gap-7 md:col-span-8 lg:col-span-7 lg:row-start-1">
          <header data-reveal="rise" className="flex flex-col gap-5">
            <Label mark="red">{booking.label}</Label>
            <InkTitle
              id={titleId}
              lines={booking.title}
              className="cine-title text-[clamp(2.25rem,1rem+3.4vw,4.75rem)]"
              from={0.12}
              to={0.3}
            />
          </header>
          <ol className="flex flex-col border-t border-hairline">
            {booking.questions.map((question, i) => (
              <li
                key={question}
                className="flex items-baseline gap-5 border-b border-hairline py-3"
              >
                <span aria-hidden="true" className="ed-label text-success tabular-nums">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="ed-h4 tracking-normal normal-case">{question}</span>
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
