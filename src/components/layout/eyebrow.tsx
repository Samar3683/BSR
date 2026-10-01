import { cx } from "@/lib/utils/cx";

interface EyebrowProps {
  children: string;
  className?: string;
}

/**
 * The small label that opens a section or a block: a short green route stroke,
 * then the label in the brand green (the surface's success text role). Used in
 * `SectionHeader` and standalone wherever a block needs the same opening.
 */
export function Eyebrow({ children, className }: EyebrowProps) {
  return (
    <p className={cx("flex items-center gap-3 type-label-sm text-success", className)}>
      <span aria-hidden="true" className="h-0.5 w-6 bg-success-graphic" />
      {children}
    </p>
  );
}
