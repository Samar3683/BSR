import { MessageCircle, Phone } from "lucide-react";

import { ActionLink } from "@/components/editorial/action";
import { MediaSlot } from "@/components/media/media-slot";
import { siteConfig } from "@/config/site";
import { ActLabel, InkTitle, seg } from "@/features/story/components/cine";
import { PinnedScene } from "@/features/story/components/scene";
import { actOf } from "@/features/story/config/acts";

import { quoteContent as quote } from "../config/quote-content";

/**
 * ACT 12 — Arrivo. The film's last frame.
 *
 * Pinned (≈ 2 viewports): the departure at dawn fills the screen and the
 * camera pushes in slowly; across the top the route of the whole film draws
 * from Carpi to the red destination, which pulses as it is reached; the
 * statement is inked, very large — "Il tuo carico. La nostra strada." — and
 * the frame grows quieter (the light falls) as it ends. The question, the
 * request (red), WhatsApp (soft white) and the phone stay in place throughout
 * — nothing to wait for to act. Then the credits (the footer).
 *
 * Unpinned: the same frame, still.
 */
export function QuoteSection() {
  const { contact } = siteConfig;
  const titleId = `${quote.id}-title`;
  const act = actOf(quote.id);
  return (
    <PinnedScene id={quote.id} act={act} tone="carbon" labelledBy={titleId} conversion>
      {/* The departure, pushed in slowly; the light falls at the end. */}
      <div aria-hidden="true" className="absolute inset-0 overflow-clip">
        <div className="absolute inset-0 seg scrub:[scale:calc(1+0.14*var(--t))]" style={seg(0, 1)}>
          <MediaSlot name="quote-background" media={quote.media} aspect="fill" sizes="100vw" />
        </div>
        <div className="absolute inset-0 bg-linear-to-t from-carbon/90 via-carbon/55 to-carbon/30 lg:bg-linear-to-r lg:from-carbon/88 lg:via-carbon/50 lg:to-carbon/5" />
        <div
          className="absolute inset-0 hidden bg-carbon seg pinned:block pinned:opacity-[calc(var(--t)*0.45)]"
          style={seg(0.7, 1)}
        />
      </div>

      <div className="relative ed-frame flex min-h-[min(40rem,90svh)] flex-col justify-center gap-[clamp(1.5rem,4svh,2.75rem)] py-[clamp(5rem,12svh,8rem)] pin:h-full pin:min-h-0 pin:pt-(--header-height)">
        <ActLabel act={act.act} name={quote.act.name} />

        {/* The whole film's route, arriving. */}
        <div aria-hidden="true" data-reveal="group" className="max-w-[56rem]">
          <div className="relative h-8">
            <span className="absolute inset-x-0 top-1/2 h-px bg-hairline-strong" />
            <span
              className="absolute inset-x-0 top-1/2 h-px origin-left bg-success-graphic seg scrub:[scale:var(--e)_1]"
              style={seg(0.02, 0.36)}
            />
            <span className="absolute top-1/2 left-0 size-2.5 -translate-y-1/2 rounded-full bg-success-graphic" />
            <span className="absolute top-1/2 right-0 grid size-8 translate-x-1/2 -translate-y-1/2 place-items-center">
              <span className="absolute inset-0 ring-pulse rounded-full bg-action-primary/30 pending:[animation-play-state:paused]" />
              <span className="size-3 rotate-45 bg-action-primary" />
            </span>
          </div>
          <div className="mt-2 flex justify-between ed-meta text-text-secondary">
            <span>{quote.route[0]}</span>
            <span className="text-text-primary">{quote.route[1]}</span>
          </div>
        </div>

        <InkTitle
          id={titleId}
          lines={quote.statement}
          className="max-w-[16ch] cine-statement"
          from={0.08}
          to={0.42}
        />

        <div className="flex max-w-[40rem] flex-col gap-2">
          <p className="ed-h4 text-text-primary">
            {quote.title[0]} {quote.title[1]}
          </p>
          <p className="ed-lede text-text-secondary">{quote.body}</p>
        </div>

        <div className="flex flex-col gap-5">
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
          <a
            href={contact.phoneHref}
            className="inline-flex min-h-(--target-min) items-center gap-2.5 self-start ed-action text-text-secondary transition-colors duration-200 hover:text-text-primary"
          >
            <Phone aria-hidden="true" strokeWidth={1.75} className="size-4 text-success" />
            {quote.callLabel}
            <span className="text-text-primary tabular-nums">{contact.phoneDisplay}</span>
          </a>
        </div>
      </div>
    </PinnedScene>
  );
}
