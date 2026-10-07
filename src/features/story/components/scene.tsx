import type { CSSProperties, ReactNode } from "react";

import type { SurfaceTone } from "@/components/layout/surface";
import { cx } from "@/lib/utils/cx";

import { type Act, trackStyle } from "../config/acts";

/** Where a scene pins: on every screen tall enough, or from `lg` up only. */
export type PinFrom = "all" | "lg";

// Literal class lists (Tailwind reads them from source): the track's height and
// the sticky stage, per pin breakpoint. Phones use their own, shorter track.
const TRACK: Record<PinFrom, string> = {
  all: "pin:h-(--track-phone) md:pin:h-(--track)",
  lg: "lg:pin:h-(--track)",
};
const STAGE: Record<PinFrom, string> = {
  all: "pin:sticky pin:top-0 pin:h-svh pin:overflow-clip",
  lg: "lg:pin:sticky lg:pin:top-0 lg:pin:h-svh lg:pin:overflow-clip",
};

interface PinnedSceneProps {
  id: string;
  act: Act;
  tone: SurfaceTone;
  labelledBy: string;
  /** Steps the scene shows in turn (SceneDirector `data-steps`). */
  steps?: number;
  /** The share of the scene's progress the steps occupy, e.g. [0.15, 0.85]. */
  stepRange?: readonly [number, number];
  /** Where the scene pins (see PinFrom). */
  pinFrom?: PinFrom;
  className?: string;
  stageClassName?: string;
  style?: CSSProperties;
  children: ReactNode;
  /** A conversion region (the quick actions step aside over it). */
  conversion?: boolean;
}

/**
 * A pinned act: the section is a tall track (its scroll length, from the
 * act's config), its stage sticks for the length of it, and the SceneDirector
 * turns the scroll into `--p` and the current step. Without JavaScript, under
 * reduced motion, on short screens — or below `lg` for `pinFrom="lg"` — the
 * section is an ordinary block and the stage lays its steps out one after
 * another.
 */
export function PinnedScene({
  id,
  act,
  tone,
  labelledBy,
  steps,
  stepRange,
  pinFrom = "all",
  className,
  stageClassName,
  style,
  children,
  conversion,
}: PinnedSceneProps) {
  return (
    <section
      id={id}
      aria-labelledby={labelledBy}
      data-surface={tone}
      data-scene="pin"
      data-steps={steps}
      data-step-range={stepRange?.join(" ")}
      data-conversion={conversion || undefined}
      style={{ ...trackStyle(act), ...style } as CSSProperties}
      className={cx(
        "relative overflow-x-clip bg-background-primary text-text-primary",
        TRACK[pinFrom],
        className,
      )}
    >
      <div data-stage className={cx("relative", STAGE[pinFrom], stageClassName)}>
        {children}
      </div>
    </section>
  );
}
