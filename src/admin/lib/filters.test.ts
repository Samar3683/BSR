import { describe, expect, it } from "vitest";

import type { FieldDefinition, FieldType } from "./fields/types";
import { toApiFilters, type UiFilter } from "./filters";

const field = (field_key: string, field_type: FieldType) =>
  ({ field_key, field_type }) as FieldDefinition;
const fields = [
  field("pickup_at", "datetime"),
  field("payload_kg", "integer"),
  field("refrigerated", "boolean"),
  field("vehicle_type", "single_select"),
];
const f = (field: string, op: UiFilter["op"], value?: unknown): UiFilter => ({
  id: field,
  field,
  op,
  value,
});

describe("toApiFilters", () => {
  it("skips incomplete rows and unknown fields", () => {
    expect(
      toApiFilters(
        [f("payload_kg", "gte", ""), f("missing", "eq", "x"), f("vehicle_type", "in", [])],
        fields,
      ),
    ).toEqual([]);
  });

  it("passes value-less operators through", () => {
    expect(toApiFilters([f("payload_kg", "is_empty")], fields)).toEqual([
      { field: "payload_kg", op: "is_empty" },
    ]);
  });

  it("turns days of date-time filters into Europe/Rome instants", () => {
    expect(toApiFilters([f("pickup_at", "eq", "2026-07-15")], fields)).toEqual([
      {
        field: "pickup_at",
        op: "between",
        value: ["2026-07-14T22:00:00.000Z", "2026-07-15T21:59:59.999Z"],
      },
    ]);
    expect(toApiFilters([f("pickup_at", "gte", "2026-01-15")], fields)).toEqual([
      { field: "pickup_at", op: "gte", value: "2026-01-14T23:00:00.000Z" },
    ]);
  });

  it("converts boolean choices", () => {
    expect(toApiFilters([f("refrigerated", "eq", "false")], fields)).toEqual([
      { field: "refrigerated", op: "eq", value: false },
    ]);
  });
});
