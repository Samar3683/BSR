import { LoaderCircle, type LucideIcon } from "lucide-react";
import Link from "next/link";
import type { ComponentPropsWithRef, ReactNode } from "react";

import { uiCopy } from "@/config/ui-copy";
import { cx } from "@/lib/utils/cx";

import { type ButtonSize, type ButtonVariant, buttonStyles } from "./button-styles";
import { Icon } from "./icon";

interface ButtonContentProps {
  leadingIcon?: LucideIcon;
  trailingIcon?: LucideIcon;
  children: ReactNode;
}

// A trailing icon (typically an arrow) nudges forward on hover — the only
// decorative motion a button has, and it is dropped under reduced motion.
function ButtonContent({ leadingIcon, trailingIcon, children }: ButtonContentProps) {
  return (
    <>
      {leadingIcon && <Icon icon={leadingIcon} />}
      <span>{children}</span>
      {trailingIcon && (
        <Icon
          icon={trailingIcon}
          className="transition-ui motion-safe:group-hover/button:translate-x-0.5"
        />
      )}
    </>
  );
}

interface ButtonProps
  extends ComponentPropsWithRef<"button">, Omit<ButtonContentProps, "children"> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  /**
   * Busy state. The button keeps focus and its label; it is announced as
   * busy and ignores pointer presses. Callers must also ignore submissions
   * while loading (keyboard activation is not blocked).
   */
  loading?: boolean;
  loadingLabel?: string;
}

export function Button({
  variant,
  size,
  fullWidth,
  loading = false,
  loadingLabel = uiCopy.loading,
  leadingIcon,
  trailingIcon,
  type = "button",
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      aria-busy={loading || undefined}
      className={cx(buttonStyles({ variant, size, fullWidth }), className)}
      {...props}
    >
      <ButtonContent
        leadingIcon={loading ? undefined : leadingIcon}
        trailingIcon={loading ? undefined : trailingIcon}
      >
        {children}
      </ButtonContent>
      {loading && (
        <>
          <Icon icon={LoaderCircle} className="motion-safe:animate-spin" />
          <span className="sr-only">{loadingLabel}</span>
        </>
      )}
    </button>
  );
}

interface ButtonLinkProps
  extends ComponentPropsWithRef<typeof Link>, Omit<ButtonContentProps, "children"> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  children: ReactNode;
}

/** Navigation that should look like an action (e.g. a CTA to another page). */
export function ButtonLink({
  variant,
  size,
  fullWidth,
  leadingIcon,
  trailingIcon,
  className,
  children,
  ...props
}: ButtonLinkProps) {
  return (
    <Link className={cx(buttonStyles({ variant, size, fullWidth }), className)} {...props}>
      <ButtonContent leadingIcon={leadingIcon} trailingIcon={trailingIcon}>
        {children}
      </ButtonContent>
    </Link>
  );
}

interface IconButtonProps extends Omit<ComponentPropsWithRef<"button">, "children"> {
  icon: LucideIcon;
  /** Required accessible name — icon-only controls have no visible text. */
  label: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export function IconButton({
  icon,
  label,
  variant = "secondary",
  size,
  type = "button",
  className,
  ...props
}: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      className={cx(buttonStyles({ variant, size, iconOnly: true }), className)}
      {...props}
    >
      <Icon icon={icon} />
    </button>
  );
}
