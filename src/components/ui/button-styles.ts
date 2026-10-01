import { cx } from "@/lib/utils/cx";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "inverse";
export type ButtonSize = "sm" | "md" | "lg";

/*
 * Button rules
 * - primary: the BSR red action. One per view region; never for navigation
 *   between equal options.
 * - secondary: outlined alternative next to a primary.
 * - ghost: low-emphasis actions in dense or task contexts.
 * - inverse: high-contrast action over imagery/cinematic scenes.
 * Green is never a button colour: it means operational state, not action.
 *
 * Sizes keep targets comfortable: md 48px, lg 56px; sm (40px) grows to 44px on
 * coarse pointers.
 */

const BASE =
  "group/button relative inline-flex shrink-0 cursor-pointer items-center justify-center gap-2.5 whitespace-nowrap rounded-md border select-none transition-ui " +
  "motion-safe:active:translate-y-px " +
  "disabled:cursor-not-allowed disabled:border-border-default disabled:bg-transparent disabled:text-text-disabled " +
  "aria-busy:cursor-progress aria-busy:pointer-events-none";

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    "border-transparent bg-action-primary text-on-action-primary hover:bg-action-primary-hover active:bg-action-primary-active",
  secondary:
    "border-border-strong bg-transparent text-text-primary hover:border-border-interactive hover:bg-overlay-hover active:bg-overlay-pressed",
  ghost:
    "border-transparent bg-transparent text-text-primary hover:bg-overlay-hover active:bg-overlay-pressed",
  inverse:
    "border-transparent bg-background-inverse text-text-inverse hover:bg-background-inverse-hover active:bg-background-inverse-hover",
};

const SIZES: Record<ButtonSize, string> = {
  sm: "min-h-10 px-4 type-label-md pointer-coarse:min-h-(--target-min)",
  md: "min-h-12 px-6 type-label-lg",
  lg: "min-h-14 px-8 type-label-lg",
};

const ICON_ONLY_SIZES: Record<ButtonSize, string> = {
  sm: "size-10 pointer-coarse:size-(--target-min)",
  md: "size-12",
  lg: "size-14",
};

interface ButtonStyleOptions {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  iconOnly?: boolean;
}

/** Shared by <button> and link-styled-as-button so both look identical. */
export function buttonStyles({
  variant = "primary",
  size = "md",
  fullWidth = false,
  iconOnly = false,
}: ButtonStyleOptions = {}): string {
  return cx(
    BASE,
    VARIANTS[variant],
    iconOnly ? ICON_ONLY_SIZES[size] : SIZES[size],
    fullWidth && "w-full",
  );
}
