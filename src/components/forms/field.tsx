import { CircleAlert, CircleCheck } from "lucide-react";
import type { ReactNode } from "react";

import { Icon } from "@/components/ui/icon";
import { uiCopy } from "@/config/ui-copy";
import { cx } from "@/lib/utils/cx";

export interface FieldControlProps {
  id: string;
  required?: boolean;
  "aria-describedby"?: string;
  "aria-invalid"?: true;
  "data-state"?: "success";
}

interface FieldMessageProps {
  id: string;
  tone: "error" | "success";
  children: ReactNode;
}

export function FieldMessage({ id, tone, children }: FieldMessageProps) {
  return (
    <p
      id={id}
      className={cx(
        "flex items-start gap-2 type-body-sm",
        tone === "error" ? "text-danger" : "text-success",
      )}
    >
      <Icon icon={tone === "error" ? CircleAlert : CircleCheck} size="sm" className="mt-0.5" />
      <span>{children}</span>
    </p>
  );
}

export function RequiredMark({ label = uiCopy.required }: { label?: string }) {
  return <span className="font-normal text-text-muted"> ({label})</span>;
}

interface FieldProps {
  id: string;
  label: ReactNode;
  /** Format or purpose guidance, shown before the control. */
  hint?: ReactNode;
  error?: ReactNode;
  success?: ReactNode;
  required?: boolean;
  requiredLabel?: string;
  className?: string;
  /** Receives the id/ARIA wiring to spread onto the control. */
  children: (control: FieldControlProps) => ReactNode;
}

/**
 * Label, hint, control and validation message wired together: the label
 * names the control, hint and message are exposed via aria-describedby, and
 * errors set aria-invalid. Required fields are marked in text, not by an
 * asterisk alone.
 */
export function Field({
  id,
  label,
  hint,
  error,
  success,
  required = false,
  requiredLabel,
  className,
  children,
}: FieldProps) {
  const hintId = hint ? `${id}-hint` : undefined;
  const messageId = error || success ? `${id}-message` : undefined;
  const describedBy = [hintId, messageId].filter(Boolean).join(" ") || undefined;

  return (
    <div className={cx("flex flex-col gap-2", className)}>
      <label htmlFor={id} className="type-label-md text-text-primary">
        {label}
        {required && <RequiredMark label={requiredLabel} />}
      </label>
      {hint && (
        <p id={hintId} className="type-body-sm text-text-muted">
          {hint}
        </p>
      )}
      {children({
        id,
        required: required || undefined,
        "aria-describedby": describedBy,
        "aria-invalid": error ? true : undefined,
        "data-state": !error && success ? "success" : undefined,
      })}
      {messageId && (
        <FieldMessage id={messageId} tone={error ? "error" : "success"}>
          {error ?? success}
        </FieldMessage>
      )}
    </div>
  );
}
