import type { ReactNode } from "react";

import { Surface, type SurfaceTone } from "@/components/layout/surface";
import { cx } from "@/lib/utils/cx";

interface ChapterMarkProps {
  /** The act's number, two digits, e.g. "08". */
  index: string;
  name: string;
  /** Technical context on the right, e.g. "Espresso · Dedicato". */
  context?: string;
}

/**
 * The act's mark (the film's chapters, features/story/config/acts.ts): a green
 * state dot, "Atto 08", a short rule, the act's name, and a piece of technical
 * context on the right. The green dot grows on entry. Decorative — the
 * chapter's heading carries its name for assistive technology.
 */
export function ChapterMark({ index, name, context }: ChapterMarkProps) {
  return (
    <div
      aria-hidden="true"
      data-reveal="group"
      className="flex items-center justify-between gap-6 ed-meta text-text-secondary"
    >
      <span className="flex items-center gap-3">
        <span className="size-1.5 shrink-0 rounded-full bg-success-graphic transition-[scale] delay-150 duration-500 ease-enter pending:scale-0" />
        <span className="text-success">Atto {index}</span>
        <span className="h-px w-6 origin-left bg-hairline-strong transition-[scale] delay-200 duration-700 ease-cinematic pending:scale-x-0" />
        <span>{name}</span>
      </span>
      {context && <span className="hidden text-right sm:block">{context}</span>}
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
 * A chapter of the film that scrolls normally (the calmer acts after the
 * journey): a surface, the chapter rhythm, the act's mark, then the content
 * in the editorial frame. A view scene for the SceneDirector, so its title
 * can be inked as it arrives. Horizontal overflow is clipped so pictures may run
 * to the viewport edge without a page scrollbar.
 */
export function Chapter({
  id,
  tone,
  labelledBy,
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
      data-scene="view"
      className={cx("relative overflow-x-clip ed-chapter", className)}
    >
      <div className={cx("ed-frame", frameClassName)}>{children}</div>
    </Surface>
  );
}
