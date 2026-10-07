import { ActionLink } from "@/components/editorial/action";
import { MediaSlot } from "@/components/media/media-slot";
import { ActLabel, InkTitle, seg } from "@/features/story/components/cine";
import { PinnedScene } from "@/features/story/components/scene";
import { actOf } from "@/features/story/config/acts";

import { requestProcessContent as process } from "../config/request-process-content";

const STEP_RANGE = [0.3, 0.9] as const;

/**
 * ACT 04 — Preparazione. What happens after the request, told inside the
 * loading bay.
 *
 * Pinned (≈ 3.8 viewports):
 *  0 → 0.18  on Soft White, the title is inked; at the right a narrow door
 *            opens on the bay (the loading photograph);
 *  0.18 → 0.3 the door gives way to the full frame and the title leaves
 *            upwards: the camera walks in, and keeps pushing in slowly;
 *  0.3 → 0.9 the four steps in turn, large, over the picture — a big index,
 *            the step, one sentence — with the route along the bottom drawing
 *            towards the red destination, the current stop lit;
 *  0.9 → 1   the frame takes on BSR green: the next act's atmosphere.
 *
 * The steps are an ordered list with `aria-current="step"` on the current one
 * (pinned or not). Unpinned: the picture, the title, then the four steps on
 * Carbon, one after another.
 */
export function RequestProcessSection() {
  const titleId = `${process.id}-title`;
  const act = actOf(process.id);
  const total = String(process.steps.length).padStart(2, "0");
  return (
    <PinnedScene
      id={process.id}
      act={act}
      tone="soft-white"
      labelledBy={titleId}
      steps={process.steps.length}
      stepRange={STEP_RANGE}
      className="group/scene"
    >
      {/* The bay. */}
      <div
        aria-hidden="true"
        className="relative aspect-[4/3] overflow-clip bg-carbon dock-door sm:aspect-[16/9] pin:absolute pin:inset-0 pin:aspect-auto"
      >
        <div
          className="absolute inset-0 seg scrub:[scale:calc(1.02+0.12*var(--e))]"
          style={seg(0.18, 1)}
        >
          <MediaSlot name="process-main" media={process.media} aspect="fill" sizes="100vw" />
        </div>
        {/* Shade for the words over the picture, arriving with the full frame. */}
        <div
          className="absolute inset-0 hidden bg-[linear-gradient(90deg,rgb(9_11_11/0.82)_0%,rgb(9_11_11/0.5)_45%,rgb(9_11_11/0.05)_75%),linear-gradient(0deg,rgb(9_11_11/0.85)_0%,transparent_38%)] seg pinned:block pinned:opacity-(--e)"
          style={seg(0.2, 0.32)}
        />
        {/* The hand-off: the bay takes on BSR green (the next act). */}
        <div
          className="absolute inset-0 hidden bg-green-700 seg pinned:block pinned:opacity-(--t)"
          style={seg(0.9, 1)}
        />
      </div>

      {/* Title, on the light before the door opens; it leaves upwards as the camera walks in. */}
      <div
        className="relative ed-frame flex flex-col gap-6 py-12 seg pin:absolute pin:inset-x-0 pin:top-0 pin:h-full pin:justify-start pin:py-0 pin:pt-[calc(var(--header-height)+1.5rem)] lg:pin:justify-center lg:pin:pt-0 lg:pin:pr-[52%] pinned:[translate:0_calc(-70svh*var(--e))]"
        style={seg(0.16, 0.28)}
      >
        <ActLabel act={act.act} name={process.act.name} meta={process.act.meta} />
        <InkTitle
          id={titleId}
          lines={process.titleLines}
          className="cine-title"
          from={0}
          to={0.12}
        />
        <p className="max-w-[30rem] ed-body text-text-secondary max-sm:pin:hidden">
          {process.intro}
        </p>
      </div>

      {/* The steps, over the picture once the bay is open. */}
      <div
        data-surface="carbon"
        className="relative bg-background-primary text-text-primary seg pin:absolute pin:inset-0 pin:bg-transparent pin:bg-[linear-gradient(0deg,rgb(9_11_11/0.6)_0%,transparent_55%)] pinned:[translate:0_calc(100svh*(1-var(--e)))]"
        style={seg(0.24, 0.34)}
      >
        <div className="ed-frame flex flex-col gap-10 py-12 pin:h-full pin:justify-end pin:gap-[clamp(1.5rem,5svh,3.5rem)] pin:pb-[clamp(6rem,12svh,7rem)] md:pin:pb-[clamp(5rem,9svh,6.5rem)]">
          {/* Where we are: the step, as a readout (top right when pinned). */}
          <p
            aria-hidden="true"
            className="hidden ed-meta text-text-primary pin:absolute pin:top-[calc(var(--header-height)+1.5rem)] pin:left-(--spacing-edge) pin:grid"
          >
            {process.steps.map((step, i) => (
              <span key={step.title} data-step-item={i} className="swap">
                <span className="text-success">
                  {process.stageLabel} {String(i + 1).padStart(2, "0")} / {total}
                </span>{" "}
                · {step.title}
              </span>
            ))}
          </p>

          <ol className="grid gap-10 pin:max-w-[min(46rem,60vw)]">
            {process.steps.map((step, i) => (
              <li
                key={step.title}
                data-step-item={i}
                data-step-aria
                className="swap flex flex-col gap-4 pin:gap-5"
              >
                <span
                  aria-hidden="true"
                  className="font-tech text-[clamp(4.5rem,2rem+8vw,10rem)] leading-[0.8] font-bold text-success-graphic [font-stretch:115%]"
                >
                  {String(i + 1).padStart(2, "0")}
                </span>
                <h3 className="cine-h3">{step.title}</h3>
                <p className="max-w-[40ch] ed-lede text-text-secondary">{step.body}</p>
              </li>
            ))}
          </ol>

          {/* The route along the bottom: four stops, the red destination after them. */}
          <div aria-hidden="true" className="hidden pin:block">
            <div className="relative h-3">
              <span className="absolute inset-x-0 top-1/2 h-px bg-hairline-strong" />
              <span
                className="absolute inset-x-0 top-1/2 h-px origin-left bg-success-graphic seg scrub:[scale:var(--t)_1]"
                style={seg(STEP_RANGE[0], STEP_RANGE[1])}
              />
              {process.steps.map((step, i) => {
                // Each stop lights as the route reaches it.
                const at =
                  STEP_RANGE[0] + (i / process.steps.length) * (STEP_RANGE[1] - STEP_RANGE[0]);
                return (
                  <span
                    key={step.title}
                    className="absolute top-1/2 grid size-2.5 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-success-graphic bg-carbon"
                    style={{ left: `${(i / process.steps.length) * 100}%` }}
                  >
                    <span
                      className="size-full rounded-full bg-success-graphic seg scrub:opacity-(--t)"
                      style={seg(at, at + 0.01)}
                    />
                  </span>
                );
              })}
              <span className="absolute top-1/2 right-0 size-2.5 translate-x-1/2 -translate-y-1/2 rotate-45 bg-action-primary" />
            </div>
            <div className="relative mt-3 hidden ed-meta text-text-secondary md:flex">
              {process.steps.map((step) => (
                <span key={step.title} className="flex-1">
                  {step.title}
                </span>
              ))}
              <span className="text-text-primary">{process.arrival}</span>
            </div>
          </div>

          <div className="pin:absolute pin:top-[calc(var(--header-height)+3.75rem)] pin:right-(--spacing-edge) max-md:pin:hidden">
            <ActionLink href={process.action.href} variant="inverse">
              {process.action.label}
            </ActionLink>
          </div>
        </div>
      </div>
    </PinnedScene>
  );
}
