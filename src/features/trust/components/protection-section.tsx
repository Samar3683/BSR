import { Chapter } from "@/components/editorial/chapter";
import { Label } from "@/components/editorial/label";
import { MediaFrame } from "@/components/media/media-frame";

import { protectionContent as protection } from "../config/protection-content";

/**
 * Chapter 07 — "can I trust you with it?", on Soft White: a large cargo
 * photograph running off the left edge of the page (it opens from the left
 * and drifts ±3% with the scroll on large screens, never on low-power
 * devices or under reduced motion), and beside it the heading and the four
 * principles in the official site's own words — on hairlines, joined by one
 * green route line with a node per principle. No cards, no green page.
 */
export function ProtectionSection() {
  const titleId = `${protection.id}-title`;
  return (
    <Chapter id={protection.id} tone="soft-white" labelledBy={titleId} {...protection.chapter}>
      <div className="ed-grid gap-y-8 lg:grid-rows-[auto_auto] lg:gap-y-8">
        <header data-reveal="rise" className="col-span-4 flex flex-col gap-5 md:col-span-8 lg:col-span-8 lg:col-start-9 lg:row-start-1 lg:self-end">
          <Label>{protection.label}</Label>
          <h2 id={titleId} className="ed-h2 text-balance">
            {protection.title}
          </h2>
          <p className="max-w-[36rem] ed-body text-text-secondary">{protection.intro}</p>
        </header>

        <div className="col-span-4 md:col-span-8 lg:col-span-7 lg:row-span-2 lg:row-start-1 lg:self-center lg:ed-bleed-l">
          <MediaFrame
            name="security-main"
            media={protection.media}
            sizes="(min-width: 64rem) 50vw, 100vw"
            reveal="left"
            parallax
            className="aspect-[4/3] lg:aspect-auto lg:h-[min(34rem,66svh)]"
          />
        </div>

        <div className="col-span-4 md:col-span-8 lg:col-span-8 lg:col-start-9 lg:row-start-2">
          <ol data-reveal="group" className="relative">
            {/* The route joining the principles: it draws down as the list arrives. */}
            <span aria-hidden="true" className="absolute top-2 bottom-2 left-[5px] w-px bg-hairline-strong" />
            <span
              aria-hidden="true"
              className="absolute top-2 bottom-2 left-[5px] w-px origin-top bg-success-graphic transition-[scale] delay-200 duration-[1200ms] ease-cinematic pending:scale-y-0"
            />
            {protection.principles.map((principle, i) => (
              <li
                key={principle.code}
                className="relative grid grid-cols-[2.25rem_1fr] gap-x-2 border-b border-hairline py-4 pl-7 first:pt-1 last:border-b-0"
              >
                <span
                  aria-hidden="true"
                  className="absolute top-[1.4rem] left-0 size-[11px] rounded-full border-2 border-background-primary bg-success-graphic transition-[scale] duration-300 ease-enter pending:scale-0 in-[li:first-child]:top-[0.4rem]"
                  style={{ transitionDelay: `${300 + i * 220}ms` }}
                />
                <span aria-hidden="true" className="ed-label text-success tabular-nums">
                  {principle.code}
                </span>
                <div className="flex flex-col gap-1">
                  <h3 className="ed-h4">{principle.title}</h3>
                  <p className="max-w-[52ch] ed-small text-text-secondary">{principle.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </Chapter>
  );
}
