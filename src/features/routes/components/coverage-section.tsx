import { RouteMarker } from "@/components/graphics/route-marker";
import { Container } from "@/components/layout/container";
import { Section } from "@/components/layout/section";
import { SectionHeader } from "@/components/layout/section-header";
import { MediaSlot } from "@/components/media/media-slot";
import { TextLink } from "@/components/ui/text-link";

import { coverageContent as coverage } from "../config/coverage-content";
import { CoverageMap } from "./coverage-map";

/**
 * Coverage, on Carbon — one of the page's rare cinematic moments. A split:
 * the facts on the left, and they lead — Italy, the seven European routes
 * with their indicative transit times (each a link to the request with that
 * destination), the base, a way to ask about any route; on the right the
 * supplied coverage map, revealed as one sequence (CoverageMap: Carpi, the
 * Italian network, the cities, the island links, the European corridors,
 * their red destinations — played once, ≈ 2.5 s, as the map enters) over the
 * aerial of the northern Italian plain — dimmed, feathered, with a ±3%
 * parallax on large screens. The map is decorative; every fact is real text.
 */
export function CoverageSection() {
  return (
    <Section
      tone="carbon"
      spacing="md"
      id={coverage.id}
      aria-labelledby={`${coverage.id}-title`}
      className="overflow-clip"
    >
      <Container className="flex flex-col gap-10 lg:layout-grid lg:items-center lg:gap-y-0">
        <div className="flex flex-col gap-8 lg:col-span-6 xl:col-span-5">
          <SectionHeader
            id={`${coverage.id}-title`}
            eyebrow={coverage.eyebrow}
            title={coverage.title}
            intro={coverage.body}
            layout="stacked"
          />
          <div data-reveal="rise" className="flex flex-col gap-6">
            <div className="flex flex-col gap-1 border-t border-border-default pt-4">
              <p className="flex items-center gap-2.5 type-heading-sm">
                <RouteMarker />
                {coverage.italy.headline}
              </p>
              <p className="type-body-sm text-text-secondary">{coverage.italy.detail}</p>
            </div>
            <div className="flex flex-col gap-3 border-t border-border-default pt-4">
              <p className="flex items-baseline justify-between gap-4">
                <span className="type-heading-sm">{coverage.europe.headline}</span>
                <span className="type-caption text-text-muted">{coverage.europe.note}</span>
              </p>
              <ul className="grid grid-cols-2 gap-x-6">
                {coverage.europe.routes.map((route) => (
                  <li key={route.country}>
                    <a
                      href={route.href}
                      className="group/route flex min-h-10 items-center justify-between gap-3 border-b border-border-subtle type-label-md transition-ui hover:text-success"
                    >
                      <span className="flex items-center gap-2">
                        <span
                          aria-hidden="true"
                          className="size-1.5 rounded-full bg-success-graphic"
                        />
                        <span className="sr-only">{coverage.europe.linkHint} </span>
                        {route.country}
                      </span>
                      <span className="type-caption text-text-secondary tabular-nums">
                        {route.transit}
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
            </div>
            <p className="flex items-center gap-2.5 type-label-sm text-text-muted">
              <RouteMarker />
              {coverage.base.label}: {coverage.base.place}
            </p>
          </div>
          <TextLink variant="action" href={coverage.action.href} className="self-start">
            {coverage.action.label}
          </TextLink>
        </div>

        <div className="relative isolate lg:col-span-6 lg:col-start-7 xl:col-span-7 xl:col-start-6">
          {/* Background layer: the aerial of the northern Italian plain behind the map —
              dimmed and feathered into the surface. Aerial footage can replace it. */}
          <div
            aria-hidden="true"
            className="absolute -inset-x-16 -inset-y-12 -z-10 [mask-image:radial-gradient(ellipse_60%_55%_at_50%_50%,black_25%,transparent_75%)]"
          >
            <div className="parallax absolute inset-x-0 -inset-y-[4%]">
              <MediaSlot
                name="coverage-background"
                media={coverage.media}
                aspect="fill"
                sizes="60vw"
              />
            </div>
            <div className="absolute inset-0 bg-background-primary/75" />
          </div>
          <CoverageMap className="-mx-(--spacing-gutter) md:mx-0" />
        </div>
      </Container>
    </Section>
  );
}
