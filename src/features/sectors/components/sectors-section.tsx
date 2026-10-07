import { ArrowRight } from "lucide-react";
import Link from "next/link";

import { MediaSlot } from "@/components/media/media-slot";
import { ActLabel, InkTitle, seg } from "@/features/story/components/cine";
import { PinnedScene } from "@/features/story/components/scene";
import { actOf } from "@/features/story/config/acts";
import { cx } from "@/lib/utils/cx";

import { sectorsContent as sectors } from "../config/sectors-content";

/**
 * Where the camera sits on the shared cargo photograph for each sector — a
 * different crop window of the same scene (time-based, 1.1 s), until each
 * sector has a picture of its own (`siteMedia.sectors[id]`, then crossfaded).
 */
const CROPS = [
  "group-data-[step=0]/scene:[translate:0_0] group-data-[step=0]/scene:[scale:1]",
  "group-data-[step=1]/scene:[translate:-5%_3%] group-data-[step=1]/scene:[scale:1.14]",
  "group-data-[step=2]/scene:[translate:5%_-3%] group-data-[step=2]/scene:[scale:1.12]",
  "group-data-[step=3]/scene:[translate:-2%_-4%] group-data-[step=3]/scene:[scale:1.1]",
].join(" ");

/**
 * ACT 02 — Il carico. Who BSR works for, told as one cargo scene.
 *
 * Pinned (≈ 3.4 viewports): the close-up of the cargo fills the right half
 * — the camera pulls back as the act plays (close → medium) and reframes for
 * each sector; on the left the title is inked, then the four sectors come in
 * turn: the current one in full (its line, the request with the sector
 * noted), the others waiting in the muted voice. A caption on the picture
 * names the load in play ("Carico 02 / 04 — Retail").
 *
 * Unpinned (reduced motion, no JavaScript, short screens): the picture, the
 * title and the four sectors as a list, every one open.
 */
export function SectorsSection() {
  const titleId = `${sectors.id}-title`;
  const act = actOf(sectors.id);
  const count = String(sectors.items.length).padStart(2, "0");
  return (
    <PinnedScene
      id={sectors.id}
      act={act}
      tone="soft-white"
      labelledBy={titleId}
      steps={sectors.items.length}
      stepRange={[0.12, 0.94]}
      className="group/scene"
    >
      <div className="relative flex flex-col lg:block pin:h-full">
        {/* The cargo: a close-up the camera pulls back from. */}
        <div
          aria-hidden="true"
          className="relative h-[clamp(15rem,42svh,26rem)] shrink-0 overflow-clip bg-surface-secondary lg:absolute lg:inset-y-0 lg:right-0 lg:h-auto lg:w-[47vw] pin:h-[30svh] md:pin:h-[36svh] lg:pin:h-auto"
        >
          <div
            className="absolute inset-0 seg scrub:[scale:calc(1.18-0.18*var(--e))]"
            style={seg(0, 1)}
          >
            <div
              className={cx(
                "absolute inset-0 transition-[translate,scale] duration-[1100ms] ease-cinematic motion-reduce:transition-none",
                CROPS,
              )}
            >
              <MediaSlot
                name="sectors-stage"
                media={sectors.stage}
                aspect="fill"
                sizes="(min-width: 64rem) 47vw, 100vw"
              />
            </div>
          </div>
          {sectors.items.map((sector, i) =>
            sector.media ? (
              <div key={sector.id} data-step-item={i} className="absolute inset-0 swap-media">
                <MediaSlot
                  name={`sector-${sector.id}`}
                  media={sector.media}
                  aspect="fill"
                  sizes="47vw"
                />
              </div>
            ) : null,
          )}
          {/* Corner ticks and the caption: the picture as an instrument. */}
          <span className="absolute top-5 left-5 size-5 border-t border-l border-white/80" />
          <span className="absolute top-5 right-5 size-5 border-t border-r border-white/80" />
          <div data-surface="white" className="absolute bottom-0 left-0 grid bg-background-primary">
            {sectors.items.map((sector, i) => (
              <p
                key={sector.id}
                data-step-item={i}
                className="swap flex items-center gap-3 px-4 py-3 ed-meta text-text-secondary not-first:hidden pinned:not-first:flex"
              >
                <span className="text-success tabular-nums">
                  {sectors.stageLabel} {sector.code} / {count}
                </span>
                <span>{sector.title}</span>
              </p>
            ))}
          </div>
        </div>

        {/* The story: title, then the loads in turn. */}
        <div className="relative ed-frame flex flex-1 flex-col justify-center gap-[clamp(1.25rem,3svh,2.5rem)] py-10 lg:h-full lg:pr-[calc(47vw+var(--spacing-col-gap)*2)] pin:py-[clamp(1.5rem,4svh,3rem)] max-md:pin:justify-start max-md:pin:pb-24 lg:pin:pt-[calc(var(--header-height)+2rem)]">
          <ActLabel act={act.act} name={sectors.act.name} meta={sectors.act.meta} />
          <InkTitle
            id={titleId}
            lines={sectors.title}
            className="cine-title text-[clamp(2rem,0.6rem+4.6vw,5.5rem)]"
            from={0}
            to={0.14}
          />
          <p className="max-w-[34rem] ed-body text-text-secondary max-sm:pin:hidden">
            {sectors.intro}
          </p>

          <ol className="border-b border-hairline">
            {sectors.items.map((sector, i) => (
              <li
                key={sector.id}
                data-step-item={i}
                className="group/row relative border-t border-hairline"
              >
                <span
                  aria-hidden="true"
                  className="absolute inset-x-0 -top-px h-px origin-left scale-x-0 bg-success-graphic transition-[scale] duration-700 ease-cinematic pinned:group-data-[state=active]/row:scale-x-100"
                />
                <div className="flex items-baseline gap-5 py-2 lg:py-3">
                  <span
                    aria-hidden="true"
                    className="w-7 shrink-0 ed-label text-text-secondary tabular-nums pinned:group-data-[state=active]/row:text-success"
                  >
                    {sector.code}
                  </span>
                  <h3 className="font-tech text-[clamp(1.5rem,0.9rem+1.9vw,2.75rem)] leading-none font-bold tracking-[-0.01em] uppercase [font-stretch:112%] transition-colors duration-500 pinned:text-ink-muted pinned:group-data-[state=active]/row:text-text-primary">
                    {sector.title}
                  </h3>
                </div>
                <div className="grid transition-[grid-template-rows] duration-500 ease-enter pinned:grid-rows-[0fr] pinned:group-data-[state=active]/row:grid-rows-[1fr] pinned:focus-within:grid-rows-[1fr]">
                  <div className="min-h-0 overflow-hidden">
                    <div className="flex flex-col gap-2 pb-4 pl-12">
                      <p className="max-w-[44ch] ed-body text-text-secondary">{sector.body}</p>
                      <Link
                        href={sector.href}
                        className="inline-flex min-h-(--target-min) items-center gap-2 self-start ed-action text-text-primary"
                      >
                        <span>
                          {sectors.linkLabel}
                          <span className="sr-only">
                            {" "}
                            {sectors.linkFor} {sector.title}
                          </span>
                        </span>
                        <ArrowRight
                          aria-hidden="true"
                          className="size-4 text-success"
                          strokeWidth={1.75}
                        />
                      </Link>
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </PinnedScene>
  );
}
