"use client";

import { CircleAlert, CircleCheck, Search, Send } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";

import { textControlStyles } from "@/components/forms/control-styles";
import { Button } from "@/components/ui/button";
import { cx } from "@/lib/utils/cx";

import {
  type MessageStatus,
  type OrderStatus,
  type QuoteStatus,
  trackingContent as content,
} from "../config/tracking-content";

interface Entry {
  direction: "in" | "out";
  body: string;
  at: string;
}

interface Tracked {
  kind: "quote" | "message";
  reference: string;
  status: string;
  received_at: string;
  route?: { from?: string; to?: string };
  subject?: string | null;
  first_message?: string;
  entries: Entry[];
  order?: {
    order_number: string;
    status: OrderStatus;
    pickup_at: string | null;
    delivery_at: string | null;
    history: { status: OrderStatus; at: string }[];
  } | null;
}

const when = new Intl.DateTimeFormat("it-IT", {
  timeZone: "Europe/Rome",
  day: "numeric",
  month: "long",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});
const format = (value: string | null) => (value ? when.format(new Date(value)) : "—");

function statusLabel(tracked: Tracked): string {
  const table: Record<string, string> =
    tracked.kind === "quote" ? content.quoteStatus : content.messageStatus;
  return table[tracked.status as QuoteStatus & MessageStatus] ?? tracked.status;
}

/** Looks up a code and shows the request, its conversation and, once it is a transport, its progress. */
export function TrackingView() {
  const params = useSearchParams();
  const initial = params.get("codice") ?? "";
  const [code, setCode] = useState(initial);
  const [tracked, setTracked] = useState<Tracked | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [follow, setFollow] = useState<{
    kind: "idle" | "sending" | "sent" | "error";
    text?: string;
  }>({ kind: "idle" });
  const lastCode = useRef("");

  const lookup = async (value: string) => {
    const wanted = value.trim();
    if (!wanted) {
      setError(content.form.empty);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/tracking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: wanted }),
      });
      const data = (await response.json().catch(() => ({}))) as Tracked & {
        error?: { message?: string };
      };
      if (response.ok && data.reference) {
        lastCode.current = wanted;
        setTracked(data);
      } else {
        setTracked(null);
        setError(
          response.status === 404
            ? content.form.notFound
            : (data.error?.message ?? content.form.failed),
        );
      }
    } catch {
      setTracked(null);
      setError(content.form.failed);
    } finally {
      setBusy(false);
    }
  };

  // A code in the address (from the email or the confirmation) is looked up at once.
  useEffect(() => {
    if (initial) void Promise.resolve().then(() => lookup(initial));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only once, for the code in the URL
  }, []);

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    void lookup(code);
  };

  const sendFollowUp = async (event: FormEvent) => {
    event.preventDefault();
    if (!message.trim()) {
      setFollow({ kind: "error", text: content.followUp.empty });
      return;
    }
    setFollow({ kind: "sending" });
    try {
      const response = await fetch("/api/tracking/reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: lastCode.current, message }),
      });
      if (!response.ok) throw new Error("failed");
      setMessage("");
      setFollow({ kind: "sent", text: content.followUp.sent });
      await lookup(lastCode.current);
    } catch {
      setFollow({ kind: "error", text: content.followUp.failed });
    }
  };

  return (
    <div className="flex flex-col gap-8">
      <form onSubmit={onSubmit} className="flex flex-col gap-3" noValidate>
        <label htmlFor="tracking-code" className="ed-label text-text-primary">
          {content.form.label}
        </label>
        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            id="tracking-code"
            name="codice"
            value={code}
            onChange={(event) => setCode(event.target.value)}
            placeholder={content.form.placeholder}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            maxLength={40}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? "tracking-error" : undefined}
            className={cx(textControlStyles, "rounded-sm focus:border-success-graphic sm:max-w-sm")}
          />
          <Button
            type="submit"
            leadingIcon={Search}
            loading={busy}
            loadingLabel={content.form.checking}
          >
            {content.form.submit}
          </Button>
        </div>
        {error && (
          <p
            id="tracking-error"
            role="alert"
            className="flex items-center gap-2 ed-small text-danger"
          >
            <CircleAlert aria-hidden="true" strokeWidth={1.75} className="size-4 shrink-0" />
            {error}
          </p>
        )}
      </form>

      {tracked ? (
        <section
          aria-label={content.kinds[tracked.kind]}
          data-testid="tracking-result"
          className="flex flex-col gap-8 bg-background-primary p-5 sm:p-8"
        >
          <header className="flex flex-col gap-2">
            <p className="ed-meta text-text-secondary">{content.kinds[tracked.kind]}</p>
            <h2 className="type-heading-md tabular-nums">{tracked.reference}</h2>
            <dl className="grid gap-x-8 gap-y-2 type-body-sm sm:grid-cols-[auto_1fr]">
              <dt className="text-text-secondary">{content.labels.status}</dt>
              <dd className="font-medium" data-testid="tracking-status">
                {statusLabel(tracked)}
              </dd>
              <dt className="text-text-secondary">{content.labels.received}</dt>
              <dd>{format(tracked.received_at)}</dd>
              {tracked.route?.from || tracked.route?.to ? (
                <>
                  <dt className="text-text-secondary">{content.labels.route}</dt>
                  <dd>
                    {tracked.route.from ?? "—"} → {tracked.route.to ?? "—"}
                  </dd>
                </>
              ) : null}
            </dl>
          </header>

          {tracked.order ? (
            <section
              aria-labelledby="tracking-transport"
              className="flex flex-col gap-3 border-t border-hairline pt-6"
            >
              <h3 id="tracking-transport" className="type-heading-sm">
                {content.labels.transport}
              </h3>
              <dl className="grid gap-x-8 gap-y-2 type-body-sm sm:grid-cols-[auto_1fr]">
                <dt className="text-text-secondary">{content.labels.order}</dt>
                <dd className="tabular-nums">{tracked.order.order_number}</dd>
                <dt className="text-text-secondary">{content.labels.status}</dt>
                <dd className="font-medium" data-testid="order-status">
                  {content.orderStatus[tracked.order.status] ?? tracked.order.status}
                </dd>
                <dt className="text-text-secondary">{content.labels.pickup}</dt>
                <dd>{format(tracked.order.pickup_at)}</dd>
                <dt className="text-text-secondary">{content.labels.delivery}</dt>
                <dd>{format(tracked.order.delivery_at)}</dd>
              </dl>
              {tracked.order.history.length ? (
                <ol
                  aria-label={content.labels.history}
                  className="flex flex-col border-t border-border-default"
                >
                  {tracked.order.history.map((item, index) => (
                    <li
                      key={`${item.status}-${item.at}-${index}`}
                      className="flex flex-wrap justify-between gap-2 border-b border-border-default py-2 type-body-sm"
                    >
                      <span>{content.orderStatus[item.status] ?? item.status}</span>
                      <span className="text-text-secondary">{format(item.at)}</span>
                    </li>
                  ))}
                </ol>
              ) : null}
            </section>
          ) : null}

          <section
            aria-labelledby="tracking-conversation"
            className="flex flex-col gap-3 border-t border-hairline pt-6"
          >
            <h3 id="tracking-conversation" className="type-heading-sm">
              {content.labels.conversation}
            </h3>
            <ol className="flex flex-col gap-3" data-testid="tracking-thread">
              {tracked.first_message ? (
                <li className="max-w-prose self-start bg-background-secondary p-4 type-body-sm">
                  <p className="[overflow-wrap:anywhere] whitespace-pre-wrap">
                    {tracked.first_message}
                  </p>
                  <p className="mt-1 ed-small text-text-secondary">
                    {content.labels.you} · {format(tracked.received_at)}
                  </p>
                </li>
              ) : null}
              {tracked.entries.map((entry, index) => (
                <li
                  key={`${entry.at}-${index}`}
                  className={cx(
                    "max-w-prose p-4 type-body-sm",
                    entry.direction === "out"
                      ? "self-end border-l-4 border-success-graphic bg-background-secondary"
                      : "self-start bg-background-secondary",
                  )}
                >
                  <p className="[overflow-wrap:anywhere] whitespace-pre-wrap">{entry.body}</p>
                  <p className="mt-1 ed-small text-text-secondary">
                    {entry.direction === "out" ? content.labels.team : content.labels.you} ·{" "}
                    {format(entry.at)}
                  </p>
                </li>
              ))}
              {!tracked.first_message && !tracked.entries.length ? (
                <li className="type-body-sm text-text-secondary">{content.labels.noEntries}</li>
              ) : null}
            </ol>

            <form onSubmit={sendFollowUp} className="flex flex-col gap-3" noValidate>
              <label htmlFor="tracking-follow" className="ed-label text-text-primary">
                {content.followUp.label}
              </label>
              <textarea
                id="tracking-follow"
                rows={3}
                maxLength={2000}
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                placeholder={content.followUp.placeholder}
                className={cx(textControlStyles, "rounded-sm focus:border-success-graphic")}
              />
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  type="submit"
                  leadingIcon={Send}
                  loading={follow.kind === "sending"}
                  loadingLabel={content.followUp.sending}
                >
                  {content.followUp.submit}
                </Button>
                {follow.kind === "sent" ? (
                  <p role="status" className="flex items-center gap-2 type-body-sm">
                    <CircleCheck aria-hidden="true" className="size-4 text-success" />
                    {follow.text}
                  </p>
                ) : null}
                {follow.kind === "error" ? (
                  <p role="alert" className="text-error type-body-sm">
                    {follow.text}
                  </p>
                ) : null}
              </div>
            </form>
          </section>
        </section>
      ) : null}
    </div>
  );
}
