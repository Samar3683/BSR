"use client";

import { CircleAlert, CircleCheck, Send } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { textControlStyles } from "@/components/forms/control-styles";
import { Button } from "@/components/ui/button";
import { cx } from "@/lib/utils/cx";

import { messageContent as content } from "../config/message-content";
import {
  type MessageErrors,
  type MessageValues,
  sendMessage,
  validateMessage,
} from "../lib/message-validate";

const EMPTY: MessageValues = { name: "", email: "", phone: "", subject: "", message: "" };
const FIELD_ORDER = ["name", "email", "phone", "subject", "message"] as const;

function Error({ id, children }: { id: string; children: string }) {
  return (
    <p id={id} role="alert" className="flex items-center gap-2 ed-small text-danger">
      <CircleAlert aria-hidden="true" strokeWidth={1.75} className="size-4 shrink-0" />
      {children}
    </p>
  );
}

/** The contact form: checked here, stored for the team, answered from the panel. */
export function MessageForm() {
  const [values, setValues] = useState<MessageValues>(EMPTY);
  const [errors, setErrors] = useState<MessageErrors>({});
  const [openedAt] = useState(() => Date.now());
  const [state, setState] = useState<
    | { kind: "idle" }
    | { kind: "sending" }
    | { kind: "sent"; reference: string }
    | { kind: "error"; message: string }
  >({ kind: "idle" });

  const change = (key: keyof MessageValues, value: string) => {
    setValues((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined, contact: undefined }));
  };

  const submit = async () => {
    if (state.kind === "sending" || state.kind === "sent") return;
    const found = validateMessage(values);
    setErrors(found);
    const first = FIELD_ORDER.find((key) => found[key] || (key === "email" && found.contact));
    if (first) {
      document.getElementById(`message-${first}`)?.focus();
      return;
    }
    setState({ kind: "sending" });
    const result = await sendMessage(values, Date.now() - openedAt);
    setState(
      result.ok
        ? { kind: "sent", reference: result.reference }
        : { kind: "error", message: result.message },
    );
  };

  if (state.kind === "sent") {
    return (
      <div
        role="status"
        data-testid="message-sent"
        className="flex flex-col gap-3 border-l-4 border-success-graphic bg-background-primary p-5"
      >
        <p className="flex items-center gap-2 type-heading-sm">
          <CircleCheck aria-hidden="true" className="size-5 text-success" />
          {content.sentTitle}
        </p>
        <p className="type-body-sm">
          {content.sentCode}: <strong className="tabular-nums">{state.reference}</strong>
        </p>
        <p className="type-body-sm text-text-secondary">{content.sentBody}</p>
        <Link
          href={`/tracciamento?codice=${encodeURIComponent(state.reference)}`}
          className="self-start underline underline-offset-2"
        >
          {content.sentTrack}
        </Link>
      </div>
    );
  }

  const control = (
    key: keyof MessageValues,
    label: string,
    options: {
      type?: "text" | "email" | "tel";
      optional?: boolean;
      rows?: number;
      maxLength?: number;
      placeholder?: string;
      autoComplete?: string;
    } = {},
  ) => {
    const id = `message-${key}`;
    const error = errors[key] ?? (key === "email" ? errors.contact : undefined);
    const common = {
      id,
      name: key,
      value: values[key],
      onChange: (event: { target: { value: string } }) => change(key, event.target.value),
      placeholder: options.placeholder,
      maxLength: options.maxLength ?? 120,
      "aria-invalid": error ? (true as const) : undefined,
      "aria-describedby": error ? `${id}-error` : undefined,
      className: cx(textControlStyles, "rounded-sm focus:border-success-graphic"),
    };
    return (
      <div className="flex flex-col gap-2">
        <label htmlFor={id} className="ed-label text-text-primary">
          {label}
          {options.optional && (
            <span className="font-normal text-text-secondary"> ({content.optional})</span>
          )}
        </label>
        {key === "message" ? (
          <textarea {...common} rows={options.rows ?? 6} />
        ) : (
          <input
            {...common}
            type={options.type ?? "text"}
            autoComplete={options.autoComplete ?? "off"}
            inputMode={options.type === "tel" ? "tel" : undefined}
          />
        )}
        {error && <Error id={`${id}-error`}>{error}</Error>}
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-6" data-testid="message-form">
      <div className="grid gap-6 sm:grid-cols-2">
        {control("name", content.fields.name.label, {
          placeholder: content.fields.name.placeholder,
          autoComplete: "name",
        })}
        {control("email", content.fields.email.label, {
          type: "email",
          optional: true,
          placeholder: content.fields.email.placeholder,
          autoComplete: "email",
          maxLength: 100,
        })}
        {control("phone", content.fields.phone.label, {
          type: "tel",
          optional: true,
          placeholder: content.fields.phone.placeholder,
          autoComplete: "tel",
          maxLength: 40,
        })}
        {control("subject", content.fields.subject.label, {
          optional: true,
          placeholder: content.fields.subject.placeholder,
        })}
      </div>
      <p className="ed-small text-text-secondary">{content.contactHint}</p>
      {control("message", content.fields.message.label, {
        placeholder: content.fields.message.placeholder,
        maxLength: 2000,
      })}

      <div className="flex flex-col gap-3">
        <div>
          <Button
            leadingIcon={Send}
            loading={state.kind === "sending"}
            loadingLabel={content.sending}
            onClick={submit}
          >
            {content.submit}
          </Button>
        </div>
        {state.kind === "error" ? (
          <p role="alert" className="text-error type-body-sm">
            {state.message}
          </p>
        ) : null}
        <p className="type-caption text-text-muted">
          {content.privacy}{" "}
          <Link href="/privacy" className="underline underline-offset-2">
            {content.privacyLink}
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
