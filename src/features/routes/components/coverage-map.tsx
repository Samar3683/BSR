import Image from "next/image";
import type { CSSProperties } from "react";

import { MAPS } from "@/config/media-manifest";
import { cx } from "@/lib/utils/cx";

import {
  CITIES,
  EUROPE_CORRIDORS,
  EUROPE_FERRIES,
  ITALY_FERRIES,
  ITALY_ROUTES,
  LABELS,
  NETWORK_CLIP,
  NETWORK_VIEWBOX,
  ORIGIN,
} from "../graphics/coverage-network";

/** The last point of a corridor: where the route arrives. */
function endOf(d: string): [number, number] {
  const match = d.trim().match(/(-?[\d.]+)[ ,](-?[\d.]+)$/);
  return match ? [Number(match[1]), Number(match[2])] : [0, 0];
}

/** When a layer of the sequence starts (ms after the map enters). */
const at = (ms: number) => ({ "--at": `${ms}ms` }) as CSSProperties;

/** A layer fading in, a route drawing, a marker popping from its own centre. */
const FADE = "transition-opacity delay-(--at) duration-500 ease-enter pending:opacity-0";
const DRAW =
  "[stroke-dasharray:1] transition-[stroke-dashoffset] delay-(--at) duration-[900ms] ease-cinematic pending:[stroke-dashoffset:1]";
const POP =
  "[transform-box:fill-box] origin-center transition-[scale,opacity] delay-(--at) duration-500 ease-enter pending:scale-40 pending:opacity-0";

/**
 * The supplied BSR coverage map, in two layers sharing one viewBox — the dark
 * variant's geography (a cached SVG image, Italy lifted one material step) and
 * the route network drawn inline — played once as one sequence when the map
 * enters the viewport (≈ 2.5 s, not tied to the scroll):
 *
 *   land → Carpi (pulses once) → the Italian network draws → Milano, Roma,
 *   Napoli → the island (ferry) links → the confirmed European corridors
 *   draw → red destination marks where each corridor arrives.
 *
 * Verified geography only: every line is the supplier's, sea links stay
 * dashed (never a fake bridge). Green routes, red destinations, soft-white
 * labels; no glow. Reduced motion or no JavaScript: the whole map is simply
 * there. Framed on Italy on phones, on Italy and its nearest corridors on
 * tablets; from `lg` Italy with the European corridors around it (the map
 * sits beside the chapter text). Decorative — the base and the route list are
 * real text.
 */
export function CoverageMap({ className }: { className?: string }) {
  const destinations = EUROPE_CORRIDORS.map((route) => ({ id: route.id, at: endOf(route.d) }));
  return (
    <div
      aria-hidden="true"
      data-reveal="group"
      data-reveal-once
      className={cx(
        "relative aspect-[5/4] overflow-clip md:aspect-[3/2] lg:aspect-[16/10]",
        // Feathered edges: Europe fades into the surface, Italy stays at full strength.
        "[mask-image:radial-gradient(ellipse_52%_56%_at_50%_50%,black_45%,transparent_98%)]",
        className,
      )}
    >
      <div className="absolute top-[-18.6%] left-[-50.3%] aspect-[1800/1000] w-[190%] md:top-[-15%] md:left-[-29.2%] md:w-[150%] lg:top-[-17%] lg:left-[-31.6%] lg:w-[155%]">
        <Image
          src={MAPS.geographyDark}
          alt=""
          fill
          unoptimized
          className={cx(FADE, "select-none")}
          style={at(0)}
        />
        <svg viewBox={NETWORK_VIEWBOX} className="absolute inset-0 h-full w-full" fill="none">
          <defs>
            <clipPath id="coverage-network-clip">
              <rect {...NETWORK_CLIP} />
            </clipPath>
          </defs>
          <g clipPath="url(#coverage-network-clip)" strokeLinecap="round" strokeLinejoin="round">
            <g className="stroke-success-graphic" strokeOpacity="0.7" strokeWidth="1.8">
              {EUROPE_CORRIDORS.map((route) => (
                <path
                  key={route.id}
                  d={route.d}
                  pathLength={1}
                  className={DRAW}
                  style={at(1400)}
                />
              ))}
            </g>
            <g
              className={cx(FADE, "stroke-success-graphic")}
              strokeOpacity="0.7"
              strokeWidth="1.8"
              style={at(1900)}
            >
              {EUROPE_FERRIES.map((route) => (
                <path key={route.id} d={route.d} strokeDasharray="5 7" />
              ))}
            </g>
            <g className="stroke-success-graphic" strokeWidth="3.3">
              {ITALY_ROUTES.map((route) => (
                <path key={route.id} d={route.d} pathLength={1} className={DRAW} style={at(500)} />
              ))}
            </g>
            <g className={cx(FADE, "stroke-success-graphic")} strokeWidth="2.4" style={at(1300)}>
              {ITALY_FERRIES.map((route) => (
                <path key={route.id} d={route.d} strokeDasharray="4 5" />
              ))}
            </g>
            <g className={FADE} style={at(1100)}>
              {CITIES.map((city) => (
                <circle
                  key={city.id}
                  cx={city.x}
                  cy={city.y}
                  r="5.2"
                  className="fill-success-graphic stroke-background-primary"
                  strokeWidth="2"
                />
              ))}
              {LABELS.filter((label) => label.id !== "carpi").map((label) => (
                <text
                  key={label.id}
                  x={label.x}
                  y={label.y}
                  dy="0.35em"
                  textAnchor={label.anchor}
                  paintOrder="stroke"
                  strokeWidth="5"
                  className="fill-text-primary stroke-background-primary font-sans text-[34px] font-medium md:text-[26px] lg:text-[24px]"
                >
                  {label.text}
                </text>
              ))}
            </g>
            {destinations.map(({ id, at: [x, y] }) => (
              <rect
                key={id}
                x={x - 6}
                y={y - 6}
                width="12"
                height="12"
                transform={`rotate(45 ${x} ${y})`}
                className={cx(POP, "fill-action-primary")}
                style={at(2100)}
              />
            ))}
            <g className={POP} style={at(200)}>
              <circle
                cx={ORIGIN.x}
                cy={ORIGIN.y}
                r="13"
                className="fill-background-primary stroke-success-graphic"
                strokeWidth="1.5"
              />
              <circle cx={ORIGIN.x} cy={ORIGIN.y} r="6" className="fill-success-graphic" />
              {LABELS.filter((label) => label.id === "carpi").map((label) => (
                <text
                  key={label.id}
                  x={label.x}
                  y={label.y}
                  dy="0.35em"
                  textAnchor={label.anchor}
                  paintOrder="stroke"
                  strokeWidth="5"
                  className="fill-text-primary stroke-background-primary font-sans text-[34px] font-semibold md:text-[26px] lg:text-[24px]"
                >
                  {label.text}
                </text>
              ))}
            </g>
            {/* Carpi pulses once, as the network leaves it. */}
            <circle
              cx={ORIGIN.x}
              cy={ORIGIN.y}
              r="13"
              className="[transform-box:fill-box] origin-center fill-none stroke-success-graphic opacity-0 motion-safe:[[data-inview]_&]:animate-[pulse-once_1.6s_var(--ease-enter)_600ms_1]"
              strokeWidth="2"
            />
          </g>
        </svg>
      </div>
    </div>
  );
}
