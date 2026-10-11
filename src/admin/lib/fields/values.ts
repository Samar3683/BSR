import { businessToInstant, instantToBusiness } from "../datetime";
import type { AddressValue, EntityRecord, FieldDefinition, FileValue } from "./types";

/**
 * Form state ↔ stored values. Inputs work with strings and small objects;
 * the API stores typed JSON (numbers, ISO instants, option ids, …).
 */

export interface DateTimeParts {
  date: string;
  time: string;
}

export type FormValue =
  string | string[] | boolean | null | DateTimeParts | AddressValue | FileValue;

/** The stored value of a field on a record (bound column or attribute). */
export function recordValue(
  def: FieldDefinition,
  record: EntityRecord | null | undefined,
): unknown {
  if (!record) return null;
  if (def.binding_key) return record[def.binding_key] ?? null;
  return record.attributes?.[def.field_key] ?? null;
}

export function emptyFormValue(def: FieldDefinition): FormValue {
  switch (def.field_type) {
    case "multi_select":
      return [];
    case "datetime":
      return { date: "", time: "" };
    case "address":
      return {};
    case "boolean":
    case "image":
    case "file":
      return null;
    default:
      return "";
  }
}

export function toFormValue(def: FieldDefinition, stored: unknown): FormValue {
  if (stored === null || stored === undefined) return emptyFormValue(def);
  switch (def.field_type) {
    case "integer":
    case "decimal":
    case "currency":
    case "percentage":
      return typeof stored === "number" ? String(stored) : String(stored ?? "");
    case "datetime":
      return typeof stored === "string" && stored
        ? instantToBusiness(stored)
        : { date: "", time: "" };
    case "boolean":
      return typeof stored === "boolean" ? stored : null;
    case "multi_select":
      return Array.isArray(stored) ? stored.map(String) : [];
    case "address":
      return typeof stored === "object" ? { ...(stored as AddressValue) } : {};
    case "image":
    case "file":
      return typeof stored === "object" ? (stored as FileValue) : null;
    default:
      return String(stored);
  }
}

/** Form state → the value sent to the API (null = empty). */
export function fromFormValue(def: FieldDefinition, value: FormValue | undefined): unknown {
  if (value === undefined || value === null) return null;
  switch (def.field_type) {
    case "datetime": {
      const parts = value as DateTimeParts;
      if (!parts.date && !parts.time) return null;
      if (!parts.date || !parts.time) return "incomplete";
      return businessToInstant(parts.date, parts.time).toISOString();
    }
    case "integer":
    case "decimal":
    case "currency":
    case "percentage": {
      const text = String(value).trim().replace(/\s/g, "");
      return text === "" ? null : text;
    }
    case "multi_select":
      return Array.isArray(value) && value.length ? value : null;
    case "address": {
      const address = value as AddressValue;
      const cleaned: AddressValue = {};
      for (const [part, text] of Object.entries(address)) {
        if (typeof text === "string" && text.trim())
          cleaned[part as keyof AddressValue] = text.trim();
      }
      return Object.keys(cleaned).length ? cleaned : null;
    }
    case "boolean":
      return typeof value === "boolean" ? value : null;
    case "image":
    case "file":
      return value;
    default: {
      const text = String(value);
      return text.trim() === "" ? null : text;
    }
  }
}

export function initialFormValues(
  fields: readonly FieldDefinition[],
  record: EntityRecord | null,
): Record<string, FormValue> {
  const values: Record<string, FormValue> = {};
  for (const def of fields) {
    const stored = record ? recordValue(def, record) : def.default_value;
    values[def.field_key] = toFormValue(def, stored ?? null);
  }
  return values;
}

/**
 * Splits validated values into the record's bound columns and its
 * attributes. Every field of the form is sent (null clears it), so the
 * database's patch semantics leave fields outside the form untouched.
 */
export function buildRecordPayload(
  fields: readonly FieldDefinition[],
  values: Record<string, unknown>,
): { columns: Record<string, unknown>; attributes: Record<string, unknown> } {
  const columns: Record<string, unknown> = {};
  const attributes: Record<string, unknown> = {};
  for (const def of fields) {
    if (!(def.field_key in values)) continue;
    const value = values[def.field_key] ?? null;
    if (def.binding_key) columns[def.binding_key] = value;
    else attributes[def.field_key] = value;
  }
  return { columns, attributes };
}
