import type { CSSProperties, ReactNode } from "react";

import { cx } from "@/lib/utils/cx";

/**
 * The film's small vocabulary (styles/cinematic.css): segment styles, the ink
 * title, the giant word behind a scene, the act label, a technical readout.
 * Server components; motion comes from the scene's `--p` alone.
 */

/** Inline variables for a `seg` element: it plays while the scene crosses [a, b]. */
export const seg = (a: number, b: number, extra?: Record<string, string | number>) =>
  ({ "--a": a, "--b": b, ...extra }) as CSSProperties;

interface InkTitleProps {
  id?: string;
  as?: "h2" | "h3" | "p";
  /** One entry per line. */
  lines: readonly string[];
  /** Lines (by index) that stay in the muted voice — the two-tone title. */
  muted?: readonly number[];
  className?: string;
  /** The scene progress over which the lines are inked, one after another. */
  from?: number;
  to?: number;
}

/**
 * A title whose lines are inked as the scene plays: each line is set in a
 * readable muted colour and a darker copy is uncovered over it, left to right,
 * line after line. The heading's text is the plain lines (the copies are
 * hidden from assistive technology). At rest — no director, reduced motion —
 * every line is inked. Muted lines stay muted: the two-tone title.
 */
export function InkTitle({
  id,
  as: Element = "h2",
  lines,
  muted = [],
  className,
  from = 0,
  to = 0.4,
}: InkTitleProps) {
  const span = (to - from) / Math.max(lines.length, 1);
  return (
    <Element id={id} className={className}>
      {lines.map((line, i) => (
        <span
          key={line}
          className="relative block seg"
          style={seg(from + i * span, from + (i + 1) * span)}
        >
          <span className="text-ink-muted">{line}</span>
          {!muted.includes(i) && (
            <span aria-hidden="true" className="absolute inset-0 text-text-primary ink-cover">
              {line}
            </span>
          )}
          {/* Separates the lines for assistive technology ("…dedicati. In Italia…"). */}
          {i < lines.length - 1 && <span className="sr-only"> </span>}
        </span>
      ))}
    </Element>
  );
}

interface GiantWordProps {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}

/** The giant word behind a scene — decorative, pale, often wider than the screen. */
export function GiantWord({ children, className, style }: GiantWordProps) {
  return (
    <p
      aria-hidden="true"
      className={cx("pointer-events-none cine-giant select-none", className)}
      style={style}
    >
      {children}
    </p>
  );
}

interface ActLabelProps {
  /** Two digits, e.g. "04". */
  act: string;
  name: string;
  /** Technical context on the right (coordinates, a route). */
  meta?: ReactNode;
  className?: string;
}

/** The act's mark: "ATTO 04 — PREPARAZIONE", a green state dot, context on the right. */
export function ActLabel({ act, name, meta, className }: ActLabelProps) {
  return (
    <div
      aria-hidden="true"
      className={cx(
        "flex items-center justify-between gap-6 ed-meta text-text-secondary",
        className,
      )}
    >
      <span className="flex items-center gap-3">
        <span className="size-1.5 shrink-0 rounded-full bg-success-graphic" />
        <span className="text-success">Atto {act}</span>
        <span className="h-px w-6 bg-hairline-strong" />
        <span>{name}</span>
      </span>
      {meta && <span className="hidden text-right sm:block">{meta}</span>}
    </div>
  );
}

/** A technical readout: a mono label over a value (coordinates, speed, a state). */
export function Readout({
  label,
  value,
  className,
}: {
  label: string;
  value: ReactNode;
  className?: string;
}) {
  return (
    <span className={cx("flex flex-col gap-1", className)}>
      <span className="ed-meta text-text-secondary">{label}</span>
      <span className="ed-label text-text-primary">{value}</span>
    </span>
  );
}
