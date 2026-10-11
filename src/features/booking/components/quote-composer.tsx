"use client";

import { ArrowRight, Mail, MessageCircle, Phone } from "lucide-react";
import { useMemo, useState } from "react";

import { ButtonLink } from "@/components/ui/button";
import { siteConfig } from "@/config/site";

import { quoteFormContent as form } from "../config/quote-form-content";
import { quoteRequestContent as content } from "../config/quote-request-content";
import {
  DRAFT_PARAMS,
  type FormKey,
  type QuoteDraft,
  draftFromParams,
  draftMessage,
  emailHref,
  whatsappHref,
} from "../lib/quote-draft";
import { QuoteFields } from "./quote-fields";

/** The composer's state: raw URL values (ids for the choices, text for the rest). */
export type ComposerValues = Partial<Record<keyof QuoteDraft, string>>;

const CONTEXT = ["service", "vehicle", "sector"] as const;

/** Only values the page can show: known ids for the choices, capped text for the rest. */
export function valuesFromParams(params: URLSearchParams): ComposerValues {
  const draft = draftFromParams(params);
  const values: ComposerValues = {};
  for (const key of Object.keys(DRAFT_PARAMS) as Array<keyof QuoteDraft>) {
    if (!draft[key]) continue;
    const raw = params.get(DRAFT_PARAMS[key])!;
    values[key] = (CONTEXT as readonly string[]).includes(key) ? raw : draft[key];
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
 * The request, composed on the page: the form's fields — contacts, the
 * pick-up and delivery addresses — arrive filled with whatever the home page
 * passed and stay editable. A service, sector or vehicle chosen elsewhere on
 * the site rides along as context ("Richiesta per …"), not as a field. Every
 * edit rewrites the message preview, the WhatsApp and email links, and the
 * page URL — a reload keeps what was typed. Nothing is submitted: the visitor
 * opens WhatsApp or email, reads the message and sends it.
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

  const update = (key: FormKey, value: string) => {
    const next = { ...values, [key]: value };
    setValues(next);
    const query = toParams(next).toString();
    window.history.replaceState(null, "", query ? `?${query}` : window.location.pathname);
  };

  const context = CONTEXT.map((key) => draft[key]).filter(Boolean);

  return (
    <div className="flex flex-col gap-8" data-composer={fromUrl ? "url" : "empty"}>
      {context.length > 0 && (
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 ed-meta text-text-secondary">
          <span>{form.context}</span>
          {context.map((item) => (
            <span key={item} className="border border-hairline-strong px-2 py-1 text-text-primary">
              {item}
            </span>
          ))}
        </p>
      )}

      <QuoteFields
        idPrefix="quote"
        values={values as Partial<Record<FormKey, string>>}
        onChange={update}
      />

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
