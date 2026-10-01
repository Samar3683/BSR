import type { ComponentPropsWithoutRef } from "react";

import { cx } from "@/lib/utils/cx";

export type SurfaceTone =
  | "carbon"
  | "graphite"
  | "asphalt"
  | "white"
  | "soft-white"
  | "warm-white"
  | "green";

type SurfaceElement = "div" | "section" | "article" | "aside" | "header" | "footer";

interface SurfaceProps extends ComponentPropsWithoutRef<"div"> {
  tone: SurfaceTone;
  as?: SurfaceElement;
}

/**
 * Switches the visual environment for its subtree. Every semantic colour
 * role (text, borders, actions, focus, status) re-resolves for the tone, so
 * components placed inside adapt without variants of their own.
 */
export function Surface({ tone, as: Element = "div", className, ...props }: SurfaceProps) {
  return (
    <Element
      data-surface={tone}
      className={cx("bg-background-primary text-text-primary", className)}
      {...props}
    />
  );
}
