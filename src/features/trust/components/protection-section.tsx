import { Container } from "@/components/layout/container";
import { Section } from "@/components/layout/section";
import { SectionHeader } from "@/components/layout/section-header";
import { MediaFrame } from "@/components/media/media-frame";

import { protectionContent as protection } from "../config/protection-content";

/**
 * Cargo security, on Deep Green — the brand's trust surface, soft-white text,
 * no black. An editorial split: the secured load as one large photograph
 * (opening from the left, a ±3% parallax on large screens), and beside it the
 * message and the four principles as a list on thin white rules — a number,
 * the principle in capitals, the supplied commitment. No cards on the green.
 */
export function ProtectionSection() {
  return (
    <Section
      tone="green"
      spacing="md"
      id={protection.id}
      aria-labelledby={`${protection.id}-title`}
    >
      <Container className="flex flex-col gap-10 lg:layout-grid lg:items-center lg:gap-y-0">
        <MediaFrame
          name="security-main"
          media={protection.media}
          sizes="(min-width: 64rem) 45vw, 100vw"
          reveal="left"
          parallax
          className="aspect-[4/3] lg:col-span-6 lg:aspect-auto lg:h-[min(36rem,68svh)]"
        />
        <div className="flex flex-col gap-8 lg:col-span-5 lg:col-start-8">
          <SectionHeader
            id={`${protection.id}-title`}
            eyebrow={protection.eyebrow}
            title={protection.title}
            intro={protection.intro}
            layout="stacked"
          />
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
                  <p className="type-body-sm text-text-secondary">{principle.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </Container>
    </Section>
  );
}
