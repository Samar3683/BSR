import { cx } from "@/lib/utils/cx";

interface BrandMarkProps {
  /** Show the "Trasporti" descriptor next to the letters. */
  descriptor?: boolean;
  className?: string;
}

/**
 * ⚠ PLACEHOLDER WORDMARK until the official BSR logo is supplied: the letters
 * are typeset in Archivo (expanded, heavy), not a drawn logo. Swap the inner
 * markup for the supplied SVG; keep the component name and the accessible name.
 * Brand form ("BSR" vs "BSR Trasporti") is still to be confirmed.
 */
export function BrandMark({ descriptor = true, className }: BrandMarkProps) {
  return (
    <span className={cx("inline-flex items-baseline gap-2.5", className)}>
      <span className="font-display text-[1.5rem] leading-none font-extrabold tracking-[0.06em] [font-stretch:125%]">
        BSR
      </span>
      {descriptor && <span className="type-label-sm text-text-secondary">Trasporti</span>}
    </span>
  );
}
