import { formatCalendarDate, formatDateTime } from "../datetime";
import type { AddressValue, FieldDefinition, FieldOption, FileValue } from "./types";
import { ADDRESS_PARTS } from "./types";

const LOCALE = "en-GB";

export interface FormatContext {
  optionsByField: Readonly<Record<string, readonly FieldOption[]>>;
  /** Display names of related records, by id. */
  relationNames?: Readonly<Record<string, string>>;
}

export function formatNumber(value: number, fractionDigits?: number): string {
  return new Intl.NumberFormat(LOCALE, {
    maximumFractionDigits: fractionDigits ?? 6,
  }).format(value);
}

export function formatCurrency(value: number, currency = "EUR", precision = 2): string {
  try {
    return new Intl.NumberFormat(LOCALE, {
      style: "currency",
      currency,
      minimumFractionDigits: Math.min(precision, 2),
      maximumFractionDigits: precision,
    }).format(value);
  } catch {
    return `${formatNumber(value, precision)} ${currency}`;
  }
}

export function formatAddress(value: AddressValue | null | undefined): string {
  if (!value) return "";
  return ADDRESS_PARTS.map((part) => value[part])
    .filter((part): part is string => Boolean(part))
    .join(", ");
}

export function formatFileSize(bytes: number | null | undefined): string {
  if (!bytes && bytes !== 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function optionLabel(options: readonly FieldOption[] | undefined, id: unknown): string {
  if (typeof id !== "string") return "";
  return options?.find((o) => o.id === id)?.label ?? "Unknown option";
}

/** Plain-text rendering of a stored value (tables, CSV, summaries). */
export function formatFieldValue(def: FieldDefinition, value: unknown, ctx: FormatContext): string {
  if (value === null || value === undefined || value === "") return "";
  const rules = def.validation_rules ?? {};
  switch (def.field_type) {
    case "integer":
      return typeof value === "number" ? formatNumber(value, 0) : String(value);
    case "decimal":
      return typeof value === "number" ? formatNumber(value, rules.precision ?? 4) : String(value);
    case "currency":
      return typeof value === "number"
        ? formatCurrency(value, rules.currency ?? "EUR", rules.precision ?? 2)
        : String(value);
    case "percentage":
      return typeof value === "number"
        ? `${formatNumber(value, rules.precision ?? 2)}%`
        : String(value);
    case "date":
      return formatCalendarDate(String(value));
    case "datetime":
      return formatDateTime(String(value));
    case "boolean":
      return value === true ? "Yes" : value === false ? "No" : "";
    case "single_select":
      return optionLabel(ctx.optionsByField[def.id], value);
    case "multi_select":
      return Array.isArray(value)
        ? value.map((id) => optionLabel(ctx.optionsByField[def.id], id)).join(", ")
        : "";
    case "relation":
      return typeof value === "string" ? (ctx.relationNames?.[value] ?? "") : "";
    case "address":
      return formatAddress(value as AddressValue);
    case "image":
    case "file":
      return (value as FileValue).name ?? "";
    default:
      return String(value);
  }
}
