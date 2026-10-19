import Image from "next/image";

import { Chapter } from "@/components/editorial/chapter";
import { Label } from "@/components/editorial/label";
import { InkTitle } from "@/features/story/components/cine";

import { approvedClients, networkContent as network } from "../config/network-content";

/**
 * Chapter 08 — "who already works with you?", on White. The heading and the
 * statement on the left; on the right a technical logo grid — hairline cells
 * with corner ticks and a mono index — where approved client marks appear
 * (network-content.ts: written consent recorded), monochrome, their own colour
 * on hover or keyboard focus.
 *
 * Until a mark is approved the cells stay empty and say so ("Spazio logo"),
 * and the policy is stated beside them: nothing invented, no sample brand.
 * The empty frame is decorative; the policy is real text.
 */
export function NetworkSection() {
  const partners = approvedClients(network.partners);
  // Only the approved marks get a cell: no empty frames.
  const cells = partners.length;
  const titleId = `${network.id}-title`;

  return (
    <Chapter id={network.id} tone="white" labelledBy={titleId} {...network.chapter}>
      <div className="ed-grid gap-y-10 lg:items-end">
        <div
          data-reveal="rise"
          className="col-span-4 flex flex-col gap-5 md:col-span-8 lg:col-span-6"
        >
          <Label>{network.label}</Label>
          <InkTitle
            id={titleId}
            lines={network.titleLines}
            className="cine-title text-[clamp(2.25rem,1rem+3.4vw,4.75rem)]"
            from={0.12}
            to={0.32}
          />
          <p className="max-w-[34rem] ed-body text-text-secondary">{network.intro}</p>
          <p className="max-w-[34rem] border-l-2 border-success-graphic pl-4 ed-small text-text-primary">
            {network.policy}
          </p>
        </div>

        <div className="col-span-4 md:col-span-8 lg:col-span-9 lg:col-start-8">
          {partners.length > 0 ? (
            <ul
              aria-label={network.partnersLabel}
              className="grid grid-cols-2 gap-4 sm:grid-cols-3"
            >
              {Array.from({ length: cells }, (_, i) => {
                const partner = partners[i];
                return (
                  <li key={partner?.name ?? `cell-${i}`} className={cell}>
                    {partner &&
                      (partner.website ? (
                        <a href={partner.website} className="group rounded-sm">
                          <Mark partner={partner} />
                        </a>
                      ) : (
                        <span className="group">
                          <Mark partner={partner} />
                        </span>
                      ))}
                  </li>
                );
              })}
            </ul>
          ) : (
            <div
              aria-hidden="true"
              className="grid grid-cols-2 border-t border-l border-hairline sm:grid-cols-4"
            >
              {Array.from({ length: cells }, (_, i) => (
                <div key={i} className={cell}>
                  <span className="ed-meta text-text-secondary">{network.emptyCell}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Chapter>
  );
}

const cell =
  "group/cell relative flex aspect-[16/10] items-center justify-center rounded-2xl bg-background-primary p-6 shadow-[0_2px_14px_rgb(0_0_0/0.07)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_10px_28px_rgb(0_0_0/0.12)] motion-reduce:transition-none motion-reduce:hover:translate-y-0";

function Mark({ partner }: { partner: ReturnType<typeof approvedClients>[number] }) {
  return (
    <Image
      src={partner.logo}
      alt={partner.name}
      width={partner.width}
      height={partner.height}
      className="ease-out h-12 w-auto max-w-full object-contain transition duration-500 group-hover/cell:scale-110 motion-reduce:transition-none motion-reduce:group-hover/cell:scale-100"
    />
  );
}
