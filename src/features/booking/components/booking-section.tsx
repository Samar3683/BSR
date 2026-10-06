import { ArrowRight } from "lucide-react";
import type { ReactNode } from "react";

import { Field } from "@/components/forms/field";
import { Select } from "@/components/forms/select";
import { TextInput } from "@/components/forms/text-input";
import { Container } from "@/components/layout/container";
import { Section } from "@/components/layout/section";
import { SectionHeader } from "@/components/layout/section-header";
import { Button } from "@/components/ui/button";
import { TextLink } from "@/components/ui/text-link";
import { siteConfig } from "@/config/site";

import { bookingContent as booking } from "../config/booking-content";

// Thin neutral border at rest, the brand green while the field is in use.
// `!`: wins over the shared control border (cx joins classes, it does not merge them).
const GREEN_FIELD =
  "border-border-default! hover:border-border-strong! focus:border-success-graphic!";

/**
 * The request, on Warm White: departure, destination, service and (optional)
 * sector, then "Continua" (red, the page's action). A plain GET form to the
 * quote-request page, which opens WhatsApp and email with the request already
 * written: it works without JavaScript and sends nothing by itself.
 * A flat white panel, thin neutral fields that turn green in use.
 */
export function BookingSection() {
  const { origin, destination, service, sector } = booking.fields;
  return (
    <Section
      tone="warm-white"
      spacing="md"
      id={booking.id}
      data-conversion
      aria-labelledby={`${booking.id}-title`}
    >
      <Container className="flex flex-col gap-10 lg:gap-12">
        <SectionHeader
          id={`${booking.id}-title`}
          eyebrow={booking.eyebrow}
          title={booking.title}
          intro={booking.intro}
        />
        <form
          action={booking.action}
          method="get"
          data-reveal="rise"
          className="grid gap-6 bg-background-secondary p-6 sm:p-8 sm:grid-cols-2 xl:grid-cols-[1fr_1fr_1fr_1fr_auto] xl:items-end xl:gap-5 lg:p-10"
        >
          <Field id="booking-origin" label={<Step n="01">{origin.label}</Step>} required>
            {(control) => (
              <TextInput
                {...control}
                name={origin.name}
                placeholder={origin.placeholder}
                autoComplete="off"
                className={GREEN_FIELD}
              />
            )}
          </Field>
          <Field id="booking-destination" label={<Step n="02">{destination.label}</Step>} required>
            {(control) => (
              <TextInput
                {...control}
                name={destination.name}
                placeholder={destination.placeholder}
                autoComplete="off"
                className={GREEN_FIELD}
              />
            )}
          </Field>
          <Field id="booking-service" label={<Step n="03">{service.label}</Step>}>
            {(control) => (
              <Select
                {...control}
                name={service.name}
                defaultValue="espresso"
                controlClassName={GREEN_FIELD}
              >
                {service.options.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field
            id="booking-sector"
            label={
              <Step n="04">
                {sector.label}
                <span className="font-normal text-text-muted"> ({sector.optional})</span>
              </Step>
            }
          >
            {(control) => (
              <Select {...control} name={sector.name} defaultValue="" controlClassName={GREEN_FIELD}>
                <option value="">{sector.empty}</option>
                {sector.options.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <div className="sm:col-span-2 xl:col-span-1">
            <Button type="submit" size="lg" trailingIcon={ArrowRight} className="w-full xl:w-auto">
              {booking.submit}
            </Button>
          </div>
        </form>
        <div className="-mt-4 flex flex-col gap-2 type-body-sm text-text-secondary sm:flex-row sm:flex-wrap sm:gap-x-8">
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

function Step({ n, children }: { n: string; children: ReactNode }) {
  return (
    <span className="inline-flex items-baseline gap-2">
      <span aria-hidden="true" className="type-metadata text-success">
        {n}
      </span>
      {children}
    </span>
  );
}
