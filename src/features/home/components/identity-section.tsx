import { MessageCircle } from "lucide-react";

import { CountUp } from "@/components/data/count-up";
import { ActionLink } from "@/components/editorial/action";
import { siteConfig } from "@/config/site";
import { siteNavigation as nav } from "@/features/site/config/site-navigation";
import { seg } from "@/features/story/components/cine";
import { TruckSide } from "@/features/story/components/truck";
import { cx } from "@/lib/utils/cx";

import { homeContent } from "../config/home-content";

/**
 * ACT 01 — Origine. The film's first frame after the hero: what BSR is.
 *
 * The hero ends at night; this act opens in that dark and turns to day as
 * it scrolls (a dawn gradient: Carbon → night green → BSR green on the
 * horizon → White). On the horizon line the BSR truck — the same truck,
 * now small — drives out of Carpi along the route Carpi → Italia → Europa,
 * the green line drawing behind it, the red destination waiting.
 *
 * Then the statement, very large, inked line by line as it arrives, the one
 * promise, the request; and the proof as four large data markers on
 * hairlines, staggered (counting up once). Scroll-linked through the act's
 * `--p` (view progress); reduced motion or no JavaScript: the final frame.
 */
export function IdentitySection() {
  const identity = homeContent.identity;
  const { contact } = siteConfig;
  const titleId = `${identity.id}-title`;
  const { prologue } = identity;

  return (
    <section
      id={identity.id}
      aria-labelledby={titleId}
      data-surface="white"
      data-scene="view"
      className="relative overflow-x-clip bg-background-primary text-text-primary"
    >
      {/* Dawn: the hero's night opening into the day of the story (decorative). */}
      <div
        aria-hidden="true"
        data-surface="carbon"
        className="relative h-[clamp(24rem,72svh,46rem)] bg-[linear-gradient(180deg,var(--color-carbon)_0%,#06130d_24%,#0a2a1c_44%,#0d4a31_58%,#3d8a66_72%,#b9d8c7_86%,var(--color-white)_100%)]"
      >
        {/* Over the hero's last band: its frame closes into the night (the hero itself is untouched). */}
        <div className="absolute inset-x-0 bottom-full h-24 bg-linear-to-b from-transparent to-carbon sm:h-48" />
        {/* The light on the horizon. */}
        <div className="absolute inset-x-0 top-[40%] h-[50%] bg-[radial-gradient(ellipse_55%_45%_at_50%_60%,rgb(63_191_134/0.28),transparent_100%)]" />
        <div className="relative ed-frame flex h-full flex-col pt-[clamp(3rem,12svh,7rem)]">
          {/* The route out of Carpi, with the truck on it. */}
          <div className="relative mt-[clamp(4rem,14svh,9rem)]">
            <div className="relative h-px bg-hairline-strong">
              <span
                className="absolute inset-0 origin-left bg-success seg scrub:[scale:var(--e)_1]"
                style={seg(0.06, 0.4)}
              />
            </div>
            {[prologue.origin, ...prologue.stops].map((stop, i, all) => {
              const last = i === all.length - 1;
              const at = i / (all.length - 1);
              return (
                <span
                  key={stop}
                  className="absolute top-0 flex -translate-x-1/2 flex-col items-center gap-3"
                  style={{ left: `${at * 100}%` }}
                >
                  <span
                    className={cx(
                      "-mt-1 size-2",
                      last ? "rotate-45 bg-action-primary" : "rounded-full bg-success",
                    )}
                  />
                  <span
                    className={cx(
                      "ed-meta whitespace-nowrap",
                      i === 0 && "translate-x-1/2 self-start pl-1",
                      last && "-translate-x-1/2 self-end",
                      last ? "text-text-primary" : "text-text-secondary",
                    )}
                  >
                    {stop}
                  </span>
                </span>
              );
            })}
            {/* The truck rides the line: its wrapper spans the route and moves by its own width. */}
            <div
              className="pointer-events-none absolute inset-x-0 bottom-0 seg scrub:[translate:calc(var(--e)*100%)_0]"
              style={seg(0.06, 0.4, { "--turns": 9 })}
            >
              <TruckSide
                sizes="(min-width: 64rem) 16rem, 10rem"
                className="absolute bottom-[3px] left-0 w-[clamp(9rem,15vw,17rem)] -translate-x-full"
              />
            </div>
          </div>

          <p className="mt-[clamp(3rem,10svh,6rem)] max-w-[22ch] cine-h3 text-text-primary">
            {prologue.line}
          </p>
        </div>
      </div>

      <div className="relative ed-frame pb-[clamp(4rem,10svh,8rem)]">
        <div className="mt-[clamp(2rem,5svh,4rem)] ed-grid gap-y-14">
          <h2 id={titleId} className="col-span-4 flex flex-col gap-5 md:col-span-8 lg:col-span-16">
            <span className="flex flex-col cine-statement">
              {identity.statement.map((line, i) => (
                <span
                  key={line}
                  className="relative block seg"
                  style={seg(0.3 + i * 0.06, 0.36 + i * 0.06)}
                >
                  <span className="text-ink-muted">{line}</span>
                  <span aria-hidden="true" className="absolute inset-0 text-text-primary ink-cover">
                    {line}
                  </span>
                  {i === 0 && <span className="sr-only"> </span>}
                </span>
              ))}
            </span>
            <span className="sr-only"> </span>
            <span className="max-w-[24ch] ed-h3 text-balance text-text-secondary">
              {identity.title[1]}
            </span>
          </h2>

          <div className="col-span-4 flex flex-col gap-8 md:col-span-8 lg:col-span-6">
            <div data-reveal="rise" className="flex max-w-[34rem] flex-col gap-2">
              <p className="ed-lede text-text-primary">{identity.support}</p>
              <p className="ed-small text-text-secondary">{identity.body}</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <ActionLink href={nav.cta.href} size="lg">
                {nav.cta.label}
              </ActionLink>
              <ActionLink
                href={contact.whatsappHref}
                variant="outline"
                size="lg"
                leadingIcon={MessageCircle}
                icon={null}
              >
                {identity.whatsapp}
                <span className="sr-only"> {identity.whatsappHint}</span>
              </ActionLink>
            </div>
          </div>

          <div className="col-span-4 md:col-span-8 lg:col-span-8 lg:col-start-9">
            <h3 className="sr-only">{identity.metricsLabel}</h3>
            {/* Four data markers, staggered: the second column sits lower. */}
            <dl className="grid grid-cols-2 gap-x-(--spacing-col-gap) gap-y-10">
              {identity.metrics.map((metric, i) => (
                <div
                  key={metric.label}
                  className={cx(
                    "flex flex-col gap-2 border-t border-hairline-strong pt-4",
                    i % 2 === 1 && "md:translate-y-16",
                  )}
                >
                  <dt className="flex items-center gap-2 ed-label text-text-primary">
                    <span className="text-success">{String(i + 1).padStart(2, "0")}</span>
                    {metric.label}
                  </dt>
                  <dd className="flex items-baseline gap-2 cine-stat text-text-primary">
                    <CountUp value={metric.value} delay={i * 160} />
                    {"unit" in metric && (
                      <span className="ed-label text-success">{metric.unit}</span>
                    )}
                  </dd>
                  <dd className="max-w-[22ch] ed-small text-text-secondary">{metric.detail}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-6 ed-meta text-text-secondary md:mt-24">{identity.metricsNote}</p>
          </div>
        </div>
      </div>
    </section>
  );
}
