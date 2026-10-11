import { describe, expect, it } from "vitest";

import { AdminError, toAdminError } from "./errors";

describe("toAdminError", () => {
  it("maps database validation errors to field errors", () => {
    const error = toAdminError({
      code: "P0001",
      message: "Validation failed",
      details: '{"plate": "Another record already uses this value", "vehicle_type": "Required"}',
      hint: "validation_failed",
    });
    expect(error.kind).toBe("validation");
    expect(error.fieldErrors).toEqual({
      plate: "Another record already uses this value",
      vehicle_type: "Required",
    });
    expect(error.message).toBe("Some fields need attention.");
  });

  it("keeps conflict and business-rule messages", () => {
    const conflict = toAdminError({
      code: "P0001",
      message: "Driver Mario is already assigned",
      hint: "assignment_conflict",
    });
    expect(conflict.kind).toBe("conflict");
    expect(conflict.message).toBe("Driver Mario is already assigned");
    expect(
      toAdminError({ code: "P0001", message: "Confirm the order first", hint: "business_rule" })
        .kind,
    ).toBe("rule");
  });

  it("maps permission, constraint and lookup failures", () => {
    expect(
      toAdminError({ code: "42501", message: "permission denied for table audit_logs" }).kind,
    ).toBe("forbidden");
    expect(toAdminError({ code: "23P01", message: "conflicting key value" }).kind).toBe("conflict");
    expect(
      toAdminError({ code: "22P02", message: "invalid input syntax for type uuid" }).kind,
    ).toBe("not_found");
    const key = toAdminError({
      code: "23505",
      message: 'duplicate key value violates unique constraint "field_definitions_key_unique"',
    });
    expect(key.fieldErrors.field_key).toMatch(/already uses this key/);
    const window = toAdminError({
      code: "23514",
      message: 'violates check constraint "orders_window_order"',
    });
    expect(window.fieldErrors.delivery_at).toBe("Must be after the pickup");
  });

  it("recognises network and session failures", () => {
    expect(toAdminError(new TypeError("Failed to fetch")).kind).toBe("network");
    expect(
      toAdminError({ name: "AuthApiError", message: "Invalid Refresh Token", status: 400 }).kind,
    ).toBe("auth");
    const existing = new AdminError("rule", "x");
    expect(toAdminError(existing)).toBe(existing);
  });
});
