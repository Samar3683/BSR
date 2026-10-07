import { ArrowRight, type LucideIcon } from "lucide-react";
import Link from "next/link";
import type { ComponentPropsWithRef, ReactNode } from "react";

import { Icon } from "@/components/ui/icon";
import { cx } from "@/lib/utils/cx";

export type ActionVariant = "primary" | "outline" | "inverse" | "quiet";
export type ActionSize = "md" | "lg";

/*
 * The editorial action — a compact pill set in mono capitals, an arrow that
 * nudges forward on hover. Below the hero it replaces the large rectangular
 * buttons (the hero keeps its own; components/ui/button).
 *
 * - primary: BSR red — the request. One per view region.
 * - outline: a thin border on the surface — the alternative (WhatsApp, a call).
 * - inverse: solid soft white — the alternative over a photograph or Carbon.
 * - quiet: text and arrow only, with a hairline underline — a secondary link.
 * Green is never an action colour: it means route and state.
 *
 * Targets: md 44px, lg 48px (quiet 44px). Focus uses the global ring.
 */
const BASE =
  "group/action inline-flex shrink-0 cursor-pointer items-center justify-center gap-3 whitespace-nowrap ed-action select-none transition-[background-color,border-color,color] duration-200 ease-ui motion-reduce:transition-none";

const VARIANTS: Record<ActionVariant, string> = {
  primary:
    "rounded-full border border-transparent bg-action-primary text-on-action-primary hover:bg-action-primary-hover active:bg-action-primary-active",
  outline:
    "rounded-full border border-hairline-strong bg-transparent text-text-primary hover:border-border-interactive hover:bg-overlay-hover",
  inverse:
    "rounded-full border border-transparent bg-background-inverse text-text-inverse hover:bg-background-inverse-hover",
  quiet:
    "min-h-(--target-min) gap-2.5 border-b border-hairline-strong text-text-primary hover:border-success-graphic",
};

const SIZES: Record<ActionSize, string> = {
  md: "min-h-11 px-5",
  lg: "min-h-12 px-6",
};

export function actionStyles(variant: ActionVariant = "primary", size: ActionSize = "md") {
  return cx(BASE, VARIANTS[variant], variant !== "quiet" && SIZES[size]);
}

function ActionContent({
  icon = ArrowRight,
  leadingIcon,
  children,
}: {
  icon?: LucideIcon | null;
  leadingIcon?: LucideIcon;
  children: ReactNode;
}) {
  return (
    <>
      {leadingIcon && <Icon icon={leadingIcon} size="sm" />}
      <span>{children}</span>
      {icon && (
        <Icon
          icon={icon}
          size="sm"
          className="transition-transform duration-200 ease-ui motion-safe:group-hover/action:translate-x-0.5"
        />
      )}
    </>
  );
}

interface ActionLinkProps extends ComponentPropsWithRef<typeof Link> {
  variant?: ActionVariant;
  size?: ActionSize;
  /** Trailing icon; `null` for none. Defaults to an arrow. */
  icon?: LucideIcon | null;
  leadingIcon?: LucideIcon;
  children: ReactNode;
}

/** A link styled as an editorial action. */
export function ActionLink({
  variant,
  size,
  icon,
  leadingIcon,
  className,
  children,
  ...props
}: ActionLinkProps) {
  return (
    <Link className={cx(actionStyles(variant, size), className)} {...props}>
      <ActionContent icon={icon} leadingIcon={leadingIcon}>
        {children}
      </ActionContent>
    </Link>
  );
}

interface ActionButtonProps extends ComponentPropsWithRef<"button"> {
  variant?: ActionVariant;
  size?: ActionSize;
  icon?: LucideIcon | null;
  leadingIcon?: LucideIcon;
}

/** A button (form submission) styled as an editorial action. */
export function ActionButton({
  variant,
  size,
  icon,
  leadingIcon,
  type = "button",
  className,
  children,
  ...props
}: ActionButtonProps) {
  return (
    <button type={type} className={cx(actionStyles(variant, size), className)} {...props}>
      <ActionContent icon={icon} leadingIcon={leadingIcon}>
        {children}
      </ActionContent>
    </button>
  );
}
