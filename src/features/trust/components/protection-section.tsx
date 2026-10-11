import { MediaSlot } from "@/components/media/media-slot";
import { InkTitle, seg } from "@/features/story/components/cine";

import { protectionContent as protection } from "../config/protection-content";

/**
 * ACT 05 — Sicurezza. The loading bay closed into BSR green: the act is an
 * atmosphere, not a panel — the green of the previous frame's hand-off, a
 * glow from above, a faint technical grid, and a route running down the
 * principles, drawing with the scroll.
 *
 * Left: the title (inked), the intro, then the four principles in the
 * official site's own words — large index, title, one sentence, on
 * hairlines. Right: the secured cargo, framed like a trailer's open side
 * (a slanted cut), drifting with the scroll, captioned with what it shows.
 * At the bottom the green gives way to the morning light of the departure.
 */
export function ProtectionSection() {
  const titleId = `${protection.id}-title`;
  return (
    <section
      id={protection.id}
      aria-labelledby={titleId}
      data-surface="green"
      data-scene="view"
      className="relative overflow-x-clip bg-background-primary text-text-primary"
    >
      {/* The atmosphere (decorative). */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_45%_at_18%_0%,rgb(63_191_134/0.32),transparent_70%),linear-gradient(180deg,transparent_40%,#06422a_100%)]" />
        <div className="absolute inset-0 [background-image:linear-gradient(90deg,rgb(247_247_242/0.07)_1px,transparent_1px),linear-gradient(0deg,rgb(247_247_242/0.05)_1px,transparent_1px)] [mask-image:linear-gradient(180deg,black,transparent_85%)] [background-size:8rem_8rem] opacity-50" />
      </div>

      <div className="relative ed-frame pt-[clamp(5rem,14svh,9rem)] pb-[clamp(4rem,10svh,7rem)]">

        <div className="mt-[clamp(2rem,5svh,3.5rem)] ed-grid gap-y-14">
          <div className="col-span-4 flex flex-col gap-8 md:col-span-8 lg:col-span-9">
            <InkTitle
              id={titleId}
              lines={protection.titleLines}
              className="cine-title"
              from={0.12}
              to={0.3}
            />
            <p className="max-w-[34rem] ed-lede text-text-secondary">{protection.intro}</p>

            {/* The principles along one route: it draws down as the act plays. */}
            <div className="relative mt-4 pl-8 sm:pl-12">
              <span
                aria-hidden="true"
                className="absolute top-2 bottom-2 left-[5px] w-px bg-hairline"
              />
              <span
                aria-hidden="true"
                className="absolute top-2 bottom-2 left-[5px] w-px origin-top bg-success-graphic seg scrub:[scale:1_var(--e)]"
                style={seg(0.2, 0.7)}
              />
              <ol className="grid gap-x-(--spacing-col-gap) gap-y-10 sm:grid-cols-2">
                {protection.principles.map((principle) => (
                  <li
                    key={principle.code}
                    data-reveal="rise"
                    className="relative flex flex-col gap-3 border-t border-hairline-strong pt-5"
                  >
                    <span aria-hidden="true" className="flex items-center gap-4">
                      <span className="font-tech text-[clamp(2.75rem,1.6rem+2.6vw,4.5rem)] leading-[0.8] font-bold text-success-graphic [font-stretch:115%]">
                        {principle.code}
                      </span>
                    </span>
                    <h3 className="cine-h3 text-[clamp(1.5rem,1rem+1.4vw,2.375rem)]">
                      {principle.title}
                    </h3>
                    <p className="max-w-[40ch] ed-body text-text-secondary">{principle.body}</p>
                  </li>
                ))}
              </ol>
            </div>
          </div>

          {/* The secured cargo, cut like a trailer's open side. */}
          <figure className="relative col-span-4 h-[clamp(22rem,60svh,42rem)] md:col-span-8 lg:col-span-7 lg:col-start-10 lg:-mr-(--spacing-edge) lg:h-auto lg:min-h-[44rem] lg:self-stretch">
            <div className="absolute inset-0 overflow-clip bg-surface-secondary [clip-path:polygon(14%_0,100%_0,100%_100%,0_100%)]">
              <div
                className="absolute inset-x-0 -inset-y-[6%] seg scrub:[translate:0_calc(5%-10%*var(--t))]"
                style={seg(0.1, 0.9)}
              >
                <MediaSlot
                  name="security-main"
                  media={protection.media}
                  aspect="fill"
                  sizes="(min-width: 64rem) 45vw, 100vw"
                />
              </div>
            </div>
            <figcaption className="absolute bottom-4 left-[16%] flex items-center gap-3 bg-background-secondary px-3 py-2 ed-meta text-text-primary">
              <span aria-hidden="true" className="size-1.5 rounded-full bg-success-graphic" />
              {protection.caption}
            </figcaption>
          </figure>
        </div>
      </div>

      {/* Morning: the green gives way to the light of the departure (the next act). */}
      <div
        aria-hidden="true"
        className="h-[clamp(8rem,22svh,14rem)] bg-[linear-gradient(180deg,#06422a_0%,#2f7a57_40%,#c8dccf_80%,var(--color-soft-white)_100%)]"
      />
    </section>
  );
}
