import { allowedFileTypes, maxFileSizeMb } from "./registry";
import type { AddressPart, FieldDefinition, FieldOption, FileValue, FormMode } from "./types";
import { ADDRESS_PARTS } from "./types";

/**
 * Client-side validation, mirroring private.check_field_value() in the
 * database. It gives immediate feedback; the database validates again and
 * remains the authority.
 */

export interface CheckContext {
  /** All options of the field (archived included). */
  options?: readonly FieldOption[];
  /** The stored value: archived options stay valid while unchanged. */
  oldValue?: unknown;
}

export interface CheckResult {
  value: unknown;
  error: string | null;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE = /^\+?[0-9 ()./-]+$/;
const URL_RE = /^https?:\/\/[^\s/?#]+([/?#]\S*)?$/i;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^\d{2}:\d{2}(:\d{2})?$/;

export function isEmptyValue(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === "string") return value.trim() === "";
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === "object") {
    return Object.values(value as Record<string, unknown>).every(
      (part) =>
        part === null || part === undefined || (typeof part === "string" && part.trim() === ""),
    );
  }
  return false;
}

function validDate(text: string): boolean {
  if (!DATE.test(text)) return false;
  const [y, m, d] = text.split("-").map(Number) as [number, number, number];
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

function decimalPlaces(n: number): number {
  if (!Number.isFinite(n)) return 0;
  const text = String(n);
  if (text.includes("e-")) return Number(text.split("e-")[1]);
  const dot = text.indexOf(".");
  return dot === -1 ? 0 : text.length - dot - 1;
}

function sameValue(a: unknown, b: unknown): boolean {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

export function checkFieldValue(
  def: FieldDefinition,
  input: unknown,
  ctx: CheckContext = {},
): CheckResult {
  const rules = def.validation_rules ?? {};
  const ok = (value: unknown): CheckResult => ({ value, error: null });
  const fail = (error: string): CheckResult => ({ value: input, error });
  if (isEmptyValue(input)) return ok(null);

  switch (def.field_type) {
    case "short_text":
    case "long_text": {
      if (typeof input !== "string" && typeof input !== "number") return fail("Must be text");
      const text = String(input).trim();
      const max = rules.max_length ?? (def.field_type === "short_text" ? 255 : 10000);
      if (text.length > max) return fail(`Must be at most ${max} characters`);
      if (text.length < (rules.min_length ?? 0))
        return fail(`Must be at least ${rules.min_length} characters`);
      if (rules.pattern) {
        let re: RegExp | null = null;
        try {
          re = new RegExp(rules.pattern);
        } catch {
          re = null; // POSIX syntax the browser cannot compile: the server decides.
        }
        if (re && !re.test(text)) return fail(rules.pattern_message || "Has an invalid format");
      }
      return ok(text);
    }
    case "integer":
    case "decimal":
    case "currency":
    case "percentage": {
      let n: number;
      if (typeof input === "number") n = input;
      else if (typeof input === "string" && /^-?\d+(\.\d+)?$/.test(input.trim()))
        n = Number(input.trim());
      else return fail("Must be a number");
      if (!Number.isFinite(n)) return fail("Must be a number");
      if (Math.abs(n) >= 1e15) return fail("Is too large");
      if (def.field_type === "integer") {
        if (!Number.isInteger(n)) return fail("Must be a whole number");
      } else {
        const precision = rules.precision ?? (def.field_type === "decimal" ? 4 : 2);
        if (decimalPlaces(n) > precision) return fail(`Use at most ${precision} decimal places`);
      }
      const min = rules.min ?? (def.field_type === "percentage" ? 0 : undefined);
      const max = rules.max ?? (def.field_type === "percentage" ? 100 : undefined);
      if (min !== undefined && n < min) return fail(`Must be at least ${min}`);
      if (max !== undefined && n > max) return fail(`Must be at most ${max}`);
      return ok(n);
    }
    case "date": {
      const text = String(input).trim();
      if (typeof input !== "string" || !DATE.test(text)) return fail("Must be a date (YYYY-MM-DD)");
      if (!validDate(text)) return fail("Is not a valid date");
      if (rules.min_date && text < rules.min_date)
        return fail(`Must be on or after ${rules.min_date}`);
      if (rules.max_date && text > rules.max_date)
        return fail(`Must be on or before ${rules.max_date}`);
      return ok(text);
    }
    case "time": {
      const text = String(input).trim();
      if (typeof input !== "string" || !TIME.test(text)) return fail("Must be a time (HH:MM)");
      const [h, m] = text.split(":").map(Number) as [number, number];
      if (h > 23 || m > 59) return fail("Is not a valid time");
      const hhmm = text.slice(0, 5);
      if (rules.min_time && hhmm < rules.min_time)
        return fail(`Must be at or after ${rules.min_time}`);
      if (rules.max_time && hhmm > rules.max_time)
        return fail(`Must be at or before ${rules.max_time}`);
      return ok(hhmm);
    }
    case "datetime": {
      if (typeof input !== "string") return fail("Must be a date and time");
      const date = new Date(input);
      if (!/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/.test(input) || Number.isNaN(date.getTime())) {
        return fail("Is not a valid date and time");
      }
      const day = date.toISOString().slice(0, 10);
      if (rules.min_date && day < rules.min_date)
        return fail(`Must be on or after ${rules.min_date}`);
      if (rules.max_date && day > rules.max_date)
        return fail(`Must be on or before ${rules.max_date}`);
      return ok(date.toISOString());
    }
    case "email": {
      const text = String(input).trim().toLowerCase();
      if (
        typeof input !== "string" ||
        text.length > (rules.max_length ?? 254) ||
        !EMAIL.test(text)
      ) {
        return fail("Must be a valid email address");
      }
      return ok(text);
    }
    case "phone": {
      const text = String(input).trim().replace(/\s+/g, " ");
      const digits = text.replace(/\D/g, "").length;
      if (!PHONE.test(text) || digits < 6 || digits > 15)
        return fail("Must be a valid phone number");
      if (text.length > (rules.max_length ?? 32)) return fail("Is too long");
      return ok(text);
    }
    case "url": {
      const text = String(input).trim();
      if (
        typeof input !== "string" ||
        text.length > (rules.max_length ?? 2048) ||
        !URL_RE.test(text)
      ) {
        return fail("Must be a valid URL (http:// or https://)");
      }
      return ok(text);
    }
    case "boolean": {
      if (typeof input === "boolean") return ok(input);
      if (input === "true" || input === "false") return ok(input === "true");
      return fail("Must be yes or no");
    }
    case "single_select": {
      if (typeof input !== "string" || !UUID.test(input)) return fail("Is not a valid option");
      const option = ctx.options?.find((o) => o.id === input);
      if (ctx.options && !option) return fail("Is not a valid option");
      if (option?.archived_at && !sameValue(input, ctx.oldValue)) {
        return fail("This option is archived and can no longer be selected");
      }
      return ok(input);
    }
    case "multi_select": {
      if (!Array.isArray(input)) return fail("Must be a list of options");
      const old = Array.isArray(ctx.oldValue) ? (ctx.oldValue as unknown[]) : [];
      const unique: string[] = [];
      for (const item of input) {
        if (typeof item !== "string" || !UUID.test(item)) return fail("Contains an invalid option");
        const option = ctx.options?.find((o) => o.id === item);
        if (ctx.options && !option) return fail("Contains an invalid option");
        if (option?.archived_at && !old.includes(item)) return fail("Contains an archived option");
        if (!unique.includes(item)) unique.push(item);
      }
      if (rules.min_items !== undefined && unique.length < rules.min_items)
        return fail(`Select at least ${rules.min_items}`);
      if (rules.max_items !== undefined && unique.length > rules.max_items)
        return fail(`Select at most ${rules.max_items}`);
      return ok(unique);
    }
    case "relation": {
      if (typeof input !== "string" || !UUID.test(input)) return fail("Is not a valid record");
      return ok(input);
    }
    case "address": {
      if (typeof input !== "object" || Array.isArray(input)) return fail("Must be an address");
      const value: Partial<Record<AddressPart, string>> = {};
      for (const [part, raw] of Object.entries(input as Record<string, unknown>)) {
        if (!(ADDRESS_PARTS as readonly string[]).includes(part))
          return fail(`Unknown address part "${part}"`);
        const text = typeof raw === "string" ? raw.trim() : raw == null ? "" : String(raw).trim();
        if (text.length > 200) return fail("An address part is too long");
        if (text) value[part as AddressPart] = text;
      }
      for (const part of rules.required_parts ?? (["line1", "city"] as AddressPart[])) {
        if (!value[part]) return fail(`Address: ${part.replace("_", " ")} is required`);
      }
      return ok(value);
    }
    case "image":
    case "file": {
      const file = input as Partial<FileValue>;
      if (typeof input !== "object" || typeof file.path !== "string")
        return fail("Must be an uploaded file");
      const old = ctx.oldValue as Partial<FileValue> | null | undefined;
      if (old?.path === file.path) return ok(old);
      const prefix = `${def.entity_type}/${def.field_key}/`;
      if (
        !file.path.startsWith(prefix) ||
        !/^[A-Za-z0-9._-]+$/.test(file.path.slice(prefix.length))
      ) {
        return fail("The file was not uploaded for this field");
      }
      if (file.mime_type && !mimeAllowed(file.mime_type, allowedFileTypes(def)))
        return fail("This file type is not allowed");
      if (typeof file.size === "number" && file.size > maxFileSizeMb(def) * 1024 * 1024) {
        return fail(`The file is larger than ${maxFileSizeMb(def)} MB`);
      }
      return ok(file);
    }
  }
}

export function mimeAllowed(mime: string, allowed: readonly string[]): boolean {
  const type = mime.toLowerCase();
  return allowed.some((a) => a === type || (a.endsWith("/*") && type.startsWith(a.slice(0, -1))));
}

/** Is the field shown (and therefore required) in this form mode? */
export function visibleInForm(def: FieldDefinition, mode: FormMode): boolean {
  return mode === "create" ? def.show_in_create : def.show_in_edit;
}

/**
 * Validates a whole form. `values` are keyed by field_key; returns the
 * normalised values and a message per invalid field.
 */
export function validateForm(
  fields: readonly FieldDefinition[],
  values: Record<string, unknown>,
  mode: FormMode,
  ctx: {
    optionsByField: Record<string, readonly FieldOption[]>;
    oldValues?: Record<string, unknown>;
  },
): { values: Record<string, unknown>; errors: Record<string, string> } {
  const out: Record<string, unknown> = {};
  const errors: Record<string, string> = {};
  for (const def of fields) {
    if (def.read_only || !visibleInForm(def, mode)) continue;
    const result = checkFieldValue(def, values[def.field_key], {
      options: ctx.optionsByField[def.id],
      oldValue: ctx.oldValues?.[def.field_key],
    });
    if (result.error) {
      errors[def.field_key] = result.error;
      continue;
    }
    if (result.value === null && def.required) {
      errors[def.field_key] = "Required";
      continue;
    }
    out[def.field_key] = result.value;
  }
  return { values: out, errors };
}
