import { describe, expect, it } from "vitest";

import { fieldKeyError, fieldKeyFromLabel } from "./keys";
import { FIELD_TYPES, isSafeTypeChange, supports } from "./registry";
import type { EntityRecord, FieldDefinition, FieldType } from "./types";
import {
  buildRecordPayload,
  fromFormValue,
  initialFormValues,
  recordValue,
  toFormValue,
} from "./values";

function def(field_type: FieldType, extra: Partial<FieldDefinition> = {}): FieldDefinition {
  return {
    id: "f",
    entity_type: "order",
    field_key: "k",
    label: "K",
    field_type,
    validation_rules: {},
    binding_key: null,
    default_value: null,
    relation_entity: null,
    ...extra,
  } as FieldDefinition;
}

describe("form values", () => {
  it("edits date-times as Europe/Rome wall-clock parts", () => {
    const d = def("datetime");
    expect(toFormValue(d, "2026-07-15T06:00:00Z")).toEqual({ date: "2026-07-15", time: "08:00" });
    expect(fromFormValue(d, { date: "2026-07-15", time: "08:00" })).toBe(
      "2026-07-15T06:00:00.000Z",
    );
    expect(fromFormValue(d, { date: "", time: "" })).toBeNull();
    expect(fromFormValue(d, { date: "2026-07-15", time: "" })).toBe("incomplete");
  });

  it("converts numbers, lists and addresses", () => {
    expect(toFormValue(def("decimal"), 12.5)).toBe("12.5");
    expect(fromFormValue(def("decimal"), " 1 200.5 ")).toBe("1200.5");
    expect(fromFormValue(def("multi_select"), [])).toBeNull();
    expect(fromFormValue(def("address"), { line1: " Via Po ", city: "" })).toEqual({
      line1: "Via Po",
    });
    expect(fromFormValue(def("short_text"), "   ")).toBeNull();
  });

  it("reads bound columns and attributes, and splits the payload accordingly", () => {
    const customer = def("relation", { field_key: "customer", binding_key: "customer_id" });
    const weight = def("decimal", { field_key: "weight_kg" });
    const record = {
      id: "r",
      customer_id: "c1",
      attributes: { weight_kg: 10 },
    } as unknown as EntityRecord;
    expect(recordValue(customer, record)).toBe("c1");
    expect(recordValue(weight, record)).toBe(10);
    expect(initialFormValues([customer, weight], record)).toEqual({
      customer: "c1",
      weight_kg: "10",
    });
    expect(buildRecordPayload([customer, weight], { customer: "c2", weight_kg: null })).toEqual({
      columns: { customer_id: "c2" },
      attributes: { weight_kg: null },
    });
  });

  it("uses default values on create", () => {
    const d = def("single_select", { field_key: "service", default_value: "opt" });
    expect(initialFormValues([d], null)).toEqual({ service: "opt" });
  });
});

describe("field keys", () => {
  it("derives stable keys from labels", () => {
    expect(fieldKeyFromLabel("Vehicle Type")).toBe("vehicle_type");
    expect(fieldKeyFromLabel("Città di consegna")).toBe("citta_di_consegna");
    expect(fieldKeyFromLabel("2nd driver")).toBe("f_2nd_driver");
    expect(fieldKeyFromLabel("Plate", ["plate"])).toBe("plate_2");
    expect(fieldKeyFromLabel("Status")).toBe("status_2");
  });

  it("rejects invalid, reserved and taken keys", () => {
    expect(fieldKeyError("Vehicle")).toMatch(/lowercase/);
    expect(fieldKeyError("id")).toMatch(/lowercase|reserved/);
    expect(fieldKeyError("status")).toBe("This key is reserved by the system");
    expect(fieldKeyError("plate", ["plate"])).toBe("Another field already uses this key");
    expect(fieldKeyError("fuel_type")).toBeNull();
  });
});

describe("type registry", () => {
  it("offers only operators of filterable types", () => {
    for (const [type, info] of Object.entries(FIELD_TYPES)) {
      if (!info.capabilities.filterable) expect(info.operators, type).toHaveLength(0);
      else expect(info.operators.length, type).toBeGreaterThan(0);
    }
  });

  it("allows only data-preserving type changes", () => {
    expect(isSafeTypeChange("short_text", "long_text")).toBe(true);
    expect(isSafeTypeChange("long_text", "short_text")).toBe(false);
    expect(isSafeTypeChange("integer", "decimal")).toBe(true);
    expect(isSafeTypeChange("decimal", "integer")).toBe(false);
    expect(supports("relation", "default")).toBe(false);
  });
});
