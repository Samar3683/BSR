import { MessageCircle, Phone } from "lucide-react";
import type { CSSProperties } from "react";

import { ActionLink } from "@/components/editorial/action";
import { Surface } from "@/components/layout/surface";
import { MediaFrame } from "@/components/media/media-frame";
import { siteConfig } from "@/config/site";

import { quoteContent as quote } from "../config/quote-content";

/**
 * The close — the final scene. A departure at dawn fills the chapter under a
 * controlled Carbon overlay: darker on the left where the text sits (from
 * `lg`; from below on phones), clear on the right where the truck stays
 * visible — readable without a black panel. The photograph pushes in slowly as
 * it is scrolled through and drifts a few percent; the content stays still.
 *
 * Above the statement a small route marks the journey (green origin, red
 * destination). Then the statement, one line, and the two actions — red for
 * the request, soft white for WhatsApp — and the phone. Instant under reduced
 * motion.
 */
export function QuoteSection() {
  const { contact } = siteConfig;
  const titleId = `${quote.id}-title`;
  return (
    <Surface
      as="section"
      tone="carbon"
      id={quote.id}
      data-conversion
      data-reveal="group"
      aria-labelledby={titleId}
      className="relative isolate overflow-clip ed-chapter"
    >
      <div className="absolute inset-0 -z-10">
        <MediaFrame
          name="quote-background"
          media={quote.media}
          sizes="100vw"
          parallax
          scrollScale="push"
          decorative
          className="h-full"
        />
      </div>
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-linear-to-t from-background-primary/90 via-background-primary/55 to-background-primary/25 lg:bg-linear-to-r lg:from-background-primary/85 lg:via-background-primary/45 lg:to-background-primary/5"
      />

      <div className="ed-frame flex min-h-[min(30rem,56svh)] flex-col justify-center gap-8">
        <p aria-hidden="true" className="flex items-center gap-3 ed-meta text-text-secondary">
          <span className="size-2 rounded-full bg-success-graphic" />
          <span>{quote.route[0]}</span>
          <span className="h-px w-16 origin-left bg-success-graphic transition-[scale] delay-300 duration-700 ease-cinematic pending:scale-x-0 sm:w-28" />
          <span className="size-2 rotate-45 bg-action-primary" />
          <span className="text-text-primary">{quote.route[1]}</span>
        </p>
        <header data-reveal="rise" className="flex max-w-[56rem] flex-col gap-5">
          <h2 id={titleId} className="ed-statement text-balance">
            {quote.title[0]} {quote.title[1]}
          </h2>
          <p className="max-w-[34rem] ed-lede text-text-secondary">{quote.body}</p>
        </header>
        <div
          data-reveal="rise"
          style={{ "--reveal-delay": "400ms" } as CSSProperties}
          className="flex flex-col gap-5"
        >
          <div className="flex flex-col gap-3 sm:flex-row">
            <ActionLink href={quote.primary.href} size="lg">
              {quote.primary.label}
            </ActionLink>
            <ActionLink
              href={quote.whatsapp.href}
              variant="inverse"
              size="lg"
              leadingIcon={MessageCircle}
              icon={null}
            >
              {quote.whatsapp.label}
              <span className="sr-only"> {quote.whatsapp.hint}</span>
            </ActionLink>
          </div>
          <div>
            <a
              href={contact.phoneHref}
              className="inline-flex min-h-(--target-min) items-center gap-2.5 ed-action text-text-secondary transition-colors duration-200 hover:text-text-primary"
            >
              <Phone aria-hidden="true" strokeWidth={1.75} className="size-4 text-success" />
              {quote.callLabel}
              <span className="text-text-primary tabular-nums">{contact.phoneDisplay}</span>
            </a>
          </div>
        </div>
      </div>
    </Surface>
  );
}
