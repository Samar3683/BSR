import { addDays, businessToInstant } from "./datetime";
import { FIELD_TYPES, type FilterOperator } from "./fields/registry";
import type { FieldDefinition } from "./fields/types";
import type { RecordFilter } from "../services/records";

/** A filter row of a list, as edited in the UI and kept in the URL. */
export interface UiFilter {
  id: string;
  field: string;
  op: FilterOperator;
  value: unknown;
}

export const NO_VALUE_OPERATORS: readonly FilterOperator[] = ["is_empty", "is_not_empty"];

export function defaultOperator(def: FieldDefinition): FilterOperator {
  return FIELD_TYPES[def.field_type].operators[0] ?? "is_not_empty";
}

function filled(value: unknown): boolean {
  if (value === null || value === undefined || value === "") return false;
  if (Array.isArray(value))
    return value.length > 0 && value.every((v) => v !== "" && v !== null && v !== undefined);
  return true;
}

/** UI filters → API filters (incomplete rows are skipped; days become Rome instants). */
export function toApiFilters(
  filters: readonly UiFilter[],
  fields: readonly FieldDefinition[],
): RecordFilter[] {
  const out: RecordFilter[] = [];
  for (const filter of filters) {
    const def = fields.find((f) => f.field_key === filter.field);
    if (!def) continue;
    if (NO_VALUE_OPERATORS.includes(filter.op)) {
      out.push({ field: filter.field, op: filter.op });
      continue;
    }
    if (!filled(filter.value)) continue;
    if (def.field_type === "datetime") {
      const start = (day: string) => businessToInstant(day).toISOString();
      const end = (day: string) =>
        new Date(businessToInstant(addDays(day, 1)).getTime() - 1).toISOString();
      const v = filter.value;
      if (filter.op === "between" && Array.isArray(v))
        out.push({ field: def.field_key, op: "between", value: [start(v[0]), end(v[1])] });
      else if (filter.op === "eq")
        out.push({
          field: def.field_key,
          op: "between",
          value: [start(String(v)), end(String(v))],
        });
      else if (filter.op === "gt")
        out.push({ field: def.field_key, op: "gt", value: end(String(v)) });
      else if (filter.op === "gte")
        out.push({ field: def.field_key, op: "gte", value: start(String(v)) });
      else if (filter.op === "lt")
        out.push({ field: def.field_key, op: "lt", value: start(String(v)) });
      else if (filter.op === "lte")
        out.push({ field: def.field_key, op: "lte", value: end(String(v)) });
      continue;
    }
    if (def.field_type === "boolean") {
      out.push({
        field: def.field_key,
        op: "eq",
        value: filter.value === "true" || filter.value === true,
      });
      continue;
    }
    out.push({ field: def.field_key, op: filter.op, value: filter.value });
  }
  return out;
}
