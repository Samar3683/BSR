"use client";

import { CircleAlert } from "lucide-react";
import {
  cloneElement,
  isValidElement,
  useId,
  type InputHTMLAttributes,
  type ReactElement,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";

interface FieldProps {
  label: ReactNode;
  help?: ReactNode;
  error?: string | null;
  required?: boolean;
  wide?: boolean;
  className?: string;
  /** A single control; it receives id / aria-describedby / aria-invalid. */
  children: ReactElement<Record<string, unknown>>;
  /** Render the label as a legend-like heading for composite controls. */
  composite?: boolean;
}

/** Label, help text and error message wired to one control. */
export function Field({
  label,
  help,
  error,
  required,
  wide,
  className,
  children,
  composite,
}: FieldProps) {
  const id = useId();
  const helpId = help ? `${id}-help` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [helpId, errorId].filter(Boolean).join(" ") || undefined;
  const control = isValidElement(children)
    ? cloneElement(children, {
        id: (children.props.id as string | undefined) ?? id,
        "aria-describedby": describedBy,
        "aria-invalid": error ? true : undefined,
        "aria-required": required || undefined,
      })
    : children;

  return (
    <div className={["a-field", wide && "a-field--wide", className].filter(Boolean).join(" ")}>
      {composite ? (
        <span className="a-label" id={`${id}-label`}>
          {label}
          {required ? <RequiredMark /> : null}
        </span>
      ) : (
        <label className="a-label" htmlFor={(children.props.id as string | undefined) ?? id}>
          {label}
          {required ? <RequiredMark /> : null}
        </label>
      )}
      {control}
      {help ? (
        <p className="a-help" id={helpId}>
          {help}
        </p>
      ) : null}
      {error ? (
        <p className="a-error-text" id={errorId} role="alert">
          <CircleAlert size={14} aria-hidden="true" />
          {error}
        </p>
      ) : null}
    </div>
  );
}

function RequiredMark() {
  return (
    <span className="a-required" aria-hidden="true" title="Required">
      *
    </span>
  );
}

export function Input({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={["a-input", className].filter(Boolean).join(" ")} {...rest} />;
}

export function Textarea({ className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={["a-textarea", className].filter(Boolean).join(" ")} {...rest} />;
}

export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={["a-select", className].filter(Boolean).join(" ")} {...rest}>
      {children}
    </select>
  );
}

interface ToggleProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "onChange"> {
  label: ReactNode;
  checked: boolean;
  onChange: (checked: boolean) => void;
  description?: ReactNode;
}

export function Switch({ label, checked, onChange, description, className, ...rest }: ToggleProps) {
  return (
    <label className={["a-switch", className].filter(Boolean).join(" ")}>
      <input
        type="checkbox"
        role="switch"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        {...rest}
      />
      <span>
        {label}
        {description ? (
          <span className="a-help" style={{ display: "block" }}>
            {description}
          </span>
        ) : null}
      </span>
    </label>
  );
}

export function Checkbox({ label, checked, onChange, className, ...rest }: ToggleProps) {
  return (
    <label className={["a-check", className].filter(Boolean).join(" ")}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        {...rest}
      />
      <span>{label}</span>
    </label>
  );
}

interface SegmentedProps<T extends string> {
  label: string;
  value: T;
  options: readonly { value: T; label: ReactNode }[];
  onChange: (value: T) => void;
}

export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: SegmentedProps<T>) {
  return (
    <div className="a-segmented" role="group" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={option.value === value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
