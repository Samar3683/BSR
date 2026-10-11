"use client";

import { type FormEvent, useState, useSyncExternalStore } from "react";

import { ActionButton } from "@/components/editorial/action";

import { quoteFormContent as content } from "../config/quote-form-content";
import { bookingContent as booking } from "../config/booking-content";
import { FORM_KEYS, type FormKey, email, phone } from "../lib/quote-draft";
import { type FormErrors, type FormValues, QuoteFields, StepLegend } from "./quote-fields";

const subscribeNever = () => () => {};

/** What each field needs to pass, and the message when it does not. */
function validate(values: FormValues): FormErrors {
  const e = content.errors;
  const filled = (key: FormKey) => Boolean(values[key]?.trim());
  const errors: FormErrors = {};
  if (!filled("name")) errors.name = e.name;
  if (values.email?.trim() && !email(values.email)) errors.email = e.email;
  if (!phone(values.phone ?? null)) errors.phone = e.phone;
  for (const kind of ["pickup", "delivery"] as const) {
    if (!filled(`${kind}Street`)) errors[`${kind}Street`] = e.street;
    if (!filled(`${kind}Zip`)) errors[`${kind}Zip`] = e.zip;
    if (!filled(`${kind}City`)) errors[`${kind}City`] = e.city;
    if (!filled(`${kind}Province`)) errors[`${kind}Province`] = e.province;
  }
  return errors;
}

/**
 * The quote form: three steps — your contacts, the cargo's path (pick-up and
 * delivery addresses), confirm and send. A plain GET to `/preventivo`, where
 * the message is already written for WhatsApp or email; nothing is sent from
 * here (no backend, no simulated submission). With JavaScript a message names
 * every missing field and the first one takes focus; without it the browser's
 * own validation (`required`) applies.
 */
export function BookingFlow() {
  const enhanced = useSyncExternalStore(
    subscribeNever,
    () => true,
    () => false,
  );
  const [values, setValues] = useState<FormValues>({});
  const [errors, setErrors] = useState<FormErrors>({});

  const change = (key: FormKey, value: string) => {
    setValues((current) => ({ ...current, [key]: value }));
    setErrors((current) => (current[key] ? { ...current, [key]: undefined } : current));
  };

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    const next = validate(values);
    setErrors(next);
    const first = FORM_KEYS.find((key) => next[key]);
    if (first) {
      event.preventDefault();
      document.getElementById(`booking-${first}`)?.focus();
    }
  };

  return (
    <form
      action={booking.action}
      method="get"
      noValidate={enhanced}
      onSubmit={onSubmit}
      className="flex flex-col gap-8 rounded-sm border border-hairline-strong bg-background-primary p-5 sm:p-8"
    >
      <QuoteFields
        idPrefix="booking"
        values={values}
        onChange={change}
        errors={errors}
        nativeRequired={!enhanced}
      />

      <div className="border-t border-hairline pt-8">
        <fieldset className="min-w-0">
          <StepLegend n={3}>{content.steps.confirm}</StepLegend>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <ActionButton type="submit" size="lg" className="w-full sm:w-auto">
              {content.submit}
            </ActionButton>
            <p className="max-w-[44rem] ed-small text-text-secondary">{content.note}</p>
          </div>
        </fieldset>
      </div>
    </form>
  );
}
