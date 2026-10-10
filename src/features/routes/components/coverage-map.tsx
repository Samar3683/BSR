import Image from "next/image";
import { type CSSProperties, useId } from "react";

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
import styles from "./coverage-map.module.css";

/** Line weight read by the zoom compensation (`.weight`); also the unpinned width. */
const weight = (w: number) => ({ strokeWidth: w, style: { "--w": w } as CSSProperties });

/** The last point of a corridor: where the route arrives. */
function endOf(d: string): [number, number] {
  const match = d.trim().match(/(-?[\d.]+)[ ,](-?[\d.]+)$/);
  return match ? [Number(match[1]), Number(match[2])] : [0, 0];
}

/** Route dash set-up for drawing (pathLength 1); the offset is scrubbed (coverage-map.module.css). */
const DRAWABLE = "[stroke-dasharray:1]";

/**
 * The supplied BSR coverage map (geography + the route network, one viewBox)
 * as the stage of the network act: it follows the act's step (the enclosing
 * `group/scene`) — the camera starts close on Carpi and pulls back while the
 * Italian network draws, then the island links, then the confirmed European
 * corridors, and the red destinations arrive. Verified geography only: every
 * line is the supplier's, sea links stay dashed. Decorative — the base, the
 * reach and the routes are real text beside it. The camera and the reveals
 * scrub with the act's progress (coverage-map.module.css): they follow the
 * scroll exactly and stop when it stops.
 */
export function CoverageMap({ className }: { className?: string }) {
  // Unique per instance: two maps on one page must not share a clip path.
  const clipId = `coverage-clip-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const destinations = EUROPE_CORRIDORS.map((route) => ({ id: route.id, at: endOf(route.d) }));
  const origin = { x: (ORIGIN.x / 1800) * 100, y: (ORIGIN.y / 1000) * 100 };
  return (
    <div aria-hidden="true" className={cx("overflow-clip", className ?? "relative")}>
      <div
        className={cx(
          "absolute top-1/2 left-1/2 aspect-[1800/1000] w-[150%] -translate-x-1/2 -translate-y-1/2",
          styles.camera,
        )}
        style={{ transformOrigin: `${origin.x}% ${origin.y}%` }}
      >
        <Image src={MAPS.geographyDark} alt="" fill unoptimized className="select-none" />
        <svg viewBox={NETWORK_VIEWBOX} className="absolute inset-0 h-full w-full" fill="none">
          <defs>
            <clipPath id={clipId}>
              <rect {...NETWORK_CLIP} />
            </clipPath>
          </defs>
          <g clipPath={`url(#${clipId})`} strokeLinecap="round" strokeLinejoin="round">
            <g
              className={cx(styles.weight, "stroke-success-graphic")}
              strokeOpacity="0.75"
              {...weight(1.8)}
            >
              {EUROPE_CORRIDORS.map((route) => (
                <path
                  key={route.id}
                  d={route.d}
                  pathLength={1}
                  className={cx(DRAWABLE, styles.draw3)}
                />
              ))}
            </g>
            <g
              className={cx(styles.show3, styles.weight, "stroke-success-graphic")}
              strokeOpacity="0.75"
              {...weight(1.8)}
            >
              {EUROPE_FERRIES.map((route) => (
                <path key={route.id} d={route.d} strokeDasharray="5 7" />
              ))}
            </g>
            <g className={cx(styles.weight, "stroke-success-graphic")} {...weight(3.3)}>
              {ITALY_ROUTES.map((route) => (
                <path
                  key={route.id}
                  d={route.d}
                  pathLength={1}
                  className={cx(
                    DRAWABLE,
                    route.id.startsWith("italy-north") ? styles.draw1 : styles.draw2,
                  )}
                />
              ))}
            </g>
            <g
              className={cx(styles.show2, styles.weight, "stroke-success-graphic")}
              {...weight(2.4)}
            >
              {ITALY_FERRIES.map((route) => (
                <path key={route.id} d={route.d} strokeDasharray="4 5" />
              ))}
            </g>
            <g className={styles.show2}>
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
                  className={cx(
                    styles.label,
                    "fill-text-primary stroke-background-primary font-sans text-[22px] font-medium",
                  )}
                >
                  {label.text}
                </text>
              ))}
            </g>
            {destinations.map(({ id, at: [x, y] }) => (
              <g key={id} className={styles.show3}>
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
                  className={cx(
                    styles.label,
                    "fill-text-primary stroke-background-primary font-sans text-[22px] font-semibold",
                  )}
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
