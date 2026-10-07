import { ArrowUpRight } from "lucide-react";

import { Chapter } from "@/components/editorial/chapter";
import { Label } from "@/components/editorial/label";
import { siteConfig } from "@/config/site";

import { faqContent as faq } from "../config/faq-content";

/**
 * Chapter 12 — "what am I still unsure about?", on White: compact, quiet, no
 * photograph. Three columns from `lg`: the label, the question and one
 * sentence on the left; the list in the centre (numbered, on hairlines, small
 * type); a contact prompt on the right (phone, WhatsApp, email). One column on
 * phones.
 *
 * The list is native `<details name="faq">`: keyboard operable (Tab, Enter,
 * Space), the expanded state exposed by the platform, one answer open at a
 * time, readable without JavaScript, answers findable with in-page search. The
 * first answer is open by default. The answer eases open (`disclosure`,
 * 360 ms) and the green plus folds into a minus — instantly under reduced
 * motion; the open row's index and edge turn green (never colour alone).
 */
export function FaqSection() {
  const { contact } = siteConfig;
  const titleId = `${faq.id}-title`;
  const channels = [
    { label: faq.prompt.phone, value: contact.phoneDisplay, href: contact.phoneHref },
    {
      label: faq.prompt.whatsapp,
      value: contact.phoneDisplay,
      href: contact.whatsappHref,
      hint: faq.prompt.whatsappHint,
    },
    { label: faq.prompt.email, value: contact.email, href: `mailto:${contact.email}` },
  ];

  return (
    <Chapter id={faq.id} tone="white" labelledBy={titleId} {...faq.chapter}>
      <div className="ed-grid gap-y-10">
        <header className="col-span-4 flex flex-col gap-4 md:col-span-8 lg:col-span-4">
          <Label>{faq.label}</Label>
          <h2 id={titleId} className="ed-h3">
            {faq.title}
          </h2>
          <p className="max-w-[24rem] ed-small text-text-secondary">{faq.intro.before}</p>
        </header>

        <div className="col-span-4 border-t border-hairline-strong md:col-span-8 lg:col-span-8 lg:col-start-5">
          {faq.items.map((item, i) => (
            <details
              key={item.question}
              name="faq"
              open={i === 0}
              className="group disclosure relative border-b border-hairline"
            >
              <span
                aria-hidden="true"
                className="absolute top-0 bottom-0 -left-px w-0.5 origin-top scale-y-0 bg-success-graphic transition-[scale] duration-300 group-open:scale-y-100 motion-reduce:transition-none"
              />
              <summary className="grid min-h-14 cursor-pointer list-none grid-cols-[2.5rem_1fr_1rem] items-center gap-3 py-3 pl-4 text-text-primary transition-colors duration-200 hover:text-success [&::-webkit-details-marker]:hidden">
                <span aria-hidden="true" className="ed-meta text-text-secondary group-open:text-success">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="ed-body font-medium">{item.question}</span>
                {/* Plus → minus, in green. */}
                <span aria-hidden="true" className="relative size-3.5">
                  <span className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-success-graphic" />
                  <span className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-success-graphic transition-transform duration-300 ease-enter group-open:scale-y-0 motion-reduce:transition-none" />
                </span>
              </summary>
              <p className="max-w-[60ch] pr-8 pb-5 pl-[calc(2.5rem+1.75rem)] ed-small text-text-secondary">
                {item.answer}
              </p>
            </details>
          ))}
        </div>

        <aside
          aria-labelledby="faq-prompt"
          className="col-span-4 flex flex-col gap-4 md:col-span-8 lg:col-span-3 lg:col-start-14"
        >
          <h3 id="faq-prompt" className="ed-h4">
            {faq.prompt.title}
          </h3>
          <p className="ed-small text-text-secondary">{faq.prompt.body}</p>
          <ul className="flex flex-col border-t border-hairline">
            {channels.map((channel) => (
              <li key={channel.label} className="border-b border-hairline">
                <a
                  href={channel.href}
                  className="group/channel flex min-h-12 items-center justify-between gap-3 transition-colors duration-200 hover:text-success"
                >
                  <span className="flex flex-col">
                    <span className="ed-meta text-text-secondary">{channel.label}</span>
                    <span className="ed-small font-medium">
                      {channel.value}
                      {channel.hint && <span className="sr-only"> {channel.hint}</span>}
                    </span>
                  </span>
                  <ArrowUpRight
                    aria-hidden="true"
                    strokeWidth={1.75}
                    className="size-4 text-success-graphic transition-transform duration-200 motion-safe:group-hover/channel:-translate-y-0.5 motion-safe:group-hover/channel:translate-x-0.5"
                  />
                </a>
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </Chapter>
  );
}
