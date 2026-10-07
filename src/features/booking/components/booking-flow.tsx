"use client";

import { ChevronDown, CircleAlert } from "lucide-react";
import { type FormEvent, type ReactNode, useState, useSyncExternalStore } from "react";

import { ActionButton } from "@/components/editorial/action";
import { selectControlStyles, textControlStyles } from "@/components/forms/control-styles";
import { cx } from "@/lib/utils/cx";

import { bookingContent as booking } from "../config/booking-content";

const subscribeNever = () => () => {};

type FieldName = "service" | "origin" | "destination";

/**
 * The quote starter — compact, one glance: the route as a journey (Partenza on
 * a green node, a line, Destinazione on a red destination), the service as
 * three choices, the sector if the visitor wants, and "Richiedi un preventivo".
 *
 * A plain GET to `/preventivo`, which writes the message for WhatsApp or email;
 * nothing is sent from here. Labels are always visible (mono capitals), inputs
 * are 48px, the chosen service turns green. Without JavaScript the browser's
 * own validation applies (required fields); with it, a message names what is
 * missing under each field and the first missing field takes focus.
 */
export function BookingFlow() {
  const { fields, errors: messages, hints } = booking;
  const enhanced = useSyncExternalStore(
    subscribeNever,
    () => true,
    () => false,
  );
  const [service, setService] = useState("");
  const [errors, setErrors] = useState<Partial<Record<FieldName, string>>>({});

  const clear = (name: FieldName) => setErrors((current) => ({ ...current, [name]: undefined }));

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    const data = new FormData(event.currentTarget);
    const next: typeof errors = {};
    if (!String(data.get(fields.origin.name) ?? "").trim()) next.origin = messages.origin;
    if (!String(data.get(fields.destination.name) ?? "").trim()) next.destination = messages.destination;
    if (!service) next.service = messages.service;
    setErrors(next);
    const first = (["origin", "destination", "service"] as const).find((name) => next[name]);
    if (first) {
      event.preventDefault();
      const target = first === "service" ? `booking-service-${fields.service.options[0]!.value}` : `booking-${first}`;
      document.getElementById(target)?.focus();
    }
  };

  return (
    <form
      action={booking.action}
      method="get"
      noValidate={enhanced}
      onSubmit={onSubmit}
      className="flex flex-col gap-7"
    >
      {/* The route: from a green origin to a red destination. */}
      <div className="relative flex flex-col gap-5 pl-8">
        <span aria-hidden="true" className="absolute top-[2.3rem] bottom-[2.3rem] left-[5px] w-px bg-hairline-strong" />
        <RouteField
          name="origin"
          inputName={fields.origin.name}
          label={fields.origin.label}
          hint={hints.origin}
          placeholder={fields.origin.placeholder}
          error={errors.origin}
          onInput={() => clear("origin")}
          mark={<span className="size-[11px] rounded-full bg-success-graphic" />}
        />
        <RouteField
          name="destination"
          inputName={fields.destination.name}
          label={fields.destination.label}
          hint={hints.destination}
          placeholder={fields.destination.placeholder}
          error={errors.destination}
          onInput={() => clear("destination")}
          mark={<span className="size-[10px] rotate-45 bg-action-primary" />}
        />
      </div>

      <fieldset
        className="flex flex-col gap-3"
        aria-describedby={errors.service ? "booking-service-error" : undefined}
      >
        <legend className="mb-3 ed-label text-text-primary">
          {fields.service.label} <span className="font-normal text-text-secondary">(obbligatorio)</span>
        </legend>
        <div className="flex flex-wrap gap-2">
          {fields.service.options.map((option) => {
            const chosen = service === option.value;
            return (
              <label
                key={option.value}
                title={option.hint}
                className={cx(
                  "inline-flex min-h-11 cursor-pointer items-center gap-2.5 rounded-full border px-4 ed-action transition-[border-color,background-color,color] duration-200 ease-ui has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-focus motion-reduce:transition-none",
                  chosen
                    ? "border-success-graphic bg-success-surface text-text-primary"
                    : "border-border-strong text-text-primary hover:border-border-interactive",
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
                    clear("service");
                  }}
                  className="peer sr-only"
                />
                <span
                  aria-hidden="true"
                  className={cx(
                    "grid size-3.5 place-items-center rounded-full border",
                    chosen ? "border-success-graphic" : "border-border-strong",
                  )}
                >
                  <span className={cx("size-1.5 rounded-full bg-success-graphic", chosen ? "scale-100" : "scale-0")} />
                </span>
                {option.label}
              </label>
            );
          })}
        </div>
        {service && (
          <p className="ed-small text-text-secondary">
            {fields.service.options.find((option) => option.value === service)?.hint}
          </p>
        )}
        {errors.service && <Error id="booking-service-error">{errors.service}</Error>}
      </fieldset>

      <div className="flex flex-col gap-2">
        <label htmlFor="booking-sector" className="ed-label text-text-primary">
          {fields.sector.label} <span className="font-normal text-text-secondary">({fields.sector.optional})</span>
        </label>
        <div className="relative">
          <select
            id="booking-sector"
            name={fields.sector.name}
            defaultValue=""
            className={cx(selectControlStyles, "rounded-sm")}
          >
            <option value="">{fields.sector.empty}</option>
            {fields.sector.options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <ChevronDown
            aria-hidden="true"
            strokeWidth={1.75}
            className="pointer-events-none absolute top-1/2 right-4 size-4 -translate-y-1/2 text-text-secondary"
          />
        </div>
      </div>

      <div className="flex flex-col gap-3 border-t border-hairline pt-6 sm:flex-row sm:items-center sm:justify-between">
        <p className="ed-small text-text-secondary">{booking.note}</p>
        <ActionButton type="submit" size="lg" className="w-full sm:w-auto">
          {booking.submit}
        </ActionButton>
      </div>
    </form>
  );
}

function RouteField({
  name,
  inputName,
  label,
  hint,
  placeholder,
  error,
  onInput,
  mark,
}: {
  name: "origin" | "destination";
  inputName: string;
  label: string;
  hint: string;
  placeholder: string;
  error?: string;
  onInput: () => void;
  mark: ReactNode;
}) {
  const id = `booking-${name}`;
  const describedBy = [`${id}-hint`, error && `${id}-error`].filter(Boolean).join(" ");
  return (
    <div className="relative flex flex-col gap-2">
      <span aria-hidden="true" className="absolute top-[2.85rem] -left-8 grid w-[11px] place-items-center">
        {mark}
      </span>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <label htmlFor={id} className="ed-label text-text-primary">
          {label} <span className="font-normal text-text-secondary">(obbligatorio)</span>
        </label>
        <p id={`${id}-hint`} className="ed-small text-text-secondary">
          {hint}
        </p>
      </div>
      <input
        id={id}
        name={inputName}
        type="text"
        required
        autoComplete="off"
        placeholder={placeholder}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        onInput={onInput}
        className={cx(textControlStyles, "rounded-sm focus:border-success-graphic")}
      />
      {error && <Error id={`${id}-error`}>{error}</Error>}
    </div>
  );
}

function Error({ id, children }: { id: string; children: ReactNode }) {
  return (
    <p id={id} role="alert" className="flex items-center gap-2 ed-small text-danger">
      <CircleAlert aria-hidden="true" strokeWidth={1.75} className="size-4 shrink-0" />
      {children}
    </p>
  );
}
