"use client";

import { type FormEvent, useState, useSyncExternalStore } from "react";

import { ActionButton } from "@/components/editorial/action";

import { quoteFormContent as content } from "../config/quote-form-content";
import { bookingContent as booking } from "../config/booking-content";
import { type FormKey } from "../lib/quote-draft";
import { firstError, validateQuote } from "../lib/quote-validate";
import { type FormErrors, type FormValues, QuoteFields, StepLegend } from "./quote-fields";

const subscribeNever = () => () => {};

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
    const next = validateQuote(values);
    setErrors(next);
    const first = firstError(next);
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
