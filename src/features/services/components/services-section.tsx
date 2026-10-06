import { ArrowRight } from "lucide-react";
import { Fragment } from "react";

import { RouteMarker } from "@/components/graphics/route-marker";
import { Container } from "@/components/layout/container";
import { Section } from "@/components/layout/section";
import { SectionHeader } from "@/components/layout/section-header";
import { MediaFrame } from "@/components/media/media-frame";
import { ButtonLink } from "@/components/ui/button";
import { cx } from "@/lib/utils/cx";

import { servicesContent as services } from "../config/services-content";

/**
 * The service's action: outlined at rest, red while the service is hovered or
 * holds focus (the one action the reader is weighing). Devices without hover
 * show it red. `!`: these win over the outline variant's own colours.
 */
const ACTION =
  "group-hover/media:border-action-primary! group-hover/media:bg-action-primary! group-hover/media:text-on-action-primary! " +
  "group-focus-within/media:border-action-primary! group-focus-within/media:bg-action-primary! group-focus-within/media:text-on-action-primary! " +
  "[@media(hover:none)]:border-action-primary! [@media(hover:none)]:bg-action-primary! [@media(hover:none)]:text-on-action-primary!";

/**
 * Services, on White — the choice between two ways of moving, as two split
 * rows: the photograph (≈ 55%) beside what the service promises (≈ 45%),
 * mirrored from one to the next, joined by a green route (Ritiro → In viaggio →
 * Consegna) that draws itself between them.
 *
 * Hovering or focusing a service scales its photograph 1 → 1.03, draws its
 * green marker out and turns its action red; the text stays still. Each
 * action opens the request with the service already chosen.
 */
export function ServicesSection() {
  return (
    <Section tone="white" spacing="sm" id={services.id} aria-labelledby={`${services.id}-title`}>
      <Container className="flex flex-col gap-8">
        <SectionHeader
          id={`${services.id}-title`}
          eyebrow={services.eyebrow}
          title={services.title}
          intro={services.intro}
        />
        <div className="flex flex-col">
          {services.items.map((item, i) => {
            const mirrored = i % 2 === 1;
            return (
              <Fragment key={item.id}>
                {i > 0 && <ServiceRoute labels={services.connector} />}
                <article
                  id={item.id}
                  aria-labelledby={`${item.id}-title`}
                  className="group/media grid gap-6 lg:grid-cols-[11fr_9fr] lg:items-center lg:gap-0"
                >
                  <MediaFrame
                    name={`service-${item.id}`}
                    media={item.media}
                    sizes="(min-width: 64rem) 50vw, 100vw"
                    reveal="left"
                    zoom
                    className={cx(
                      "aspect-[16/10] sm:aspect-[2/1] lg:aspect-auto lg:h-[min(18rem,31svh)]",
                      mirrored && "lg:order-2",
                    )}
                  />
                  <div
                    data-reveal="rise"
                    className={cx(
                      "flex flex-col gap-4",
                      mirrored ? "lg:order-1 lg:pr-14" : "lg:pl-14",
                    )}
                  >
                    <p className="flex items-center gap-3 type-label-sm text-success">
                      {/* Draws out to fill its track while the service is hovered or focused. */}
                      <span aria-hidden="true" className="w-12">
                        <span className="block h-0.5 w-6 origin-left bg-success-graphic transition-[scale] duration-500 ease-enter group-focus-within/media:scale-x-200 group-hover/media:scale-x-200 motion-reduce:transition-none" />
                      </span>
                      <span className="tabular-nums">{item.code}</span>
                      {item.label}
                    </p>
                    <h3 id={`${item.id}-title`} className="type-heading-lg">
                      {item.title}
                    </h3>
                    <p className="type-heading-sm text-text-secondary">{item.message}</p>
                    <p className="max-w-text type-body-sm text-text-secondary">{item.body}</p>
                    <dl className="grid grid-cols-3 gap-x-4 border-t border-border-default pt-4">
                      {item.facts.map((fact) => (
                        <div key={fact.label} className="flex flex-col-reverse justify-end gap-1">
                          <dt className="type-caption text-text-muted">{fact.label}</dt>
                          <dd className="type-label-lg tabular-nums">{fact.value}</dd>
                        </div>
                      ))}
                    </dl>
                    <div className="mt-1">
                      <ButtonLink
                        href={item.action.href}
                        variant="secondary"
                        trailingIcon={ArrowRight}
                        className={ACTION}
                      >
                        {item.action.label}
                        <span className="sr-only"> {item.action.context}</span>
                      </ButtonLink>
                    </div>
                  </div>
                </article>
              </Fragment>
            );
          })}
        </div>
      </Container>
    </Section>
  );
}

/** Between the services: pickup → movement → delivery, drawing itself in (decorative). */
function ServiceRoute({ labels }: { labels: readonly [string, string, string] }) {
  const [pickup, moving, delivery] = labels;
  const line =
    "h-0.5 flex-1 origin-left bg-success-graphic transition-[scale] duration-700 ease-cinematic pending:scale-x-0";
  return (
    <div
      aria-hidden="true"
      data-reveal="group"
      className="flex items-center gap-3 py-5 type-label-sm text-text-muted"
    >
      <RouteMarker />
      {pickup}
      <span className={line} />
      <span className="size-2 rounded-full border-2 border-success-graphic" />
      {moving}
      <span className={cx(line, "delay-300")} />
      {delivery}
      <RouteMarker variant="destination" />
    </div>
  );
}
