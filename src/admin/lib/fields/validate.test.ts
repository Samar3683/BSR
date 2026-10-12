import { describe, expect, it } from "vitest";

import type { FieldDefinition, FieldOption, FieldType, ValidationRules } from "./types";
import { checkFieldValue, isEmptyValue, validateForm } from "./validate";

const OPTION_A = "11111111-1111-4111-8111-111111111111";
const OPTION_B = "22222222-2222-4222-8222-222222222222";
const ARCHIVED = "33333333-3333-4333-8333-333333333333";

function def(
  field_type: FieldType,
  rules: ValidationRules = {},
  extra: Partial<FieldDefinition> = {},
): FieldDefinition {
  return {
    id: "f1",
    entity_type: "vehicle",
    field_key: "probe",
    label: "Probe",
    field_type,
    description: null,
    help_text: null,
    section: null,
    placeholder: null,
    required: false,
    active: true,
    archived_at: null,
    sort_order: 10,
    show_in_list: true,
    show_in_detail: true,
    show_in_create: true,
    show_in_edit: true,
    searchable: false,
    filterable: false,
    sortable: false,
    reportable: false,
    unique_value: false,
    default_value: null,
    validation_rules: rules,
    relation_entity: field_type === "relation" ? "customer" : null,
    binding_key: null,
    is_system: false,
    read_only: false,
    created_at: "2026-10-11T00:00:00Z",
    updated_at: "2026-10-11T00:00:00Z",
    ...extra,
  };
}

const options: FieldOption[] = [
  { id: OPTION_A, field_id: "f1", label: "Van", sort_order: 10, archived_at: null, created_at: "" },
  {
    id: OPTION_B,
    field_id: "f1",
    label: "Motrice",
    sort_order: 20,
    archived_at: null,
    created_at: "",
  },
  {
    id: ARCHIVED,
    field_id: "f1",
    label: "Old",
    sort_order: 30,
    archived_at: "2026-01-01T00:00:00Z",
    created_at: "",
  },
];

describe("isEmptyValue", () => {
  it("treats blank strings, empty arrays and empty address objects as empty", () => {
    expect(isEmptyValue(null)).toBe(true);
    expect(isEmptyValue("  ")).toBe(true);
    expect(isEmptyValue([])).toBe(true);
    expect(isEmptyValue({ line1: " ", city: "" })).toBe(true);
    expect(isEmptyValue(0)).toBe(false);
    expect(isEmptyValue(false)).toBe(false);
  });
});

describe("checkFieldValue", () => {
  it("trims text and enforces length and pattern rules", () => {
    expect(checkFieldValue(def("short_text"), "  Rossi  ")).toEqual({
      value: "Rossi",
      error: null,
    });
    expect(checkFieldValue(def("short_text", { max_length: 3 }), "abcd").error).toBe(
      "Must be at most 3 characters",
    );
    expect(checkFieldValue(def("short_text", { min_length: 3 }), "ab").error).toBe(
      "Must be at least 3 characters",
    );
    expect(
      checkFieldValue(
        def("short_text", { pattern: "^[A-Z]{2}\\d{3}[A-Z]{2}$", pattern_message: "Plate format" }),
        "ab123cd",
      ).error,
    ).toBe("Plate format");
    expect(checkFieldValue(def("short_text"), "x".repeat(256)).error).toBe(
      "Must be at most 255 characters",
    );
  });

  it("validates numbers by type, precision and bounds", () => {
    expect(checkFieldValue(def("integer"), "42").value).toBe(42);
    expect(checkFieldValue(def("integer"), "4.2").error).toBe("Must be a whole number");
    expect(checkFieldValue(def("decimal", { precision: 1 }), "1.25").error).toBe(
      "Use at most 1 decimal places",
    );
    expect(checkFieldValue(def("decimal", { min: 0 }), -1).error).toBe("Must be at least 0");
    expect(checkFieldValue(def("currency"), "10.555").error).toBe("Use at most 2 decimal places");
    expect(checkFieldValue(def("percentage"), 101).error).toBe("Must be at most 100");
    expect(checkFieldValue(def("percentage"), -0.5).error).toBe("Must be at least 0");
    expect(checkFieldValue(def("integer"), "12abc").error).toBe("Must be a number");
  });

  it("validates dates, times and date-times", () => {
    expect(checkFieldValue(def("date"), "2026-02-30").error).toBe("Is not a valid date");
    expect(checkFieldValue(def("date", { min_date: "2026-01-01" }), "2025-12-31").error).toBe(
      "Must be on or after 2026-01-01",
    );
    expect(checkFieldValue(def("time"), "24:10").error).toBe("Is not a valid time");
    expect(checkFieldValue(def("time"), "08:30:00").value).toBe("08:30");
    expect(checkFieldValue(def("datetime"), "2026-10-12T06:30:00.000Z").value).toBe(
      "2026-10-12T06:30:00.000Z",
    );
    expect(checkFieldValue(def("datetime"), "incomplete").error).toBe(
      "Is not a valid date and time",
    );
  });

  it("normalises and checks contact values", () => {
    expect(checkFieldValue(def("email"), " INFO@Rossi.IT ").value).toBe("info@rossi.it");
    expect(checkFieldValue(def("email"), "bad@").error).toBe("Must be a valid email address");
    expect(checkFieldValue(def("phone"), "+39  333   1234567").value).toBe("+39 333 1234567");
    expect(checkFieldValue(def("phone"), "12345").error).toBe("Must be a valid phone number");
    expect(checkFieldValue(def("url"), "https://bsr.example/path?q=1").error).toBeNull();
    expect(checkFieldValue(def("url"), "javascript:alert(1)").error).toMatch(/valid URL/);
  });

  it("accepts booleans and their string forms", () => {
    expect(checkFieldValue(def("boolean"), "true").value).toBe(true);
    expect(checkFieldValue(def("boolean"), false).value).toBe(false);
    expect(checkFieldValue(def("boolean"), "yes").error).toBe("Must be yes or no");
  });

  it("allows current options, rejects unknown ones and keeps an archived option only while unchanged", () => {
    expect(checkFieldValue(def("single_select"), OPTION_A, { options }).error).toBeNull();
    expect(
      checkFieldValue(def("single_select"), "44444444-4444-4444-8444-444444444444", { options })
        .error,
    ).toBe("Is not a valid option");
    expect(checkFieldValue(def("single_select"), ARCHIVED, { options }).error).toMatch(/archived/);
    expect(
      checkFieldValue(def("single_select"), ARCHIVED, { options, oldValue: ARCHIVED }).error,
    ).toBeNull();
  });

  it("deduplicates multi-select values and enforces item limits", () => {
    expect(
      checkFieldValue(def("multi_select"), [OPTION_A, OPTION_A, OPTION_B], { options }).value,
    ).toEqual([OPTION_A, OPTION_B]);
    expect(
      checkFieldValue(def("multi_select", { max_items: 1 }), [OPTION_A, OPTION_B], { options })
        .error,
    ).toBe("Select at most 1");
    expect(checkFieldValue(def("multi_select"), [ARCHIVED], { options, oldValue: [] }).error).toBe(
      "Contains an archived option",
    );
    expect(
      checkFieldValue(def("multi_select"), [ARCHIVED], { options, oldValue: [ARCHIVED] }).error,
    ).toBeNull();
  });

  it("validates addresses with the configured required parts", () => {
    expect(
      checkFieldValue(def("address"), { line1: "Via Roma 1", city: " Milano " }).value,
    ).toEqual({
      line1: "Via Roma 1",
      city: "Milano",
    });
    expect(checkFieldValue(def("address"), { line1: "Via Roma 1" }).error).toBe(
      "Address: city is required",
    );
    expect(
      checkFieldValue(def("address", { required_parts: ["country"] }), { city: "Milano" }).error,
    ).toBe("Address: country is required");
    expect(checkFieldValue(def("address"), { street: "x" }).error).toBe(
      'Unknown address part "street"',
    );
  });

  it("accepts files uploaded for the field only, within type and size", () => {
    const image = def("image", { max_size_mb: 1 });
    expect(
      checkFieldValue(image, {
        path: "vehicle/probe/abc-photo.jpg",
        name: "photo.jpg",
        size: 1000,
        mime_type: "image/jpeg",
      }).error,
    ).toBeNull();
    expect(checkFieldValue(image, { path: "vehicle/other/abc.jpg", name: "a.jpg" }).error).toBe(
      "The file was not uploaded for this field",
    );
    expect(
      checkFieldValue(image, {
        path: "vehicle/probe/a.svg",
        name: "a.svg",
        mime_type: "image/svg+xml",
      }).error,
    ).toBe("This file type is not allowed");
    expect(
      checkFieldValue(image, {
        path: "vehicle/probe/a.jpg",
        name: "a.jpg",
        size: 2 * 1024 * 1024,
        mime_type: "image/jpeg",
      }).error,
    ).toBe("The file is larger than 1 MB");
  });
});

describe("validateForm", () => {
  it("reports required fields shown in the form mode and skips hidden ones", () => {
    const fields = [
      def("short_text", {}, { field_key: "name", required: true }),
      def("short_text", {}, { field_key: "edit_only", required: true, show_in_create: false }),
    ];
    const result = validateForm(fields, { name: "" }, "create", { optionsByField: {} });
    expect(result.errors).toEqual({ name: "Required" });
    const edit = validateForm(fields, { name: "A", edit_only: "" }, "edit", { optionsByField: {} });
    expect(edit.errors).toEqual({ edit_only: "Required" });
  });
});
