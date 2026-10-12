"use client";

import { CircleAlert } from "lucide-react";
import { useId, useState, type ReactNode } from "react";

import type {
  AddressPart,
  AddressValue,
  FieldDefinition,
  FieldOption,
  FileValue,
} from "../../lib/fields/types";
import type { DateTimeParts, FormValue } from "../../lib/fields/values";
import { Checkbox, Field, Input, Select, Textarea } from "../ui/form";
import { FileInput } from "./file-input";
import { QuickCreateDialog } from "./quick-create";
import { RelationPicker } from "./relation-picker";

const ADDRESS_LABELS: Record<AddressPart, string> = {
  line1: "Street and number",
  line2: "Additional line",
  postal_code: "Postal code",
  city: "City",
  province: "Province",
  country: "Country",
};

/** Field types that take the full form width. */
export function isWideField(def: FieldDefinition): boolean {
  return ["long_text", "address", "multi_select", "image", "file"].includes(def.field_type);
}

interface FieldControlProps {
  def: FieldDefinition;
  value: FormValue;
  onChange: (value: FormValue) => void;
  /** All options of the field, archived included. */
  options?: readonly FieldOption[];
  /** The stored value: an archived option it uses stays visible. */
  storedValue?: unknown;
  error?: string;
  disabled?: boolean;
}

/** One configured field rendered as a labelled form control. */
export function FieldControl({
  def,
  value,
  onChange,
  options = [],
  storedValue,
  error,
  disabled,
}: FieldControlProps) {
  const rules = def.validation_rules ?? {};
  const help = def.help_text ?? undefined;
  const placeholder = def.placeholder ?? undefined;
  const common = { label: def.label, help, error, required: def.required, wide: isWideField(def) };

  const selectable = (option: FieldOption) =>
    !option.archived_at ||
    storedValue === option.id ||
    (Array.isArray(storedValue) && storedValue.includes(option.id));

  switch (def.field_type) {
    case "long_text":
      return (
        <Field {...common}>
          <Textarea
            value={(value as string) ?? ""}
            onChange={(e) => onChange(e.target.value)}
            maxLength={rules.max_length}
            placeholder={placeholder}
            disabled={disabled}
            rows={4}
          />
        </Field>
      );
    case "integer":
    case "decimal":
    case "currency":
    case "percentage": {
      const addon =
        def.field_type === "currency"
          ? (rules.currency ?? "EUR")
          : def.field_type === "percentage"
            ? "%"
            : null;
      const input = (
        <Input
          type="text"
          inputMode={def.field_type === "integer" ? "numeric" : "decimal"}
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value.replace(",", "."))}
          placeholder={placeholder}
          disabled={disabled}
        />
      );
      return addon ? (
        <Composite {...common}>
          {(ids) => (
            <div className="a-input-group">
              <Input
                id={ids.control}
                type="text"
                inputMode="decimal"
                value={(value as string) ?? ""}
                onChange={(e) => onChange(e.target.value.replace(",", "."))}
                placeholder={placeholder}
                disabled={disabled}
                aria-labelledby={ids.label}
                aria-describedby={ids.describedBy}
                aria-invalid={error ? true : undefined}
              />
              <span className="a-input-addon">{addon}</span>
            </div>
          )}
        </Composite>
      ) : (
        <Field {...common}>{input}</Field>
      );
    }
    case "date":
      return (
        <Field {...common}>
          <Input
            type="date"
            value={(value as string) ?? ""}
            min={rules.min_date}
            max={rules.max_date}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
          />
        </Field>
      );
    case "time":
      return (
        <Field {...common}>
          <Input
            type="time"
            value={(value as string) ?? ""}
            min={rules.min_time}
            max={rules.max_time}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
          />
        </Field>
      );
    case "datetime": {
      const parts = (value as DateTimeParts) ?? { date: "", time: "" };
      return (
        <Composite {...common} help={help ?? "Europe/Rome time"}>
          {(ids) => (
            <div
              className="a-input-pair"
              role="group"
              aria-labelledby={ids.label}
              aria-describedby={ids.describedBy}
            >
              <Input
                id={ids.control}
                type="date"
                aria-label={`${def.label} date`}
                value={parts.date}
                min={rules.min_date}
                max={rules.max_date}
                onChange={(e) => onChange({ ...parts, date: e.target.value })}
                disabled={disabled}
                aria-invalid={error ? true : undefined}
              />
              <Input
                type="time"
                step={900}
                aria-label={`${def.label} time`}
                value={parts.time}
                onChange={(e) => onChange({ ...parts, time: e.target.value })}
                disabled={disabled}
                aria-invalid={error ? true : undefined}
              />
            </div>
          )}
        </Composite>
      );
    }
    case "email":
    case "phone":
    case "url":
      return (
        <Field {...common}>
          <Input
            type={def.field_type === "phone" ? "tel" : def.field_type}
            inputMode={
              def.field_type === "phone" ? "tel" : def.field_type === "email" ? "email" : "url"
            }
            autoComplete="off"
            value={(value as string) ?? ""}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder ?? (def.field_type === "url" ? "https://" : undefined)}
            disabled={disabled}
          />
        </Field>
      );
    case "boolean":
      return (
        <Field {...common}>
          <Select
            value={value === true ? "true" : value === false ? "false" : ""}
            onChange={(e) => onChange(e.target.value === "" ? null : e.target.value === "true")}
            disabled={disabled}
          >
            <option value="">—</option>
            <option value="true">Yes</option>
            <option value="false">No</option>
          </Select>
        </Field>
      );
    case "single_select":
      return (
        <Field {...common}>
          <Select
            value={(value as string) ?? ""}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
          >
            <option value="">{placeholder ?? "Select…"}</option>
            {options.filter(selectable).map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
                {option.archived_at ? " (archived)" : ""}
              </option>
            ))}
          </Select>
        </Field>
      );
    case "multi_select": {
      const selected = Array.isArray(value) ? (value as string[]) : [];
      const visible = options.filter(selectable);
      return (
        <Composite {...common}>
          {(ids) => (
            <div
              className="a-option-list"
              role="group"
              aria-labelledby={ids.label}
              aria-describedby={ids.describedBy}
              id={ids.control}
            >
              {visible.length === 0 ? (
                <span className="a-muted a-small">No options configured yet.</span>
              ) : null}
              {visible.map((option) => (
                <Checkbox
                  key={option.id}
                  label={`${option.label}${option.archived_at ? " (archived)" : ""}`}
                  checked={selected.includes(option.id)}
                  disabled={disabled}
                  onChange={(checked) =>
                    onChange(
                      checked
                        ? [...selected, option.id]
                        : selected.filter((id) => id !== option.id),
                    )
                  }
                />
              ))}
            </div>
          )}
        </Composite>
      );
    }
    case "relation":
      return (
        <Field {...common}>
          <RelationControl
            entity={def.relation_entity!}
            value={(value as string) || null}
            onChange={(id) => onChange(id ?? "")}
            placeholder={placeholder}
            disabled={disabled}
          />
        </Field>
      );
    case "address":
      return (
        <AddressControl
          {...common}
          def={def}
          value={value}
          onChange={onChange}
          disabled={disabled}
        />
      );
    case "image":
    case "file":
      return (
        <Field {...common}>
          <FileInput
            def={def}
            value={(value as FileValue) ?? null}
            onChange={onChange}
            disabled={disabled}
          />
        </Field>
      );
    default:
      return (
        <Field {...common}>
          <Input
            type="text"
            value={(value as string) ?? ""}
            onChange={(e) => onChange(e.target.value)}
            maxLength={rules.max_length}
            placeholder={placeholder}
            disabled={disabled}
            autoComplete="off"
          />
        </Field>
      );
  }
}

/** Label + help + error for controls made of several inputs. */
function Composite({
  label,
  help,
  error,
  required,
  wide,
  children,
}: {
  label: string;
  help?: string;
  error?: string;
  required?: boolean;
  wide?: boolean;
  children: (ids: { label: string; control: string; describedBy?: string }) => ReactNode;
}) {
  const id = useId();
  const helpId = help ? `${id}-help` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [helpId, errorId].filter(Boolean).join(" ") || undefined;
  return (
    <div className={["a-field", wide && "a-field--wide"].filter(Boolean).join(" ")}>
      <label className="a-label" id={`${id}-label`} htmlFor={`${id}-control`}>
        {label}
        {required ? (
          <span className="a-required" aria-hidden="true">
            *
          </span>
        ) : null}
      </label>
      {children({ label: `${id}-label`, control: `${id}-control`, describedBy })}
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

/** Relation picker with a "Create new…" dialog for the entity. */
function RelationControl({
  entity,
  value,
  onChange,
  placeholder,
  disabled,
  ...aria
}: {
  entity: NonNullable<FieldDefinition["relation_entity"]>;
  value: string | null;
  onChange: (id: string | null) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  const [creating, setCreating] = useState<string | null>(null);
  return (
    <>
      <RelationPicker
        entity={entity}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        disabled={disabled}
        onCreate={entity === "customer" ? (term) => setCreating(term) : undefined}
        {...aria}
      />
      {creating !== null ? (
        <QuickCreateDialog
          entity={entity}
          term={creating}
          onClose={() => setCreating(null)}
          onCreated={(id) => {
            setCreating(null);
            onChange(id);
          }}
        />
      ) : null}
    </>
  );
}

const PRIMARY_PARTS: AddressPart[] = ["line1", "postal_code", "city"];
const MORE_PARTS: AddressPart[] = ["line2", "province", "country"];

/** Street, postcode and city up front; the rest behind "More". */
function AddressControl({
  def,
  value,
  onChange,
  error,
  disabled,
  ...common
}: {
  def: FieldDefinition;
  value: FormValue;
  onChange: (value: FormValue) => void;
  error?: string;
  disabled?: boolean;
  label: string;
  help?: string;
  required?: boolean;
  wide?: boolean;
}) {
  const address = (value as AddressValue) ?? {};
  const required = def.validation_rules?.required_parts ?? ["line1", "city"];
  const hasMore = MORE_PARTS.some((part) => {
    if (part === "country" && address.country === DEFAULT_COUNTRY) return false;
    return Boolean(address[part]);
  });
  const [expanded, setExpanded] = useState(false);
  const showMore = expanded || hasMore || MORE_PARTS.some((p) => required.includes(p));
  const parts = showMore ? [...PRIMARY_PARTS, ...MORE_PARTS] : PRIMARY_PARTS;
  return (
    <Composite {...common} error={error}>
      {(ids) => (
        <div
          className="a-address-grid"
          role="group"
          aria-labelledby={ids.label}
          aria-describedby={ids.describedBy}
        >
          {parts.map((part, index) => (
            <label
              key={part}
              className={[
                "a-address-field",
                (part === "line1" || part === "line2") && "a-address-wide",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              <span>
                {ADDRESS_LABELS[part]}
                {required.includes(part) ? (
                  <span className="a-required" aria-hidden="true">
                    {" "}
                    *
                  </span>
                ) : null}
              </span>
              <Input
                id={index === 0 ? ids.control : undefined}
                aria-label={`${def.label}: ${ADDRESS_LABELS[part]}${required.includes(part) ? " (required)" : ""}`}
                value={address[part] ?? ""}
                onChange={(e) => onChange({ ...address, [part]: e.target.value })}
                disabled={disabled}
                aria-invalid={error ? true : undefined}
                autoComplete="off"
              />
            </label>
          ))}
          {!showMore ? (
            <button
              type="button"
              className="a-cal-more a-address-more"
              onClick={() => setExpanded(true)}
            >
              More (additional line, province, country)
            </button>
          ) : null}
        </div>
      )}
    </Composite>
  );
}

/** Pre-filled in new address fields; dropped again when nothing else is typed. */
export const DEFAULT_COUNTRY = "Italia";
