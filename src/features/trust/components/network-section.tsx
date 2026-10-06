import Image from "next/image";
import { Fragment } from "react";

import { RouteMarker } from "@/components/graphics/route-marker";
import { Container } from "@/components/layout/container";
import { Section } from "@/components/layout/section";
import { SectionHeader } from "@/components/layout/section-header";

import { approvedClients, networkContent as network } from "../config/network-content";

/**
 * Clients, on Warm White — a short trust interlude after cargo security. The
 * statement, then the sectors BSR serves set as one route across the page
 * (green nodes on a drawn line). When verified client marks exist
 * (network-content.ts), they appear as a ruled row between the two —
 * monochrome, their own colour on hover or keyboard focus. Nothing invented,
 * no empty placeholder.
 */
export function NetworkSection() {
  const partners = approvedClients(network.partners);
  const { categories } = network;
  return (
    <Section
      tone="warm-white"
      spacing="sm"
      id={network.id}
      aria-labelledby={`${network.id}-title`}
    >
      <Container className="flex flex-col gap-8">
        <SectionHeader
          id={`${network.id}-title`}
          eyebrow={network.eyebrow}
          title={network.title}
          intro={network.intro}
        />

        {partners.length > 0 && (
          <ul
            aria-label={network.partnersLabel}
            className="grid grid-cols-2 border-t border-l border-border-default sm:grid-cols-3 lg:grid-cols-6"
          >
            {partners.map((partner) => {
              const mark = (
                <Image
                  src={partner.logo}
                  alt={partner.name}
                  width={partner.width}
                  height={partner.height}
                  className="h-10 w-auto opacity-60 grayscale transition duration-500 group-hover:opacity-100 group-hover:grayscale-0 group-focus-visible:opacity-100 group-focus-visible:grayscale-0 motion-reduce:transition-none"
                />
              );
              return (
                <li
                  key={partner.name}
                  className="flex aspect-[3/2] items-center justify-center border-r border-b border-border-default p-6"
                >
                  {partner.website ? (
                    <a href={partner.website} className="group rounded-sm">
                      {mark}
                    </a>
                  ) : (
                    <span className="group">{mark}</span>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        <div data-reveal="slide" className="flex flex-col gap-3">
          <p className="type-label-sm text-text-muted">{network.categoriesLabel}</p>
          <ul className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
            {categories.map((category, i) => (
              <Fragment key={category}>
                {i > 0 && (
                  <li
                    aria-hidden="true"
                    className="hidden h-0.5 flex-1 origin-left bg-success-graphic transition-[scale] duration-700 ease-cinematic pending:scale-x-0 sm:block"
                    style={{ transitionDelay: `${i * 150}ms` }}
                  />
                )}
                <li className="flex items-center gap-3 type-heading-md">
                  {i === categories.length - 1 ? (
                    <RouteMarker variant="destination" />
                  ) : (
                    <RouteMarker />
                  )}
                  {category}
                </li>
              </Fragment>
            ))}
          </ul>
        </div>
      </Container>
    </Section>
  );
}
