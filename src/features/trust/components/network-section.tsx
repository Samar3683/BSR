import Image from "next/image";

import { Chapter } from "@/components/editorial/chapter";
import { Label } from "@/components/editorial/label";

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
  const cells = Math.max(network.cells, Math.ceil(partners.length / 4) * 4);
  const titleId = `${network.id}-title`;

  return (
    <Chapter id={network.id} tone="white" labelledBy={titleId} {...network.chapter}>
      <div className="ed-grid gap-y-10 lg:items-end">
        <div data-reveal="rise" className="col-span-4 flex flex-col gap-5 md:col-span-8 lg:col-span-6">
          <Label>{network.label}</Label>
          <h2 id={titleId} className="ed-h2 text-balance">
            {network.title}
          </h2>
          <p className="max-w-[34rem] ed-body text-text-secondary">{network.intro}</p>
          <p className="max-w-[34rem] border-l-2 border-success-graphic pl-4 ed-small text-text-primary">
            {network.policy}
          </p>
        </div>

        <div className="col-span-4 md:col-span-8 lg:col-span-9 lg:col-start-8">
          {partners.length > 0 ? (
            <ul
              aria-label={network.partnersLabel}
              className="grid grid-cols-2 border-t border-l border-hairline sm:grid-cols-4"
            >
              {Array.from({ length: cells }, (_, i) => {
                const partner = partners[i];
                return (
                  <li key={partner?.name ?? `cell-${i}`} className={cell}>
                    <Index i={i} />
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
            <div aria-hidden="true" className="grid grid-cols-2 border-t border-l border-hairline sm:grid-cols-4">
              {Array.from({ length: cells }, (_, i) => (
                <div key={i} className={cell}>
                  <Index i={i} />
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
  "relative flex aspect-[16/10] items-center justify-center border-r border-b border-hairline ed-ticks p-6";

function Index({ i }: { i: number }) {
  return (
    <span aria-hidden="true" className="absolute top-3 left-3.5 ed-meta text-text-secondary">
      {String(i + 1).padStart(2, "0")}
    </span>
  );
}

function Mark({ partner }: { partner: ReturnType<typeof approvedClients>[number] }) {
  return (
    <Image
      src={partner.logo}
      alt={partner.name}
      width={partner.width}
      height={partner.height}
      className="h-9 w-auto opacity-70 grayscale transition duration-500 group-hover:opacity-100 group-hover:grayscale-0 group-focus-visible:opacity-100 group-focus-visible:grayscale-0 motion-reduce:transition-none"
    />
  );
}
