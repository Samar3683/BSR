import { Section } from "@/components/layout/section";
import { MediaSlot } from "@/components/media/media-slot";
import { TextLink } from "@/components/ui/text-link";
import { siteMedia } from "@/config/site-media";

import { faqContent as faq } from "../config/faq-content";

/**
 * FAQ — a cinematic, one-viewport moment. A full-bleed photograph of the
 * motorway at sunrise is the environment: anchored to the bottom of the
 * section and fading up into white, so the headline sits in clear sky while
 * the red BSR truck fills the lower part, its cab peeking in from the right of
 * the centred UI. Over it, centred and small: a green eyebrow flanked by
 * rules, a one-line headline ("domande?" in red), one sentence, and a compact
 * accordion of white surfaces.
 *
 * Readability without hiding the photograph: no black scrim — the photograph
 * fades into white where the text is, and the accordion's surfaces are
 * near-opaque white (the photograph stays visible around and between them).
 * The photograph is a real, decorative image (MediaSlot: responsive srcset,
 * lazy loading, blur placeholder; focal point per breakpoint), static — no
 * script, no scroll-linked motion, nothing continuous.
 *
 * The accordion is native `<details name="faq">`: keyboard operable (Tab,
 * Enter, Space), the expanded state exposed by the platform (no ARIA to keep in
 * step), one answer open at a time, readable without JavaScript, answers
 * findable with in-page search. The first answer is open by default; opening
 * another closes it. The answer eases open in height and opacity
 * (`disclosure`, 360 ms) and the plus folds into a red minus — instantly under
 * reduced motion. State is never colour alone: plus → minus, and the open
 * surface gains a green edge.
 */
export function FaqSection() {
  return (
    <Section
      tone="white"
      spacing="none"
      id={faq.id}
      aria-labelledby={`${faq.id}-title`}
      className="relative isolate flex min-h-[min(100svh,58rem)] items-center overflow-clip bg-white py-14 sm:py-16 lg:py-[6vh]"
    >
      {/* The photograph: bottom-anchored, its top edge dissolving into the white
          of the section. Focal point per breakpoint (config/site-media.ts). */}
      <div
        aria-hidden="true"
        className="absolute inset-x-0 bottom-0 -z-10 h-[80%] [mask-image:linear-gradient(to_bottom,transparent,black_24%)] sm:h-[78%] lg:h-[76%]"
      >
        <MediaSlot
          name="faq-background"
          media={siteMedia.faq.background}
          aspect="fill"
          sizes="100vw"
        />
      </div>

      <div className="mx-auto flex w-full max-w-[52rem] flex-col items-center gap-8 px-4 sm:px-8">
        <header className="flex flex-col items-center gap-3 text-center sm:gap-4">
          <p className="flex items-center gap-4 type-label-sm text-success">
            <span aria-hidden="true" className="h-px w-10 bg-success-graphic sm:w-14" />
            {faq.eyebrow}
            <span aria-hidden="true" className="h-px w-10 bg-success-graphic sm:w-14" />
          </p>
          <h2 id={`${faq.id}-title`} className="type-title text-balance">
            {faq.title[0]} <span className="text-action-primary">{faq.title[1]}</span>
          </h2>
          <p className="sm:text-base max-w-[38rem] text-[0.9375rem] leading-relaxed text-text-secondary">
            {faq.intro.before} <br className="hidden sm:inline" />
            {faq.intro.after} <TextLink href={faq.intro.link.href}>{faq.intro.link.label}</TextLink>
            .
          </p>
        </header>

        <div className="flex w-full max-w-[46rem] flex-col gap-2 sm:gap-2.5">
          {faq.items.map((item, i) => (
            <details
              key={item.question}
              name="faq"
              open={i === 0}
              className="group disclosure rounded-[0.875rem] border border-border-default bg-white/92 shadow-[0_8px_24px_-16px_rgb(9_11_11/0.45)] transition-[border-color,background-color] duration-300 open:border-success-graphic/45 open:bg-white/97 motion-reduce:transition-none"
            >
              <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-5 rounded-[0.875rem] px-4 py-3 text-text-primary sm:min-h-15 sm:px-6 [&::-webkit-details-marker]:hidden">
                <span className="type-faq-question">{item.question}</span>
                {/* Plus → minus: neutral when closed, red when open (never colour alone). */}
                <span aria-hidden="true" className="relative size-4 shrink-0">
                  <span className="absolute inset-x-0 top-1/2 h-0.5 -translate-y-1/2 rounded-full bg-text-secondary transition-colors duration-300 group-open:bg-action-primary motion-reduce:transition-none" />
                  <span className="absolute inset-y-0 left-1/2 w-0.5 -translate-x-1/2 rounded-full bg-text-secondary transition-transform duration-300 ease-enter group-open:scale-y-0 motion-reduce:transition-none" />
                </span>
              </summary>
              <p className="max-w-[40rem] px-4 pb-4 type-faq-answer text-text-secondary sm:px-6 sm:pb-5">
                {item.answer}
              </p>
            </details>
          ))}
        </div>
      </div>
    </Section>
  );
}
