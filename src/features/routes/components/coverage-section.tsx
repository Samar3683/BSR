import { ActionLink } from "@/components/editorial/action";
import { MediaSlot } from "@/components/media/media-slot";
import { ActLabel, InkTitle, seg } from "@/features/story/components/cine";
import { PinnedScene } from "@/features/story/components/scene";
import { actOf } from "@/features/story/config/acts";

import { coverageContent as coverage } from "../config/coverage-content";
import { CoverageMap } from "./coverage-map";

const STEPS = [0.2, 0.92] as const;


export function CoverageSection() {
  const titleId = `${coverage.id}-title`;
  const act = actOf(coverage.id);
  const total = String(coverage.stages.length).padStart(2, "0");
  const [italy, europe, countries] = coverage.facts;

  return (
    <PinnedScene
      id={coverage.id}
      act={act}
      tone="carbon"
      labelledBy={titleId}
      steps={coverage.stages.length}
      stepRange={STEPS}
      className="group/scene"
    >
      {/* The words: title, then what each camera position shows. */}
      <div className="relative z-10 ed-frame flex flex-col gap-[clamp(1.25rem,3svh,2.25rem)] py-12 pin:h-full pin:justify-center pin:py-0 pin:pt-(--header-height) max-lg:pin:justify-end max-lg:pin:pb-24">
        <div className="flex max-w-[34rem] flex-col gap-[clamp(1.25rem,3svh,2.25rem)]">
          <ActLabel act={act.act} name={coverage.act.name} meta={coverage.act.meta} />
          <InkTitle
            id={titleId}
            lines={coverage.titleLines}
            className="cine-title"
            from={0.02}
            to={0.14}
          />

          <div className="grid gap-10">
            {coverage.stages.map((stage, i) => (
              <div
                key={stage.id}
                data-step-item={i}
                className="swap flex flex-col gap-3 border-t border-hairline-strong pt-4"
              >
                <p className="flex items-center gap-3 ed-label">
                  <span className="text-success tabular-nums">
                    {String(i + 1).padStart(2, "0")} / {total}
                  </span>
                  <span className="text-text-secondary">{stage.label}</span>
                </p>
                <h3 className="cine-h3 text-[clamp(1.625rem,1rem+1.8vw,2.75rem)]">
                  {stage.headline}
                </h3>
                <p className="ed-body text-text-secondary">{stage.detail}</p>

                {stage.id === "italia" && italy && (
                  <p className="flex items-baseline gap-2">
                    <span className="font-tech text-[clamp(2.5rem,1.5rem+2.4vw,4rem)] leading-none font-bold [font-stretch:112%]">
                      {italy.value}
                    </span>
                    <span className="ed-label text-success">{italy.unit}</span>
                    <span className="ed-meta text-text-secondary">· {italy.detail}</span>
                  </p>
                )}

                {stage.id === "europa" && europe && countries && (
                  <>
                    <p className="flex flex-wrap items-baseline gap-x-6 gap-y-1">
                      <span className="flex items-baseline gap-2">
                        <span className="font-tech text-[clamp(2.25rem,1.5rem+2vw,3.5rem)] leading-none font-bold [font-stretch:112%]">
                          {europe.value}
                        </span>
                        <span className="ed-label text-success">{europe.unit}</span>
                      </span>
                      <span className="flex items-baseline gap-2">
                        <span className="font-tech text-[clamp(2.25rem,1.5rem+2vw,3.5rem)] leading-none font-bold [font-stretch:112%]">
                          {countries.value}
                        </span>
                        <span className="ed-label text-success">{countries.label}</span>
                      </span>
                    </p>
                    <ul className="grid grid-cols-2 gap-x-6 sm:grid-cols-3 lg:grid-cols-2">
                      {coverage.europe.routes.map((route) => (
                        <li key={route.country}>
                          <a
                            href={route.href}
                            className="flex min-h-10 items-center justify-between gap-2 border-b border-hairline ed-small text-text-primary transition-colors duration-200 hover:border-success-graphic hover:text-success"
                          >
                            <span className="flex items-center gap-2">
                              <span
                                aria-hidden="true"
                                className="size-1.5 rotate-45 bg-action-primary"
                              />
                              <span className="sr-only">{coverage.europe.linkHint} </span>
                              {route.country}
                            </span>
                            <span className="ed-meta whitespace-nowrap text-text-secondary normal-case">
                              {route.transit}
                            </span>
                          </a>
                        </li>
                      ))}
                    </ul>
                    <p className="ed-meta text-text-secondary">{coverage.europe.note}</p>
                  </>
                )}
              </div>
            ))}
          </div>

          <ActionLink
            href={coverage.action.href}
            variant="inverse"
            className="self-start max-lg:pin:hidden"
          >
            {coverage.action.label}
          </ActionLink>
        </div>
      </div>

      {/* The aerial: the camera rising off the road, then giving way to the map. */}
      <div
        aria-hidden="true"
        className="relative h-[clamp(12rem,36svh,22rem)] overflow-clip seg pin:absolute pin:inset-0 pin:h-auto pinned:opacity-[calc(1-var(--e))]"
        style={seg(0.14, 0.26)}
      >
        <div
          className="absolute inset-0 seg pinned:[scale:calc(1.2-0.5*var(--e))] pinned:opacity-(--e)"
          style={seg(0, 0.18)}
        >
          <MediaSlot
            name="coverage-background"
            media={coverage.media}
            aspect="fill"
            sizes="100vw"
          />
        </div>
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgb(9_11_11/0.85)_0%,rgb(9_11_11/0.35)_55%,transparent_80%)]" />
      </div>

      {/* The map, arriving as the aerial falls away. */}
      <div
        className="relative h-[clamp(20rem,60svh,40rem)] seg pin:absolute pin:inset-y-0 pin:right-0 pin:h-auto pin:w-full max-lg:pin:top-(--header-height) max-lg:pin:bottom-auto max-lg:pin:h-[40svh] lg:pin:w-[70%] pinned:[scale:calc(1.25-0.25*var(--e))] pinned:opacity-(--e)"
        style={seg(0.16, 0.28)}
      >
        <CoverageMap className="absolute inset-0 [mask-image:radial-gradient(ellipse_62%_62%_at_50%_50%,black_55%,transparent_100%)]" />
      </div>

      {/* Day comes back from below (the next act is on White). */}
      <div
        aria-hidden="true"
        className="absolute inset-0 z-20 hidden bg-white seg pinned:block pinned:[clip-path:inset(calc((1-var(--e))*100%)_0_0_0)]"
        style={seg(0.94, 1)}
      />
    </PinnedScene>
  );
}
