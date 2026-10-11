"use client";

import { Checkbox, Field, Input, Select } from "../../components/ui/form";
import { DEFAULT_FILE_TYPES, DEFAULT_IMAGE_TYPES, FIELD_TYPES } from "../../lib/fields/registry";
import {
  ADDRESS_PARTS,
  type AddressPart,
  type FieldType,
  type RuleKey,
  type ValidationRules,
} from "../../lib/fields/types";

const RULE_LABELS: Record<RuleKey, string> = {
  min_length: "Minimum length",
  max_length: "Maximum length",
  pattern: "Pattern (regular expression)",
  pattern_message: "Message when the pattern does not match",
  min: "Minimum",
  max: "Maximum",
  precision: "Decimal places",
  currency: "Currency",
  min_date: "Earliest date",
  max_date: "Latest date",
  min_time: "Earliest time",
  max_time: "Latest time",
  min_items: "Minimum selections",
  max_items: "Maximum selections",
  required_parts: "Required address parts",
  max_size_mb: "Maximum size (MB)",
  allowed_types: "Allowed file types",
};

const PART_LABELS: Record<AddressPart, string> = {
  line1: "Street",
  line2: "Additional line",
  postal_code: "Postal code",
  city: "City",
  province: "Province",
  country: "Country",
};

const TYPE_LABELS: Record<string, string> = {
  "image/jpeg": "JPEG",
  "image/png": "PNG",
  "image/webp": "WebP",
  "image/gif": "GIF",
  "application/pdf": "PDF",
  "text/plain": "Text",
  "text/csv": "CSV",
  "application/msword": "Word (.doc)",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "Word (.docx)",
  "application/vnd.ms-excel": "Excel (.xls)",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "Excel (.xlsx)",
};

const NUMBER_RULES: readonly RuleKey[] = [
  "min_length",
  "max_length",
  "min",
  "max",
  "precision",
  "min_items",
  "max_items",
  "max_size_mb",
];
const DATE_RULES: readonly RuleKey[] = ["min_date", "max_date"];
const TIME_RULES: readonly RuleKey[] = ["min_time", "max_time"];

/** Type-specific validation settings (only the rules the server accepts for the type). */
export function RulesEditor({
  type,
  rules,
  onChange,
  error,
}: {
  type: FieldType;
  rules: ValidationRules;
  onChange: (rules: ValidationRules) => void;
  error?: string;
}) {
  const keys = FIELD_TYPES[type].rules;
  const set = (key: RuleKey, value: unknown) => {
    const next = { ...rules } as Record<string, unknown>;
    if (
      value === "" ||
      value === null ||
      value === undefined ||
      (Array.isArray(value) && value.length === 0)
    )
      delete next[key];
    else next[key] = value;
    onChange(next as ValidationRules);
  };

  if (!keys.length) {
    return <p className="a-muted a-small">This type has no extra validation settings.</p>;
  }

  return (
    <div className="a-stack" style={{ gap: 12 }}>
      <div className="a-form-grid">
        {keys.map((key) => {
          const value = (rules as Record<string, unknown>)[key];
          if (NUMBER_RULES.includes(key)) {
            return (
              <Field key={key} label={RULE_LABELS[key]}>
                <Input
                  type="number"
                  step={key === "max_size_mb" || key === "min" || key === "max" ? "any" : 1}
                  value={value === undefined ? "" : String(value)}
                  onChange={(e) => set(key, e.target.value === "" ? "" : Number(e.target.value))}
                />
              </Field>
            );
          }
          if (DATE_RULES.includes(key)) {
            return (
              <Field key={key} label={RULE_LABELS[key]}>
                <Input
                  type="date"
                  value={(value as string) ?? ""}
                  onChange={(e) => set(key, e.target.value)}
                />
              </Field>
            );
          }
          if (TIME_RULES.includes(key)) {
            return (
              <Field key={key} label={RULE_LABELS[key]}>
                <Input
                  type="time"
                  value={(value as string) ?? ""}
                  onChange={(e) => set(key, e.target.value)}
                />
              </Field>
            );
          }
          if (key === "currency") {
            return (
              <Field key={key} label={RULE_LABELS[key]} help="ISO code; defaults to EUR.">
                <Select
                  value={(value as string) ?? "EUR"}
                  onChange={(e) => set(key, e.target.value === "EUR" ? "" : e.target.value)}
                >
                  {["EUR", "CHF", "GBP", "USD", "PLN", "RON", "CZK", "HUF"].map((code) => (
                    <option key={code} value={code}>
                      {code}
                    </option>
                  ))}
                </Select>
              </Field>
            );
          }
          if (key === "pattern" || key === "pattern_message") {
            return (
              <Field
                key={key}
                label={RULE_LABELS[key]}
                wide
                help={
                  key === "pattern"
                    ? "PostgreSQL regular expression, e.g. ^[A-Z]{2}[0-9]{3}[A-Z]{2}$"
                    : undefined
                }
              >
                <Input
                  value={(value as string) ?? ""}
                  onChange={(e) => set(key, e.target.value)}
                  className={key === "pattern" ? "a-mono" : undefined}
                />
              </Field>
            );
          }
          if (key === "required_parts") {
            const parts = (value as AddressPart[] | undefined) ?? ["line1", "city"];
            return (
              <div key={key} className="a-field a-field--wide">
                <span className="a-label">{RULE_LABELS[key]}</span>
                <div className="a-chips">
                  {ADDRESS_PARTS.map((part) => (
                    <Checkbox
                      key={part}
                      label={PART_LABELS[part]}
                      checked={parts.includes(part)}
                      onChange={(checked) =>
                        set(key, checked ? [...parts, part] : parts.filter((p) => p !== part))
                      }
                    />
                  ))}
                </div>
              </div>
            );
          }
          if (key === "allowed_types") {
            const all = type === "image" ? DEFAULT_IMAGE_TYPES : DEFAULT_FILE_TYPES;
            const selected = (value as string[] | undefined) ?? all;
            return (
              <div key={key} className="a-field a-field--wide">
                <span className="a-label">{RULE_LABELS[key]}</span>
                <div className="a-chips">
                  {all.map((mime) => (
                    <Checkbox
                      key={mime}
                      label={TYPE_LABELS[mime] ?? mime}
                      checked={selected.includes(mime)}
                      onChange={(checked) => {
                        const next = checked
                          ? [...selected, mime]
                          : selected.filter((m) => m !== mime);
                        if (!next.length) return; // at least one type stays allowed
                        set(key, next.length === all.length ? "" : next);
                      }}
                    />
                  ))}
                </div>
              </div>
            );
          }
          return null;
        })}
      </div>
      {error ? (
        <p className="a-error-text" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
