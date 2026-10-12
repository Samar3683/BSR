"use client";

import Link from "next/link";
import { useTr } from "../../i18n/provider";
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";

export type ButtonVariant = "default" | "primary" | "danger" | "danger-ghost" | "ghost";

interface StyleProps {
  variant?: ButtonVariant;
  size?: "md" | "sm";
  icon?: boolean;
  block?: boolean;
}

export function buttonClass(
  { variant = "default", size = "md", icon, block }: StyleProps,
  extra?: string,
) {
  return [
    "a-btn",
    variant !== "default" && `a-btn--${variant}`,
    size === "sm" && "a-btn--sm",
    icon && "a-btn--icon",
    block && "a-btn--block",
    extra,
  ]
    .filter(Boolean)
    .join(" ");
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, StyleProps {
  loading?: boolean;
  children?: ReactNode;
}

export function Button({
  variant,
  size,
  icon,
  block,
  loading,
  className,
  children,
  disabled,
  type,
  ...rest
}: ButtonProps) {
  const tr = useTr();
  return (
    <button
      type={type ?? "button"}
      className={buttonClass({ variant, size, icon, block }, className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? <span className="a-spinner" aria-hidden="true" /> : null}
      {tr(children)}
    </button>
  );
}

interface ButtonLinkProps extends AnchorHTMLAttributes<HTMLAnchorElement>, StyleProps {
  href: string;
  children?: ReactNode;
}

export function ButtonLink({
  variant,
  size,
  icon,
  block,
  className,
  href,
  children,
  ...rest
}: ButtonLinkProps) {
  return (
    <Link href={href} className={buttonClass({ variant, size, icon, block }, className)} {...rest}>
      {children}
    </Link>
  );
}
