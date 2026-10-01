import { Check } from "lucide-react";
import type { ComponentPropsWithRef, ReactNode } from "react";

import { cx } from "@/lib/utils/cx";

interface ChoiceProps extends Omit<ComponentPropsWithRef<"input">, "type"> {
  label: ReactNode;
}

/*
 * Selection is shown in the surface's primary ink (not brand red or green):
 * choosing an option is neither a call to action nor an operational status.
 * The whole row is the hit target (≥ 44px tall).
 */
const ROW =
  "group flex min-h-(--target-min) cursor-pointer items-start gap-3 py-2.5 has-disabled:cursor-not-allowed";
const BOX =
  "peer size-5 shrink-0 cursor-[inherit] appearance-none border border-border-strong bg-surface-field transition-ui " +
  "group-hover:border-border-interactive checked:border-text-primary checked:bg-text-primary " +
  "aria-invalid:border-danger-graphic " +
  "disabled:border-border-default disabled:bg-transparent disabled:checked:bg-text-disabled";
const LABEL = "type-body-md text-text-primary group-has-disabled:text-text-disabled";

export function Checkbox({ label, className, ...props }: ChoiceProps) {
  return (
    <label className={cx(ROW, className)}>
      <span className="relative mt-0.5 flex">
        <input type="checkbox" className={cx(BOX, "rounded-sm")} {...props} />
        <Check
          aria-hidden
          size={14}
          strokeWidth={2.5}
          absoluteStrokeWidth
          className="pointer-events-none absolute top-[3px] left-[3px] text-text-inverse opacity-0 peer-checked:opacity-100"
        />
      </span>
      <span className={LABEL}>{label}</span>
    </label>
  );
}

export function Radio({ label, className, ...props }: ChoiceProps) {
  return (
    <label className={cx(ROW, className)}>
      <span className="relative mt-0.5 flex">
        <input type="radio" className={cx(BOX, "rounded-full")} {...props} />
        <span
          aria-hidden
          className="pointer-events-none absolute top-1.5 left-1.5 size-2 rounded-full bg-text-inverse opacity-0 peer-checked:opacity-100"
        />
      </span>
      <span className={LABEL}>{label}</span>
    </label>
  );
}
