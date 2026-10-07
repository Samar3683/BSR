import Image from "next/image";

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

/*
 * The camera over the map, per step of the act (styles: time-based, 1.6 s,
 * scaled around Carpi): the base → the north → Italy → Europe. Only while
 * the act is pinned; otherwise the whole map, every route drawn.
 */
const CAMERA = [
  "pinned:group-data-[step=0]/scene:scale-[3.4]",
  "pinned:group-data-[step=1]/scene:scale-[2.3]",
  "pinned:group-data-[step=2]/scene:scale-[1.35]",
  "pinned:group-data-[step=3]/scene:scale-[0.8]",
].join(" ");

/** A route drawing once the camera reaches `from` (a step); drawn at rest. */
const DRAW = "[stroke-dasharray:1] transition-[stroke-dashoffset] duration-[1400ms] ease-cinematic";
const UNTIL: Record<1 | 2 | 3, string> = {
  1: "pinned:group-data-[step=0]/scene:[stroke-dashoffset:1]",
  2: "pinned:group-data-[step=0]/scene:[stroke-dashoffset:1] pinned:group-data-[step=1]/scene:[stroke-dashoffset:1]",
  3: "pinned:group-data-[step=0]/scene:[stroke-dashoffset:1] pinned:group-data-[step=1]/scene:[stroke-dashoffset:1] pinned:group-data-[step=2]/scene:[stroke-dashoffset:1]",
};
const SHOW_FROM: Record<1 | 2 | 3, string> = {
  1: "pinned:group-data-[step=0]/scene:opacity-0",
  2: "pinned:group-data-[step=0]/scene:opacity-0 pinned:group-data-[step=1]/scene:opacity-0",
  3: "pinned:group-data-[step=0]/scene:opacity-0 pinned:group-data-[step=1]/scene:opacity-0 pinned:group-data-[step=2]/scene:opacity-0",
};
const FADE = "transition-opacity duration-700 ease-enter";

/**
 * The supplied BSR coverage map (geography + the route network, one viewBox)
 * as the stage of the network act: it follows the act's step (the enclosing
 * `group/scene`) — the camera starts close on Carpi and pulls back while the
 * Italian network draws, then the island links, then the confirmed European
 * corridors, and the red destinations arrive. Verified geography only: every
 * line is the supplier's, sea links stay dashed. Decorative — the base, the
 * reach and the routes are real text beside it.
 */
export function CoverageMap({ className }: { className?: string }) {
  const destinations = EUROPE_CORRIDORS.map((route) => ({ id: route.id, at: endOf(route.d) }));
  const origin = { x: (ORIGIN.x / 1800) * 100, y: (ORIGIN.y / 1000) * 100 };
  return (
    <div aria-hidden="true" className={cx("overflow-clip", className ?? "relative")}>
      <div
        className={cx(
          "absolute top-1/2 left-1/2 aspect-[1800/1000] w-[150%] -translate-x-1/2 -translate-y-1/2 transition-[scale] duration-[1600ms] ease-cinematic motion-reduce:transition-none",
          CAMERA,
        )}
        style={{ transformOrigin: `${origin.x}% ${origin.y}%` }}
      >
        <Image src={MAPS.geographyDark} alt="" fill unoptimized className="select-none" />
        <svg viewBox={NETWORK_VIEWBOX} className="absolute inset-0 h-full w-full" fill="none">
          <defs>
            <clipPath id="coverage-network-clip">
              <rect {...NETWORK_CLIP} />
            </clipPath>
          </defs>
          <g clipPath="url(#coverage-network-clip)" strokeLinecap="round" strokeLinejoin="round">
            <g className="stroke-success-graphic" strokeOpacity="0.75" strokeWidth="1.8">
              {EUROPE_CORRIDORS.map((route) => (
                <path key={route.id} d={route.d} pathLength={1} className={cx(DRAW, UNTIL[3])} />
              ))}
            </g>
            <g
              className={cx(FADE, SHOW_FROM[3], "stroke-success-graphic")}
              strokeOpacity="0.75"
              strokeWidth="1.8"
            >
              {EUROPE_FERRIES.map((route) => (
                <path key={route.id} d={route.d} strokeDasharray="5 7" />
              ))}
            </g>
            <g className="stroke-success-graphic" strokeWidth="3.3">
              {ITALY_ROUTES.map((route) => (
                <path
                  key={route.id}
                  d={route.d}
                  pathLength={1}
                  className={cx(DRAW, route.id.startsWith("italy-north") ? UNTIL[1] : UNTIL[2])}
                />
              ))}
            </g>
            <g className={cx(FADE, SHOW_FROM[2], "stroke-success-graphic")} strokeWidth="2.4">
              {ITALY_FERRIES.map((route) => (
                <path key={route.id} d={route.d} strokeDasharray="4 5" />
              ))}
            </g>
            <g className={cx(FADE, SHOW_FROM[2])}>
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
                  className="fill-text-primary stroke-background-primary font-sans text-[22px] font-medium"
                >
                  {label.text}
                </text>
              ))}
            </g>
            {destinations.map(({ id, at: [x, y] }) => (
              <g key={id} className={cx(FADE, SHOW_FROM[3])}>
                <circle cx={x} cy={y} r="16" className="fill-action-primary/25" />
                <rect
                  x={x - 6}
                  y={y - 6}
                  width="12"
                  height="12"
                  transform={`rotate(45 ${x} ${y})`}
                  className="fill-action-primary"
                />
              </g>
            ))}
            <g>
              <circle cx={ORIGIN.x} cy={ORIGIN.y} r="22" className="fill-success-graphic/20" />
              <circle
                cx={ORIGIN.x}
                cy={ORIGIN.y}
                r="11"
                className="fill-background-primary stroke-success-graphic"
                strokeWidth="1.5"
              />
              <circle cx={ORIGIN.x} cy={ORIGIN.y} r="5" className="fill-success-graphic" />
              {LABELS.filter((label) => label.id === "carpi").map((label) => (
                <text
                  key={label.id}
                  x={label.x + 6}
                  y={label.y}
                  dy="0.35em"
                  textAnchor={label.anchor}
                  paintOrder="stroke"
                  strokeWidth="5"
                  className="fill-text-primary stroke-background-primary font-sans text-[22px] font-semibold"
                >
                  {label.text}
                </text>
              ))}
            </g>
          </g>
        </svg>
      </div>
    </div>
  );
}
