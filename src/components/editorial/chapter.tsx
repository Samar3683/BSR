import type { ReactNode } from "react";

import { Surface, type SurfaceTone } from "@/components/layout/surface";
import { cx } from "@/lib/utils/cx";

/** How many chapters carry a mark (the close and the footer do not). */
export const CHAPTER_COUNT = 12;

interface ChapterMarkProps {
  /** Two digits, e.g. "02". */
  index: string;
  name: string;
  /** Technical context on the right, e.g. "Espresso · Dedicato". */
  context?: string;
}

/**
 * The thread that runs through the page: every chapter opens on the same
 * hairline, with a green segment that draws as the chapter arrives (the route
 * continuing), its index out of the whole ("04 / 12") and its name, and a
 * piece of technical context on the right. Decorative — the chapter's heading
 * carries its name for assistive technology.
 */
export function ChapterMark({ index, name, context }: ChapterMarkProps) {
  return (
    <div aria-hidden="true" data-reveal="group" className="relative">
      <div className="relative h-px bg-hairline">
        <span className="absolute inset-y-0 left-0 w-16 origin-left bg-success-graphic transition-[scale] delay-150 duration-700 ease-cinematic pending:scale-x-0 sm:w-24" />
      </div>
      <div className="flex items-center justify-between gap-6 pt-3 ed-meta text-text-secondary">
        <span className="flex items-center gap-3">
          <span className="text-success">
            {index} / {String(CHAPTER_COUNT).padStart(2, "0")}
          </span>
          <span>{name}</span>
        </span>
        {context && <span className="hidden text-right sm:block">{context}</span>}
      </div>
    </div>
  );
}

interface ChapterProps extends Partial<ChapterMarkProps> {
  id: string;
  tone: SurfaceTone;
  /** The id of the chapter's heading. */
  labelledBy: string;
  className?: string;
  /** Classes for the frame that holds the content. */
  frameClassName?: string;
  children: ReactNode;
  /** Extra attributes for analytics / quick actions (e.g. `data-conversion`). */
  conversion?: boolean;
}

/**
 * A chapter of the page below the hero: a surface, the chapter rhythm (sized
 * to fit about one viewport at 1440 × 900), the chapter mark, then the content
 * in the editorial frame. Horizontal overflow is clipped so pictures may run
 * to the viewport edge without a page scrollbar.
 */
export function Chapter({
  id,
  tone,
  labelledBy,
  index,
  name,
  context,
  className,
  frameClassName,
  conversion,
  children,
}: ChapterProps) {
  return (
    <Surface
      as="section"
      tone={tone}
      id={id}
      aria-labelledby={labelledBy}
      data-conversion={conversion || undefined}
      className={cx("relative overflow-x-clip ed-chapter", className)}
    >
      {index && name && (
        <div className="ed-frame mb-[clamp(1.5rem,1rem+1.6vw,2.75rem)]">
          <ChapterMark index={index} name={name} context={context} />
        </div>
      )}
      <div className={cx("ed-frame", frameClassName)}>{children}</div>
    </Surface>
  );
}
