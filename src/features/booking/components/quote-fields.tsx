import { ChevronDown, CircleAlert } from "lucide-react";
import type { ReactNode } from "react";

import { selectControlStyles, textControlStyles } from "@/components/forms/control-styles";
import { cx } from "@/lib/utils/cx";

import {
  DEFAULT_PREFIX,
  PHONE_PREFIXES,
  quoteFormContent as content,
} from "../config/quote-form-content";
import { DRAFT_PARAMS, type FormKey } from "../lib/quote-draft";

export type FormValues = Partial<Record<FormKey, string>>;
export type FormErrors = Partial<Record<FormKey, string>>;

interface QuoteFieldsProps {
  /** Prefix of the field ids, so the form can sit twice on a page's tree without clashes. */
  idPrefix: string;
  values: FormValues;
  onChange: (key: FormKey, value: string) => void;
  errors?: FormErrors;
  /** Native `required` (a visitor without JavaScript); with JavaScript the form names what is missing. */
  nativeRequired?: boolean;
}

const CONTROL = "rounded-sm focus:border-success-graphic";

/** The fieldset's legend as a numbered step: a filled circle, the title in mono capitals. */
export function StepLegend({ n, children }: { n: number; children: ReactNode }) {
  return (
    <legend className="mb-5 flex items-center gap-3 ed-label text-text-primary">
      <span
        aria-hidden="true"
        className="grid size-7 place-items-center rounded-full bg-background-inverse text-text-inverse"
      >
        {n}
      </span>
      {children}
    </legend>
  );
}

/**
 * Steps 1 and 2 of the quote form — the contacts, then the cargo's path from
 * the pick-up address (green) to the delivery address (red) — as controlled
 * inputs named with the URL parameters (so a plain GET carries them to the
 * quote-request page). Labels always sit above their controls; an error
 * names the field and is announced.
 */
export function QuoteFields({
  idPrefix,
  values,
  onChange,
  errors = {},
  nativeRequired = false,
}: QuoteFieldsProps) {
  const id = (key: FormKey) => `${idPrefix}-${key}`;

  const field = (
    key: FormKey,
    label: string,
    options: {
      placeholder?: string;
      type?: "text" | "email" | "tel";
      autoComplete?: string;
      optional?: boolean;
      maxLength?: number;
      className?: string;
    } = {},
  ) => {
    const error = errors[key];
    return (
      <div className={cx("flex flex-col gap-2", options.className)}>
        <label htmlFor={id(key)} className="ed-label text-text-primary">
          {label}
          {options.optional && (
            <span className="font-normal text-text-secondary"> ({content.optional})</span>
          )}
        </label>
        <input
          id={id(key)}
          name={DRAFT_PARAMS[key]}
          type={options.type ?? "text"}
          value={values[key] ?? ""}
          onChange={(event) => onChange(key, event.target.value)}
          required={nativeRequired && !options.optional}
          aria-required={options.optional ? undefined : true}
          autoComplete={options.autoComplete ?? "off"}
          maxLength={options.maxLength ?? 80}
          placeholder={options.placeholder}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id(key)}-error` : undefined}
          inputMode={options.type === "tel" ? "tel" : undefined}
          className={cx(textControlStyles, CONTROL)}
        />
        {error && (
          <p
            id={`${id(key)}-error`}
            role="alert"
            className="flex items-center gap-2 ed-small text-danger"
          >
            <CircleAlert aria-hidden="true" strokeWidth={1.75} className="size-4 shrink-0" />
            {error}
          </p>
        )}
      </div>
    );
  };

  const addressPanel = (kind: "pickup" | "delivery") => {
    const copy = content[kind];
    const keys = {
      street: `${kind}Street`,
      zip: `${kind}Zip`,
      city: `${kind}City`,
      province: `${kind}Province`,
    } as const satisfies Record<string, FormKey>;
    const pickup = kind === "pickup";
    return (
      <fieldset
        className={cx(
          "grid min-w-0 gap-4 rounded-sm border border-l-[3px] border-hairline-strong p-5 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]",
          pickup ? "border-l-success-graphic" : "border-l-action-primary",
        )}
      >
        <legend className="sr-only">{copy.title}</legend>
        <p
          aria-hidden="true"
          className={cx(
            "flex items-center gap-2.5 ed-label sm:col-span-2",
            pickup ? "text-success" : "text-danger",
          )}
        >
          <span
            className={cx(
              "size-2 shrink-0",
              pickup ? "rounded-full bg-success-graphic" : "rotate-45 bg-action-primary",
            )}
          />
          {copy.title}
        </p>
        {field(keys.street, copy.street.label, {
          placeholder: copy.street.placeholder,
          className: "sm:col-span-2",
        })}
        {field(keys.zip, copy.zip.label, { placeholder: copy.zip.placeholder, maxLength: 12 })}
        {field(keys.city, copy.city.label, { placeholder: copy.city.placeholder })}
        {field(keys.province, copy.province.label, {
          placeholder: copy.province.placeholder,
          maxLength: 40,
          className: "sm:col-span-2",
        })}
      </fieldset>
    );
  };

  return (
    <div className="@container flex flex-col gap-8">
      <fieldset className="min-w-0">
        <StepLegend n={1}>{content.steps.contacts}</StepLegend>
        <div className="grid gap-4 @lg:grid-cols-2 @3xl:grid-cols-[1.3fr_1.3fr_0.8fr_1fr]">
          {field("name", content.contacts.name.label, {
            placeholder: content.contacts.name.placeholder,
            autoComplete: "name",
          })}
          {field("email", content.contacts.email.label, {
            type: "email",
            optional: true,
            placeholder: content.contacts.email.placeholder,
            autoComplete: "email",
            maxLength: 100,
          })}
          <div className="flex flex-col gap-2">
            <label htmlFor={id("prefix")} className="ed-label text-text-primary">
              {content.contacts.prefix.label}
            </label>
            <div className="relative">
              <select
                id={id("prefix")}
                name={DRAFT_PARAMS.prefix}
                value={values.prefix ?? DEFAULT_PREFIX}
                onChange={(event) => onChange("prefix", event.target.value)}
                autoComplete="tel-country-code"
                className={cx(selectControlStyles, CONTROL)}
              >
                {PHONE_PREFIXES.map((option) => (
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
          {field("phone", content.contacts.phone.label, {
            type: "tel",
            placeholder: content.contacts.phone.placeholder,
            autoComplete: "tel-national",
            maxLength: 20,
          })}
        </div>
      </fieldset>

      <div className="border-t border-hairline pt-8">
        <fieldset className="min-w-0">
          <StepLegend n={2}>{content.steps.path}</StepLegend>
          <div className="grid gap-4 @3xl:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] @3xl:items-center">
            {addressPanel("pickup")}
            <span aria-hidden="true" className="text-2xl hidden text-text-secondary @3xl:block">
              →
            </span>
            {addressPanel("delivery")}
          </div>
        </fieldset>
      </div>
    </div>
  );
}
