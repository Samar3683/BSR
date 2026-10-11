/**
 * Maps Supabase / PostgREST / network failures to messages an operator can
 * act on. The database signals intent through the error hint:
 *   validation_failed   DETAIL holds {field_key: message}
 *   assignment_conflict a driver / vehicle is already booked
 *   business_rule       a workflow rule refused the change
 *   forbidden           not an active administrator
 */
export type AdminErrorKind =
  "validation" | "conflict" | "rule" | "forbidden" | "auth" | "not_found" | "network" | "unknown";

export class AdminError extends Error {
  readonly kind: AdminErrorKind;
  readonly fieldErrors: Record<string, string>;

  constructor(kind: AdminErrorKind, message: string, fieldErrors: Record<string, string> = {}) {
    super(message);
    this.name = "AdminError";
    this.kind = kind;
    this.fieldErrors = fieldErrors;
  }
}

interface PostgrestLike {
  code?: string;
  message?: string;
  details?: string | null;
  hint?: string | null;
}

const UNIQUE_MESSAGES: Record<string, [field: string, message: string]> = {
  field_definitions_key_unique: ["field_key", "Another field of this entity already uses this key"],
  field_options_label_unique_live: ["label", "Another option already has this label"],
};

function parseFieldErrors(details: string | null | undefined): Record<string, string> {
  if (!details) return {};
  try {
    const parsed = JSON.parse(details) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return Object.fromEntries(
        Object.entries(parsed as Record<string, unknown>).map(([key, value]) => [
          key,
          String(value),
        ]),
      );
    }
  } catch {
    // not JSON
  }
  return {};
}

export function toAdminError(error: unknown): AdminError {
  if (error instanceof AdminError) return error;

  if (error instanceof TypeError && /fetch|network/i.test(error.message)) {
    return new AdminError(
      "network",
      "The server could not be reached. Check the connection and try again.",
    );
  }

  const e = (error ?? {}) as PostgrestLike & { status?: number; name?: string };
  const message = e.message ?? (error instanceof Error ? error.message : "");

  if (
    e.name === "AuthApiError" ||
    e.name === "AuthSessionMissingError" ||
    e.status === 401 ||
    e.code === "PGRST301"
  ) {
    return new AdminError("auth", "Your session has expired. Sign in again.");
  }

  switch (e.hint) {
    case "validation_failed": {
      const fieldErrors = parseFieldErrors(e.details);
      const first = Object.values(fieldErrors)[0];
      return new AdminError(
        "validation",
        Object.keys(fieldErrors).length > 1
          ? "Some fields need attention."
          : (first ?? "The data is not valid."),
        fieldErrors,
      );
    }
    case "assignment_conflict":
      return new AdminError("conflict", message);
    case "business_rule":
      return new AdminError("rule", message);
    case "forbidden":
      return new AdminError("forbidden", "Your account does not have access to this action.");
  }

  switch (e.code) {
    case "42501":
      return new AdminError("forbidden", "Your account does not have access to this action.");
    case "23505": {
      const constraint = Object.keys(UNIQUE_MESSAGES).find((name) => message.includes(name));
      if (constraint) {
        const [field, text] = UNIQUE_MESSAGES[constraint]!;
        return new AdminError("validation", text, { [field]: text });
      }
      return new AdminError("validation", "This value already exists.");
    }
    case "23503":
      return new AdminError("rule", "Other records refer to this one; archive it instead.");
    case "23P01":
      return new AdminError(
        "conflict",
        "The driver or vehicle is already booked for an overlapping time.",
      );
    case "23514":
      if (message.includes("orders_window_order")) {
        return new AdminError("validation", "The delivery must be after the pickup.", {
          delivery_at: "Must be after the pickup",
        });
      }
      return new AdminError("validation", "A value is outside the allowed range.");
    case "PGRST116":
    case "22P02":
      return new AdminError("not_found", "The record was not found or is no longer available.");
  }

  if (/failed to fetch|networkerror|load failed/i.test(message)) {
    return new AdminError(
      "network",
      "The server could not be reached. Check the connection and try again.",
    );
  }
  return new AdminError("unknown", message || "Something went wrong. Try again.");
}

/** Throws the mapped error when a Supabase response carries one. */
export function unwrap<T>(result: { data: T; error: unknown }): T {
  if (result.error) throw toAdminError(result.error);
  return result.data;
}
