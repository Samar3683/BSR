import { Container } from "@/components/layout/container";
import { Section } from "@/components/layout/section";
import { SectionHeader } from "@/components/layout/section-header";

import { faqContent as faq } from "../config/faq-content";

/**
 * FAQ, on Soft White: black questions over neutral rules, no cards — compact,
 * the heading beside the list on large screens, one answer open at a time
 * (native exclusive <details name>).
 *
 * Native `<details>` / `<summary>` disclosures: keyboard-operable (Tab, Enter,
 * Space) with no script, the expanded / collapsed state exposed by the
 * platform to assistive technology, answers findable with in-page search, and
 * everything readable without JavaScript.
 *
 * Microinteraction: hovering or focusing a question grows a green line from
 * the left along its rule (it stays while the answer is open); the green +
 * folds into a red − when open; the answer eases open in height and opacity
 * (`disclosure`) — instantly under reduced motion.
 */
export function FaqSection() {
  return (
    <Section tone="soft-white" spacing="md" id={faq.id} aria-labelledby={`${faq.id}-title`}>
      <Container className="flex flex-col gap-10 lg:layout-grid lg:gap-y-0">
        <SectionHeader
          id={`${faq.id}-title`}
          eyebrow={faq.eyebrow}
          title={faq.title}
          intro={faq.intro}
          layout="stacked"
          className="lg:col-span-4"
        />
        <div className="border-b border-border-default lg:col-span-8">
          {faq.items.map((item) => (
            <details
              key={item.question}
              name="faq"
              className="group disclosure border-t border-border-default"
            >
              <summary className="relative flex cursor-pointer list-none items-start justify-between gap-6 py-5 text-text-primary sm:py-6 [&::-webkit-details-marker]:hidden">
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute -top-px left-0 h-0.5 w-full origin-left scale-x-0 bg-success-graphic transition-transform duration-500 ease-enter group-open:scale-x-100 group-hover:scale-x-100 group-has-[summary:focus-visible]:scale-x-100 motion-reduce:transition-none"
                />
                <span className="type-heading-sm">{item.question}</span>
                {/* A green plus that turns half a revolution and folds into a red minus when open. */}
                <span
                  aria-hidden="true"
                  className="relative mt-[0.35em] size-4 shrink-0 transition-transform duration-[350ms] ease-ui group-open:rotate-180 motion-reduce:transition-none"
                >
                  <span className="absolute inset-x-0 top-1/2 h-0.5 -translate-y-1/2 bg-success-graphic transition-colors duration-500 group-open:bg-action-primary motion-reduce:transition-none" />
                  <span className="absolute inset-y-0 left-1/2 w-0.5 -translate-x-1/2 bg-success-graphic transition-transform duration-500 ease-enter group-open:scale-y-0 motion-reduce:transition-none" />
                </span>
              </summary>
              <p className="max-w-text pb-6 type-body-md text-text-secondary">{item.answer}</p>
            </details>
          ))}
        </div>
      </Container>
    </Section>
  );
}
