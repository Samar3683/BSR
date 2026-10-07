import type { CSSProperties } from "react";

import { cx } from "@/lib/utils/cx";

/*
 * The road out of the yard, drawn (decorative SVG, no assets to load): an
 * industrial edge of the Po valley — sheds, a crane, light poles — then a row
 * of poplars and a guardrail, then the carriageway. Each layer is a strip two
 * viewports wide that the scene slides left at its own speed (parallax), so
 * the truck in front appears to drive while it holds the centre of the frame.
 *
 * Deterministic shapes (no randomness at render: identical on server and
 * client). Colours are the light scene's: Warm White → Stone tints.
 */

const W = 2400;

/** Sheds and warehouses along the far edge: [x, width, height, roof]. */
const SHEDS: Array<[number, number, number, "flat" | "saw" | "gable"]> = [
  [0, 260, 92, "saw"],
  [300, 180, 120, "flat"],
  [520, 340, 80, "gable"],
  [900, 210, 104, "flat"],
  [1150, 300, 86, "saw"],
  [1500, 160, 132, "flat"],
  [1700, 280, 96, "gable"],
  [2020, 240, 112, "saw"],
];

function shedPath([x, w, h, roof]: (typeof SHEDS)[number], base: number) {
  const top = base - h;
  if (roof === "gable")
    return `M${x} ${base}V${top + 18}L${x + w / 2} ${top}L${x + w} ${top + 18}V${base}Z`;
  if (roof === "saw") {
    const teeth = Math.max(3, Math.round(w / 60));
    const step = w / teeth;
    let d = `M${x} ${base}V${top + 16}`;
    for (let i = 0; i < teeth; i++) d += `L${x + i * step + step} ${top}V${top + 16}`;
    return `${d}V${base}Z`;
  }
  return `M${x} ${base}V${top}H${x + w}V${base}Z`;
}

interface LayerProps {
  className?: string;
  style?: CSSProperties;
}

/** The far edge: sheds, a tower crane, light poles. */
export function RoadSkyline({ className, style }: LayerProps) {
  const base = 300;
  return (
    <svg
      aria-hidden="true"
      viewBox={`0 0 ${W} ${base}`}
      preserveAspectRatio="xMinYMax slice"
      className={cx("block", className)}
      style={style}
    >
      <g className="fill-[#e4e6e0]">
        {SHEDS.map((shed) => (
          <path key={shed[0]} d={shedPath(shed, base)} />
        ))}
      </g>
      {/* A tower crane over the sheds. */}
      <g className="stroke-[#d6d9d2]" strokeWidth="5" fill="none">
        <path d={`M1360 ${base}V120M1300 126H1520M1360 120L1420 126M1500 126V150`} />
      </g>
      {/* Light poles. */}
      <g className="stroke-[#d6d9d2]" strokeWidth="3">
        {[140, 470, 860, 1260, 1640, 2000, 2340].map((x) => (
          <path key={x} d={`M${x} ${base}V${base - 150}H${x + 24}`} fill="none" />
        ))}
      </g>
    </svg>
  );
}

/** The near edge: poplars and the guardrail. */
export function RoadVerge({ className, style }: LayerProps) {
  const base = 200;
  const poplars = [60, 120, 175, 600, 655, 1040, 1100, 1160, 1580, 1640, 2100, 2160];
  return (
    <svg
      aria-hidden="true"
      viewBox={`0 0 ${W} ${base}`}
      preserveAspectRatio="xMinYMax slice"
      className={cx("block", className)}
      style={style}
    >
      <g className="fill-[#cfd5cd]">
        {poplars.map((x, i) => {
          const h = 120 + ((i * 37) % 50);
          return <ellipse key={x} cx={x} cy={base - 26 - h / 2} rx={15 + (i % 3) * 3} ry={h / 2} />;
        })}
      </g>
      {/* Guardrail: a rail on posts. */}
      <g className="fill-[#b8bdba]">
        <rect x="0" y={base - 30} width={W} height="7" />
        {Array.from({ length: 48 }, (_, i) => (
          <rect key={i} x={i * 50 + 10} y={base - 30} width="4" height="30" />
        ))}
      </g>
    </svg>
  );
}
