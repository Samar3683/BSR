import type { ComponentPropsWithoutRef } from "react";

import { cx } from "@/lib/utils/cx";

export type ContainerSize = "text-narrow" | "text" | "text-wide" | "content" | "wide" | "full";

// Literal class names so Tailwind can detect them.
const SIZES: Record<ContainerSize, string> = {
  "text-narrow": "container-text-narrow",
  text: "container-text",
  "text-wide": "container-text-wide",
  content: "container-content",
  wide: "container-wide",
  full: "container-full",
};

interface ContainerProps extends ComponentPropsWithoutRef<"div"> {
  size?: ContainerSize;
}

/**
 * Page-level width and gutters. Use one container per region; inside it,
 * constrain reading text with `max-w-text*` rather than nesting containers.
 */
export function Container({ size = "content", className, ...props }: ContainerProps) {
  return <div className={cx(SIZES[size], className)} {...props} />;
}
