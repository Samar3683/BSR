"use client";

import { ArrowRight } from "lucide-react";
import { type FormEvent, type ReactNode, useState, useSyncExternalStore } from "react";

import { Field } from "@/components/forms/field";
import { Select } from "@/components/forms/select";
import { TextInput } from "@/components/forms/text-input";
import { Button } from "@/components/ui/button";
import { cx } from "@/lib/utils/cx";

import { bookingContent as booking } from "../config/booking-content";

const subscribeNever = () => () => {};

/**
 * The request as progressive disclosure — three short steps, each appearing
 * once the one before has an answer, so the visitor never faces the whole form:
 *
 *   1. what service (three large choices: the chosen one grows a little, the
 *      others ease back — 250 ms, no bounce);
 *   2. the route (departure, destination) — revealed by step 1;
 *   3. the sector (optional) and "Continua" (red) — revealed once the route
 *      is filled in.
 * A green progress line follows the steps. Plain GET to `/preventivo`, which
 * writes the message; nothing is sent from here. Without JavaScript every step
 * is simply shown (native radios and required fields); with it, custom
 * messages name what is missing, and the first missing field takes focus.
 */
export function BookingFlow() {
  const { fields, steps, errors: messages, hints } = booking;
  const enhanced = useSyncExternalStore(
    subscribeNever,
    () => true,
    () => false,
  );
  const [service, setService] = useState("");
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [errors, setErrors] = useState<
    Partial<Record<"service" | "origin" | "destination", string>>
  >({});

  const routeDone = origin.trim() !== "" && destination.trim() !== "";
  const stage = service === "" ? 1 : routeDone ? 3 : 2;

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    const next: typeof errors = {};
    if (!service) next.service = messages.service;
    if (!origin.trim()) next.origin = messages.origin;
    if (!destination.trim()) next.destination = messages.destination;
    setErrors(next);
    if (Object.keys(next).length > 0) {
      event.preventDefault();
      const first = Object.keys(next)[0];
      const target =
        first === "service"
          ? "booking-service-espresso"
          : `booking-${first === "origin" ? "origin" : "destination"}`;
      document.getElementById(target)?.focus();
    }
  };

  return (
    <form
      action={booking.action}
      method="get"
      noValidate={enhanced}
      onSubmit={onSubmit}
      data-reveal="rise"
      className="flex flex-col bg-background-secondary p-5 sm:p-8 lg:p-10"
    >
      {/* Without JavaScript the closed steps are simply shown. */}
      <noscript>
        <style>{"[data-booking-step]{grid-template-rows:1fr!important;visibility:visible!important}"}</style>
      </noscript>

      {/* Progress: a green line, three steps. */}
      <div className="mb-8 flex flex-col gap-2" aria-hidden={!enhanced || undefined}>
        <div className="h-1 bg-border-default">
          <div
            className="h-full origin-left bg-success-graphic transition-[scale] duration-500 ease-cinematic motion-reduce:transition-none"
            style={{ scale: `${stage / 3} 1` }}
          />
        </div>
        <p className="type-label-sm text-text-muted">
          {booking.progress} <span className="text-success tabular-nums">{stage}</span> / 3
        </p>
      </div>

      <fieldset className="flex flex-col">
        <legend className="mb-4 type-heading-md">
          <StepNo n="01" />
          {steps.service}
        </legend>
        <div
          className="grid gap-3 md:grid-cols-3"
          aria-describedby={errors.service ? "booking-service-error" : undefined}
        >
          {fields.service.options.map((option) => {
            const chosen = service === option.value;
            return (
              <label
                key={option.value}
                className={cx(
                  "relative flex min-h-24 cursor-pointer flex-col justify-center gap-1 border-2 bg-white p-5 transition-[transform,border-color,background-color] duration-250 ease-ui has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-border-interactive motion-reduce:transition-none",
                  chosen
                    ? "border-success-graphic md:scale-[1.03]"
                    : cx(
                        "border-border-default hover:border-border-strong",
                        service !== "" && "md:scale-[0.98]",
                      ),
                )}
              >
                <input
                  id={`booking-service-${option.value}`}
                  type="radio"
                  name={fields.service.name}
                  value={option.value}
                  required={!enhanced}
                  checked={chosen}
                  onChange={() => {
                    setService(option.value);
                    setErrors((current) => ({ ...current, service: undefined }));
                  }}
                  className="peer sr-only"
                />
                <span className="text-lg flex items-center gap-3 font-semibold">
                  <span
                    aria-hidden="true"
                    className={cx(
                      "grid size-5 shrink-0 place-items-center rounded-full border-2",
                      chosen ? "border-success-graphic" : "border-border-strong",
                    )}
                  >
                    <span
                      className={cx(
                        "size-2.5 rounded-full bg-success-graphic transition-transform duration-250 motion-reduce:transition-none",
                        chosen ? "scale-100" : "scale-0",
                      )}
                    />
                  </span>
                  {option.label}
                </span>
                <span className="pl-8 text-[0.9375rem] leading-snug text-text-secondary">
                  {option.hint}
                </span>
              </label>
            );
          })}
        </div>
        {errors.service && (
          <p id="booking-service-error" role="alert" className="mt-3 type-body-sm text-danger">
            {errors.service}
          </p>
        )}
      </fieldset>

      <Step open={stage >= 2} enhanced={enhanced}>
        <div className="flex flex-col gap-4">
          <p className="type-heading-md">
            <StepNo n="02" />
            {steps.route}
          </p>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field
              id="booking-origin"
              label={fields.origin.label}
              hint={hints.origin}
              error={errors.origin}
              required
              requiredLabel="obbligatorio"
            >
              {(control) => (
                <TextInput
                  {...control}
                  name={fields.origin.name}
                  value={origin}
                  onChange={(event) => {
                    setOrigin(event.target.value);
                    setErrors((current) => ({ ...current, origin: undefined }));
                  }}
                  placeholder={fields.origin.placeholder}
                  autoComplete="off"
                  className="min-h-12 border-border-default! hover:border-border-strong! focus:border-success-graphic!"
                />
              )}
            </Field>
            <Field
              id="booking-destination"
              label={fields.destination.label}
              hint={hints.destination}
              error={errors.destination}
              required
              requiredLabel="obbligatorio"
            >
              {(control) => (
                <TextInput
                  {...control}
                  name={fields.destination.name}
                  value={destination}
                  onChange={(event) => {
                    setDestination(event.target.value);
                    setErrors((current) => ({ ...current, destination: undefined }));
                  }}
                  placeholder={fields.destination.placeholder}
                  autoComplete="off"
                  className="min-h-12 border-border-default! hover:border-border-strong! focus:border-success-graphic!"
                />
              )}
            </Field>
          </div>
        </div>
      </Step>

      <Step open={stage >= 3} enhanced={enhanced}>
        <div className="flex flex-col gap-4">
          <p className="type-heading-md">
            <StepNo n="03" />
            {steps.details}
          </p>
          <div className="flex flex-col gap-5 sm:flex-row sm:items-end">
            <Field
              id="booking-sector"
              label={`${fields.sector.label} (${fields.sector.optional})`}
              className="sm:flex-1"
            >
              {(control) => (
                <Select
                  {...control}
                  name={fields.sector.name}
                  defaultValue=""
                  controlClassName="min-h-12 border-border-default! hover:border-border-strong! focus:border-success-graphic!"
                >
                  <option value="">{fields.sector.empty}</option>
                  {fields.sector.options.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Button type="submit" size="lg" trailingIcon={ArrowRight} className="w-full sm:w-auto">
              {booking.submit}
            </Button>
          </div>
        </div>
      </Step>
    </form>
  );
}

function StepNo({ n }: { n: string }) {
  return (
    <span aria-hidden="true" className="mr-3 type-metadata text-success">
      {n}
    </span>
  );
}

/**
 * A step that opens when its turn comes: its height eases open (grid rows,
 * 300 ms), and while closed it is `inert` — no focus, no assistive technology.
 * It is rendered closed from the server (so hydration never moves the page);
 * without JavaScript a <noscript> rule shows every step.
 */
function Step({
  open,
  enhanced,
  children,
}: {
  open: boolean;
  enhanced: boolean;
  children: ReactNode;
}) {
  return (
    <div
      data-booking-step=""
      inert={enhanced && !open}
      className={cx(
        "grid transition-[grid-template-rows,visibility] duration-300 ease-ui motion-reduce:transition-none",
        open ? "grid-rows-[1fr]" : "invisible grid-rows-[0fr]",
      )}
    >
      <div className="-mx-1 min-h-0 overflow-clip px-1 pb-1">
        <div className="pt-8">{children}</div>
      </div>
    </div>
  );
}
