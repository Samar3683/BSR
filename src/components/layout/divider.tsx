import { cx } from "@/lib/utils/cx";

interface DividerProps {
  /**
   * `default` (most rules), `strong` (chapter openings — see `SectionHeader`)
   * or `accent` (the one destination point a block stands on, in red).
   */
  tone?: "default" | "strong" | "accent";
  /** Draw the rule in, left to right, once it enters the viewport (styles/motion.css). */
  draw?: boolean;
  className?: string;
}

/**
 * A hairline rule marking a break in the editorial rhythm: closing a block,
 * separating the footer's legal line, or opening a chapter. Semantics live
 * in the heading that follows it, so this is `aria-hidden`.
 */
export function Divider({ tone = "default", draw = false, className }: DividerProps) {
  return (
    <hr
      aria-hidden="true"
      data-reveal={draw ? "group" : undefined}
      className={cx(
        "m-0 border-0 border-t",
        {
          default: "border-border-default",
          strong: "border-border-strong",
          accent: "border-action-primary",
        }[tone],
        draw &&
          "origin-left transition-[scale] duration-700 ease-cinematic pending:scale-x-0",
        className,
      )}
    />
  );
}
