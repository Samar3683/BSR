"use client";

import { ArrowRight, Mail, MessageCircle, Phone } from "lucide-react";
import { useMemo, useState } from "react";

import { Field } from "@/components/forms/field";
import { Select } from "@/components/forms/select";
import { TextInput } from "@/components/forms/text-input";
import { ButtonLink } from "@/components/ui/button";
import { siteConfig } from "@/config/site";
import { sectors, services, vehicles } from "@/config/site-content";

import { quoteRequestContent as content } from "../config/quote-request-content";
import {
  DRAFT_PARAMS,
  type QuoteDraft,
  draftFromParams,
  draftMessage,
  emailHref,
  whatsappHref,
} from "../lib/quote-draft";

/** The composer's state: raw URL values (ids for the choices, text for the rest). */
export type ComposerValues = Partial<Record<keyof QuoteDraft, string>>;

const FIELD = "border-border-default! hover:border-border-strong! focus:border-success-graphic!";

/** Only values the page can show: known ids for the choices, capped text for the rest. */
export function valuesFromParams(params: URLSearchParams): ComposerValues {
  const draft = draftFromParams(params);
  const values: ComposerValues = {};
  for (const key of Object.keys(DRAFT_PARAMS) as Array<keyof QuoteDraft>) {
    if (!draft[key]) continue;
    const raw = params.get(DRAFT_PARAMS[key])!;
    values[key] = ["service", "sector", "vehicle"].includes(key) ? raw : draft[key];
  }
  return values;
}

const toParams = (values: ComposerValues) => {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values) as Array<[keyof QuoteDraft, string]>) {
    if (value) params.set(DRAFT_PARAMS[key], value);
  }
  return params;
};

/**
 * The request, composed on the page: the fields the home page passed (route,
 * service, sector, vehicle) arrive filled and stay editable, two optional ones
 * add what BSR needs to quote (goods, timing). Every edit rewrites the message
 * preview and the WhatsApp and email links, and the page URL — a reload keeps
 * what was typed. Nothing is submitted: the visitor opens WhatsApp or email,
 * reads the message and sends it.
 */
export function QuoteComposer({
  initial,
  fromUrl = false,
}: {
  initial: ComposerValues;
  /** Filled from the URL (after hydration), as opposed to the prerendered empty form. */
  fromUrl?: boolean;
}) {
  const [values, setValues] = useState<ComposerValues>(initial);
  const draft = useMemo(() => draftFromParams(toParams(values)), [values]);
  const { contact } = siteConfig;
  const { fields } = content.composer;

  const update = (key: keyof QuoteDraft) => (value: string) => {
    const next = { ...values, [key]: value };
    setValues(next);
    const query = toParams(next).toString();
    window.history.replaceState(null, "", query ? `?${query}` : window.location.pathname);
  };

  const text = (key: "origin" | "destination" | "goods" | "when", id: string) => (
    <Field id={id} label={fields[key].label}>
      {(control) => (
        <TextInput
          {...control}
          value={values[key] ?? ""}
          onChange={(event) => update(key)(event.target.value)}
          placeholder={fields[key].placeholder}
          maxLength={80}
          autoComplete="off"
          className={FIELD}
        />
      )}
    </Field>
  );
  const choice = (
    key: "service" | "sector" | "vehicle",
    id: string,
    options: Record<string, string>,
  ) => (
    <Field id={id} label={fields[key].label}>
      {(control) => (
        <Select
          {...control}
          value={values[key] ?? ""}
          onChange={(event) => update(key)(event.target.value)}
          controlClassName={FIELD}
        >
          <option value="">{content.composer.notSpecified}</option>
          {Object.entries(options).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
      )}
    </Field>
  );

  return (
    <div className="flex flex-col gap-8" data-composer={fromUrl ? "url" : "empty"}>
      <div className="grid gap-5 sm:grid-cols-2">
        {text("origin", "quote-origin")}
        {text("destination", "quote-destination")}
        {choice("service", "quote-service", services)}
        {choice("vehicle", "quote-vehicle", vehicles)}
        {choice("sector", "quote-sector", sectors)}
        {text("when", "quote-when")}
        <div className="sm:col-span-2">{text("goods", "quote-goods")}</div>
      </div>

      <div className="flex flex-col gap-3 border-l-4 border-success-graphic bg-background-secondary p-5">
        <p className="type-label-sm text-text-muted">{content.composer.previewLabel}</p>
        <p
          aria-live="polite"
          className="type-body-md whitespace-pre-line text-text-primary"
          data-testid="quote-preview"
        >
          {draftMessage(draft)}
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-3">
          <ButtonLink
            href={whatsappHref(draft)}
            leadingIcon={MessageCircle}
            trailingIcon={ArrowRight}
          >
            {content.send.whatsapp}
            <span className="sr-only"> {content.send.whatsappHint}</span>
          </ButtonLink>
          <ButtonLink href={emailHref(draft)} variant="secondary" leadingIcon={Mail}>
            {content.send.email}
          </ButtonLink>
          <ButtonLink href={contact.phoneHref} variant="ghost" leadingIcon={Phone}>
            {content.send.call} {contact.phoneDisplay}
          </ButtonLink>
        </div>
        <p className="type-caption text-text-muted">{content.send.note}</p>
      </div>
    </div>
  );
}
