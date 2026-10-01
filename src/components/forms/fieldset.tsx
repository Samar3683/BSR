import type { ReactNode } from "react";

import { cx } from "@/lib/utils/cx";

import { FieldMessage, RequiredMark } from "./field";

interface FieldsetProps {
  id: string;
  legend: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  required?: boolean;
  requiredLabel?: string;
  className?: string;
  children: ReactNode;
}

/** Groups related choices (radio sets, checkbox lists) under one question. */
export function Fieldset({
  id,
  legend,
  hint,
  error,
  required = false,
  requiredLabel,
  className,
  children,
}: FieldsetProps) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-message` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <fieldset
      id={id}
      aria-describedby={describedBy}
      className={cx("flex flex-col gap-2", className)}
    >
      <legend className="mb-2 type-label-md text-text-primary">
        {legend}
        {required && <RequiredMark label={requiredLabel} />}
      </legend>
      {hint && (
        <p id={hintId} className="type-body-sm text-text-muted">
          {hint}
        </p>
      )}
      <div className="flex flex-col">{children}</div>
      {errorId && (
        <FieldMessage id={errorId} tone="error">
          {error}
        </FieldMessage>
      )}
    </fieldset>
  );
}
