import type { ComponentPropsWithoutRef } from "react";

import { cx } from "@/lib/utils/cx";

import { Surface, type SurfaceTone } from "./surface";

export type SectionSpacing = "none" | "sm" | "md" | "lg";

const SPACING: Record<SectionSpacing, string> = {
  none: "",
  sm: "py-section-sm",
  md: "py-section",
  lg: "py-section-lg",
};

interface SectionProps extends ComponentPropsWithoutRef<"section"> {
  /** Omit to inherit the surrounding environment. */
  tone?: SurfaceTone;
  spacing?: SectionSpacing;
}

/**
 * Vertical rhythm for a page region. Label it for assistive technology with
 * `aria-labelledby` pointing at its heading.
 */
export function Section({ tone, spacing = "md", className, ...props }: SectionProps) {
  const classes = cx(SPACING[spacing], className);

  if (tone) return <Surface as="section" tone={tone} className={classes} {...props} />;
  return <section className={classes} {...props} />;
}
