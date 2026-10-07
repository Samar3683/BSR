import { ActionLink } from "@/components/editorial/action";
import { Chapter } from "@/components/editorial/chapter";
import { Label } from "@/components/editorial/label";
import { MediaSlot } from "@/components/media/media-slot";

import { coverageContent as coverage } from "../config/coverage-content";
import { CoverageMap } from "./coverage-map";

/**
 * Chapter 06 — "where can you take it?", on Carbon: the page's one controlled
 * dark stage, an editorial map rather than a map card.
 *
 * Left: the heading, the reach as three figures on hairlines (Italy, Europe,
 * the seven confirmed countries — indicative), the routes with their
 * indicative times (each a link to the request with that destination), the
 * base, and "Verifica la tua tratta". Right, running off the page edge: the
 * supplied BSR map, played once as it enters (CoverageMap: Carpi → Italy →
 * the corridors → red destinations), over the aerial of the northern Italian
 * plain, dimmed and feathered. Decorative — every fact is real text.
 */
export function CoverageSection() {
  const titleId = `${coverage.id}-title`;
  return (
    <Chapter id={coverage.id} tone="carbon" labelledBy={titleId} {...coverage.chapter}>
      <div className="ed-grid gap-y-10 lg:items-center">
        <div className="col-span-4 flex flex-col gap-7 md:col-span-8 lg:col-span-7 xl:col-span-6">
          <div data-reveal="rise" className="flex flex-col gap-5">
            <Label>{coverage.label}</Label>
            <h2 id={titleId} className="ed-h2 text-balance">
              {coverage.title}
            </h2>
            <p className="max-w-[36rem] ed-body text-text-secondary">{coverage.body}</p>
          </div>

          <dl className="grid grid-cols-3 border-y border-hairline">
            {coverage.facts.map((fact, i) => (
              <div
                key={fact.label}
                className={`flex flex-col gap-1.5 py-4 ${i > 0 ? "border-l border-hairline pl-4" : "pr-4"}`}
              >
                <dt className="ed-meta text-text-secondary">{fact.label}</dt>
                <dd className="flex items-baseline gap-1.5 whitespace-nowrap">
                  <span className="ed-h3 tabular-nums">{fact.value}</span>
                  {fact.unit && <span className="ed-label text-success">{fact.unit}</span>}
                </dd>
                <dd className="ed-small text-text-secondary">{fact.detail}</dd>
              </div>
            ))}
          </dl>

          <div className="flex flex-col gap-2">
            <p className="flex items-baseline justify-between gap-4 ed-meta text-text-secondary">
              <span className="text-text-primary">{coverage.europe.headline}</span>
              <span>{coverage.europe.note}</span>
            </p>
            <ul className="grid grid-cols-2 gap-x-6 sm:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3">
              {coverage.europe.routes.map((route) => (
                <li key={route.country}>
                  <a
                    href={route.href}
                    className="flex min-h-10 items-center justify-between gap-2 border-b border-hairline ed-small text-text-primary transition-colors duration-200 hover:border-success-graphic hover:text-success"
                  >
                    <span className="flex items-center gap-2">
                      <span aria-hidden="true" className="size-1.5 rotate-45 bg-action-primary" />
                      <span className="sr-only">{coverage.europe.linkHint} </span>
                      {route.country}
                    </span>
                    <span className="ed-meta whitespace-nowrap normal-case text-text-secondary">{route.transit}</span>
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4">
            <Label mark="green" className="text-text-secondary">
              {coverage.base.label}: {coverage.base.place}
            </Label>
            <ActionLink href={coverage.action.href} variant="inverse">
              {coverage.action.label}
            </ActionLink>
          </div>
        </div>

        <div className="relative isolate col-span-4 md:col-span-8 lg:col-span-9 lg:col-start-8 lg:ed-bleed-r xl:col-span-10 xl:col-start-7">
          {/* Background layer: the aerial of the northern Italian plain behind the map —
              dimmed and feathered into the surface. Aerial footage can replace it. */}
          <div
            aria-hidden="true"
            className="absolute -inset-x-16 -inset-y-12 -z-10 [mask-image:radial-gradient(ellipse_60%_55%_at_50%_50%,black_25%,transparent_75%)]"
          >
            <div className="parallax absolute inset-x-0 -inset-y-[4%]">
              <MediaSlot name="coverage-background" media={coverage.media} aspect="fill" sizes="60vw" />
            </div>
            <div className="absolute inset-0 bg-background-primary/75" />
          </div>
          <CoverageMap className="-mx-(--spacing-edge) md:mx-0" />
        </div>
      </div>
    </Chapter>
  );
}
