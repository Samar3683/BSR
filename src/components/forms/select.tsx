import { ChevronDown } from "lucide-react";
import type { ComponentPropsWithRef } from "react";

import { Icon } from "@/components/ui/icon";
import { cx } from "@/lib/utils/cx";

import { selectControlStyles } from "./control-styles";

/**
 * Native <select>: platform pickers on touch devices, full keyboard and
 * screen-reader support. Replace with a custom listbox only when a
 * requirement genuinely needs it.
 */
export function Select({
  className,
  controlClassName,
  children,
  ...props
}: ComponentPropsWithRef<"select"> & {
  /** Classes for the <select> itself (`className` styles the wrapper). */
  controlClassName?: string;
}) {
  return (
    <div className={cx("relative", className)}>
      <select className={cx(selectControlStyles, controlClassName)} {...props}>
        {children}
      </select>
      <Icon
        icon={ChevronDown}
        className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-text-secondary"
      />
    </div>
  );
}
