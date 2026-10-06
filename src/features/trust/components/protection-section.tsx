import { Container } from "@/components/layout/container";
import { Eyebrow } from "@/components/layout/eyebrow";
import { Section } from "@/components/layout/section";
import { MediaFrame } from "@/components/media/media-frame";

import { protectionContent as protection } from "../config/protection-content";

/**
 * Cargo security, on Deep Green — the brand's trust surface and its people-
 * and-presence moment, slower than the system before it. The page's weight
 * arrives through a SectionBridge (carbon washing into green) and the
 * photograph rises across that seam, running off the left edge of the page
 * with a faint green grade; the statement is wiped in line by line.
 *
 * Documentary motion only: the picture opens from the left, drifts ±3% with the
 * scroll (tablets and up) and is otherwise still. Beside it the statement and
 * the four principles on thin white rules — a number, the principle in
 * capitals, the supplied commitment. No cards on the green, no black.
 */
export function ProtectionSection() {
  return (
    <Section
      tone="green"
      spacing="md"
      id={protection.id}
      aria-labelledby={`${protection.id}-title`}
      className="overflow-x-clip"
    >
      <Container className="flex flex-col gap-10 lg:layout-grid lg:items-center lg:gap-y-0">
        <div className="relative -mx-(--spacing-gutter) lg:col-span-6 lg:mx-0 lg:-mt-[18vh] lg:ml-[calc(-1*(100vw-min(100vw-2*var(--spacing-gutter),80rem))/2)]">
          <MediaFrame
            name="security-main"
            media={protection.media}
            sizes="(min-width: 64rem) 55vw, 100vw"
            reveal="left"
            parallax
            className="aspect-[4/3] lg:aspect-auto lg:h-[min(40rem,74svh)]"
          />
          {/* A faint green grade: the photograph stays natural, only tied to the brand. */}
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-green-800/20 mix-blend-multiply"
          />
        </div>
        <div className="flex flex-col gap-8 lg:col-span-5 lg:col-start-8">
          <header data-reveal="editorial" className="flex flex-col gap-5">
            <Eyebrow>{protection.eyebrow}</Eyebrow>
            <h2 id={`${protection.id}-title`} className="type-statement text-balance">
              {protection.title}
            </h2>
            <p className="max-w-text type-lede text-text-secondary">{protection.intro}</p>
          </header>
          <ol data-reveal="rise" className="border-t border-border-default">
            {protection.principles.map((principle) => (
              <li
                key={principle.code}
                className="grid grid-cols-[2.5rem_1fr] gap-x-2 border-b border-border-default py-4"
              >
                <span aria-hidden="true" className="type-metadata text-text-muted tabular-nums">
                  {principle.code}
                </span>
                <div className="flex flex-col gap-1">
                  <h3 className="type-label-md tracking-[0.08em] uppercase">{principle.title}</h3>
                  <p className="text-base leading-snug text-text-secondary">{principle.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </Container>
    </Section>
  );
}
