import { Container } from "@/components/layout/container";
import { Eyebrow } from "@/components/layout/eyebrow";
import { Section } from "@/components/layout/section";
import { TextLink } from "@/components/ui/text-link";
import { siteConfig } from "@/config/site";

import { bookingContent as booking } from "../config/booking-content";
import { BookingFlow } from "./booking-flow";

/**
 * The request, on Warm White — the conversion point, made to feel like seconds
 * of effort: one large question, then three short steps that open one after
 * another (BookingFlow). Green for choice, progress and focus; the red
 * "Continua" is the one action. A plain GET form to the quote-request page,
 * which opens WhatsApp and email with the request already written: it works
 * without JavaScript and sends nothing by itself.
 */
export function BookingSection() {
  return (
    <Section
      tone="warm-white"
      spacing="md"
      id={booking.id}
      data-conversion
      aria-labelledby={`${booking.id}-title`}
    >
      <Container className="flex flex-col gap-8 lg:gap-10">
        <header data-reveal="editorial" className="flex max-w-[56rem] flex-col gap-5">
          <Eyebrow>{booking.eyebrow}</Eyebrow>
          <h2 id={`${booking.id}-title`} className="type-statement text-balance">
            {booking.title}
          </h2>
          <p className="max-w-text type-lede text-text-secondary">{booking.intro}</p>
        </header>
        <BookingFlow />
        <div className="flex flex-col gap-2 text-[0.9375rem] text-text-secondary sm:flex-row sm:flex-wrap sm:gap-x-8">
          <p className="flex items-center gap-2.5">
            <span aria-hidden="true" className="h-0.5 w-6 bg-success-graphic" />
            {booking.note}
          </p>
          <p>{booking.privacy}</p>
          <p>
            {booking.alternative}{" "}
            <TextLink href={siteConfig.contact.whatsappHref}>
              {booking.whatsapp}
              <span className="sr-only"> {booking.whatsappHint}</span>
            </TextLink>
          </p>
        </div>
      </Container>
    </Section>
  );
}
