import type { LucideIcon } from "lucide-react";

import { cx } from "@/lib/utils/cx";

const ICON_SIZE = { sm: 16, md: 20, lg: 24 } as const;

export type IconSize = keyof typeof ICON_SIZE;

interface IconProps {
  icon: LucideIcon;
  size?: IconSize;
  /** Accessible name. Omit for decorative icons next to visible text. */
  label?: string;
  className?: string;
}

/**
 * The only way icons are rendered. Lucide outline glyphs at a fixed 1.75px
 * stroke regardless of size (absoluteStrokeWidth), so every icon carries the
 * same optical weight. Colour is inherited from text (currentColor).
 */
export function Icon({ icon: Glyph, size = "md", label, className }: IconProps) {
  return (
    <Glyph
      size={ICON_SIZE[size]}
      strokeWidth={1.75}
      absoluteStrokeWidth
      aria-hidden={label ? undefined : true}
      aria-label={label}
      role={label ? "img" : undefined}
      focusable="false"
      className={cx("shrink-0", className)}
    />
  );
}
