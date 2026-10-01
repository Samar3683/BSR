import type { ComponentPropsWithRef } from "react";

import { cx } from "@/lib/utils/cx";

import { textControlStyles } from "./control-styles";

/** Single-line text entry. Choose the most specific `type`/`inputMode`/`autoComplete`. */
export function TextInput({ type = "text", className, ...props }: ComponentPropsWithRef<"input">) {
  return <input type={type} className={cx(textControlStyles, className)} {...props} />;
}

export function TextArea({ className, rows = 4, ...props }: ComponentPropsWithRef<"textarea">) {
  return (
    <textarea
      rows={rows}
      className={cx(textControlStyles, "min-h-32 resize-y", className)}
      {...props}
    />
  );
}
