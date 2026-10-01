import { ArrowRight } from "lucide-react";
import Link from "next/link";
import type { ComponentPropsWithRef } from "react";

import { cx } from "@/lib/utils/cx";

import { Icon } from "./icon";

export type TextLinkVariant = "inline" | "utility" | "action";

/*
 * Link rules — interactivity is never signalled by hover alone.
 * - inline: inside running text; always underlined.
 * - utility: navigation/secondary links, recognisable by placement and label
 *   style; the current page (aria-current) is marked by a red underline plus
 *   full-strength text, not colour alone.
 * - action: standalone directional link; label weight plus an arrow.
 */
const VARIANTS: Record<TextLinkVariant, string> = {
  inline:
    "text-text-primary underline decoration-border-strong decoration-1 underline-offset-[0.22em] transition-ui hover:decoration-current hover:decoration-2",
  utility:
    "inline-flex min-h-(--target-min) items-center type-label-md text-text-secondary transition-ui hover:text-text-primary " +
    "decoration-action-primary decoration-2 underline-offset-[0.45em] aria-[current=page]:text-text-primary aria-[current=page]:underline",
  action:
    "group/link inline-flex min-h-(--target-min) items-center gap-2 type-label-lg text-text-primary " +
    "decoration-1 underline-offset-[0.3em] transition-ui hover:underline",
};

interface TextLinkProps extends ComponentPropsWithRef<typeof Link> {
  variant?: TextLinkVariant;
}

export function TextLink({ variant = "inline", className, children, ...props }: TextLinkProps) {
  return (
    <Link className={cx(VARIANTS[variant], className)} {...props}>
      {children}
      {variant === "action" && (
        <Icon
          icon={ArrowRight}
          size="sm"
          className="transition-ui motion-safe:group-hover/link:translate-x-0.5"
        />
      )}
    </Link>
  );
}
