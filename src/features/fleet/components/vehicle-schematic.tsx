import type { VehicleKind } from "../config/vehicles-content";

/**
 * Technical side elevations — line drawings under each vehicle photograph, a
 * spec strip that reads across the three types. Each sits on the same ground
 * line in a 600 × 290 frame. Each is fitted to its frame rather than drawn
 * to a common scale, so the lineup never reads as truck-led.
 *
 * Only the van carries dimension lines, labelled with the supplied indicative
 * figures; rigid trucks and tractor units carry none (no invented dimensions).
 * Decorative: the same information is in the text beside each drawing.
 */
export function VehicleSchematic({ kind }: { kind: VehicleKind }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 90 600 290"
      className="absolute inset-0 h-full w-full"
      fill="none"
      strokeLinejoin="round"
    >
      <line x1="0" y1="360" x2="600" y2="360" className="stroke-border-strong" strokeWidth="1" />
      {kind === "van" && <Van />}
      {kind === "rigid" && <Rigid />}
      {kind === "tractor" && <Tractor />}
    </svg>
  );
}

const OUTLINE = "stroke-text-secondary";
const DETAIL = "stroke-text-muted";

function Wheel({ x, y, r }: { x: number; y: number; r: number }) {
  return (
    <g>
      {/* Filled in the plate colour, so the body line reads as passing behind. */}
      <circle
        cx={x}
        cy={y}
        r={r}
        className={`fill-background-primary ${OUTLINE}`}
        strokeWidth="1.5"
      />
      <circle cx={x} cy={y} r={r * 0.32} className={DETAIL} strokeWidth="1" />
    </g>
  );
}

/** Panel van, cargo area dimensioned (≈ 4 m long, ≈ 2 m high: 80 units per metre). */
function Van() {
  return (
    <g>
      <path
        d="M40 320 L40 262 Q42 246 66 242 L130 176 Q142 160 160 160 L510 160 L510 320 Z"
        className={OUTLINE}
        strokeWidth="1.5"
        vectorEffect="non-scaling-stroke"
      />
      <path d="M78 240 L132 184 L180 184 L180 240 Z" className={DETAIL} strokeWidth="1" />
      <line
        x1="190"
        y1="168"
        x2="190"
        y2="320"
        className={DETAIL}
        strokeWidth="1"
        strokeDasharray="4 5"
      />
      <Wheel x={120} y={332} r={28} />
      <Wheel x={430} y={332} r={28} />

      {/* Length of the load area. */}
      <g className="stroke-text-primary" strokeWidth="1">
        <line x1="190" y1="160" x2="190" y2="118" strokeDasharray="2 4" className={DETAIL} />
        <line x1="510" y1="160" x2="510" y2="118" strokeDasharray="2 4" className={DETAIL} />
        <line x1="190" y1="128" x2="510" y2="128" className="rule-draw" />
        <line x1="190" y1="120" x2="190" y2="136" />
        <line x1="510" y1="120" x2="510" y2="136" />
      </g>
      <text
        x="350"
        y="112"
        textAnchor="middle"
        className="fill-text-primary font-sans text-[20px] tabular-nums"
      >
        ≈ 4 m
      </text>

      {/* Height of the load area. */}
      <g className="stroke-text-primary" strokeWidth="1">
        <line x1="510" y1="160" x2="552" y2="160" strokeDasharray="2 4" className={DETAIL} />
        <line x1="510" y1="320" x2="552" y2="320" strokeDasharray="2 4" className={DETAIL} />
        <line x1="542" y1="160" x2="542" y2="320" className="rule-draw-down" />
        <line x1="534" y1="160" x2="550" y2="160" />
        <line x1="534" y1="320" x2="550" y2="320" />
      </g>
      <text
        x="572"
        y="240"
        textAnchor="middle"
        transform="rotate(-90 572 240)"
        className="fill-text-primary font-sans text-[20px] tabular-nums"
      >
        ≈ 2 m
      </text>
    </g>
  );
}

/** Rigid truck (motrice): cab-over, box body. No dimensions. */
function Rigid() {
  return (
    <g>
      <path
        d="M40 330 L40 196 Q40 176 60 174 L150 174 L150 330 Z"
        className={OUTLINE}
        strokeWidth="1.5"
        vectorEffect="non-scaling-stroke"
      />
      <path d="M60 190 L140 190 L140 246 L60 246 Z" className={DETAIL} strokeWidth="1" />
      <rect
        x="160"
        y="120"
        width="400"
        height="200"
        className={OUTLINE}
        strokeWidth="1.5"
        vectorEffect="non-scaling-stroke"
      />
      <line x1="40" y1="330" x2="560" y2="330" className={OUTLINE} strokeWidth="1.5" />
      <Wheel x={100} y={330} r={30} />
      <Wheel x={470} y={330} r={30} />
    </g>
  );
}

/** Tractor unit with a curtain-side semi-trailer. No dimensions. */
function Tractor() {
  const straps = Array.from({ length: 9 }, (_, i) => 210 + i * 40);
  return (
    <g>
      <path
        d="M20 336 L20 214 Q20 196 38 194 L112 194 L112 336 Z"
        className={OUTLINE}
        strokeWidth="1.5"
        vectorEffect="non-scaling-stroke"
      />
      <path d="M34 208 L100 208 L100 250 L34 250 Z" className={DETAIL} strokeWidth="1" />
      <path d="M40 194 L62 162 L150 156 L150 194" className={DETAIL} strokeWidth="1" />
      <line x1="20" y1="336" x2="200" y2="336" className={OUTLINE} strokeWidth="1.5" />
      <rect
        x="170"
        y="150"
        width="410"
        height="160"
        className={OUTLINE}
        strokeWidth="1.5"
        vectorEffect="non-scaling-stroke"
      />
      {straps.map((x) => (
        <line
          key={x}
          x1={x}
          y1="156"
          x2={x}
          y2="304"
          className={DETAIL}
          strokeWidth="1"
          strokeOpacity="0.6"
        />
      ))}
      <line x1="170" y1="318" x2="580" y2="318" className={OUTLINE} strokeWidth="1.5" />
      <Wheel x={64} y={338} r={22} />
      <Wheel x={160} y={338} r={22} />
      <Wheel x={470} y={338} r={22} />
      <Wheel x={516} y={338} r={22} />
      <Wheel x={562} y={338} r={22} />
    </g>
  );
}
