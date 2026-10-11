import type { FieldDefinition, FieldType, RuleKey } from "./types";

export type Capability =
  "searchable" | "filterable" | "sortable" | "reportable" | "unique" | "default";

export type FilterOperator =
  | "eq"
  | "neq"
  | "in"
  | "contains"
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "between"
  | "is_empty"
  | "is_not_empty";

export interface FieldTypeInfo {
  label: string;
  group: "Text" | "Number" | "Date & time" | "Contact" | "Choice" | "Link" | "Media";
  description: string;
  rules: readonly RuleKey[];
  capabilities: Readonly<Record<Capability, boolean>>;
  operators: readonly FilterOperator[];
}

const TEXT_OPS: readonly FilterOperator[] = ["contains", "eq", "neq", "is_empty", "is_not_empty"];
const RANGE_OPS: readonly FilterOperator[] = [
  "eq",
  "gt",
  "gte",
  "lt",
  "lte",
  "between",
  "is_empty",
  "is_not_empty",
];
const CHOICE_OPS: readonly FilterOperator[] = ["in", "is_empty", "is_not_empty"];

const caps = (
  searchable: boolean,
  filterable: boolean,
  sortable: boolean,
  reportable: boolean,
  unique: boolean,
  defaultValue: boolean,
) => ({ searchable, filterable, sortable, reportable, unique, default: defaultValue });

/**
 * One entry per field type. Capabilities mirror private.field_type_supports()
 * and rules mirror private.validate_rules() in the database (unit-tested), so
 * the field builder only offers what the server accepts.
 */
export const FIELD_TYPES: Readonly<Record<FieldType, FieldTypeInfo>> = {
  short_text: {
    label: "Short text",
    group: "Text",
    description: "A single line, such as a name or a reference.",
    rules: ["min_length", "max_length", "pattern", "pattern_message"],
    capabilities: caps(true, true, true, true, true, true),
    operators: TEXT_OPS,
  },
  long_text: {
    label: "Long text",
    group: "Text",
    description: "Several lines of notes or descriptions.",
    rules: ["min_length", "max_length", "pattern", "pattern_message"],
    capabilities: caps(true, false, false, false, false, true),
    operators: [],
  },
  integer: {
    label: "Integer",
    group: "Number",
    description: "A whole number.",
    rules: ["min", "max"],
    capabilities: caps(true, true, true, true, true, true),
    operators: RANGE_OPS,
  },
  decimal: {
    label: "Decimal",
    group: "Number",
    description: "A number with decimal places.",
    rules: ["min", "max", "precision"],
    capabilities: caps(true, true, true, true, true, true),
    operators: RANGE_OPS,
  },
  currency: {
    label: "Currency",
    group: "Number",
    description: "An amount of money in one currency.",
    rules: ["min", "max", "precision", "currency"],
    capabilities: caps(false, true, true, true, false, true),
    operators: RANGE_OPS,
  },
  percentage: {
    label: "Percentage",
    group: "Number",
    description: "A percentage (0–100 unless limits are set).",
    rules: ["min", "max", "precision"],
    capabilities: caps(false, true, true, true, false, true),
    operators: RANGE_OPS,
  },
  date: {
    label: "Date",
    group: "Date & time",
    description: "A calendar day.",
    rules: ["min_date", "max_date"],
    capabilities: caps(false, true, true, true, false, true),
    operators: RANGE_OPS,
  },
  time: {
    label: "Time",
    group: "Date & time",
    description: "A time of day.",
    rules: ["min_time", "max_time"],
    capabilities: caps(false, true, true, false, false, true),
    operators: RANGE_OPS,
  },
  datetime: {
    label: "Date & time",
    group: "Date & time",
    description: "A moment: day and time (Europe/Rome).",
    rules: ["min_date", "max_date"],
    capabilities: caps(false, true, true, true, false, true),
    operators: RANGE_OPS,
  },
  email: {
    label: "Email",
    group: "Contact",
    description: "An email address, with a mail action.",
    rules: ["max_length"],
    capabilities: caps(true, true, true, false, true, true),
    operators: TEXT_OPS,
  },
  phone: {
    label: "Phone",
    group: "Contact",
    description: "A phone number, with call and WhatsApp actions.",
    rules: ["max_length"],
    capabilities: caps(true, true, true, false, true, true),
    operators: TEXT_OPS,
  },
  url: {
    label: "URL",
    group: "Contact",
    description: "A web address.",
    rules: ["max_length"],
    capabilities: caps(true, true, true, false, true, true),
    operators: TEXT_OPS,
  },
  boolean: {
    label: "Yes / No",
    group: "Choice",
    description: "A switch.",
    rules: [],
    capabilities: caps(false, true, true, true, false, true),
    operators: ["eq", "is_empty", "is_not_empty"],
  },
  single_select: {
    label: "Single select",
    group: "Choice",
    description: "One option from a list you manage.",
    rules: [],
    capabilities: caps(true, true, true, true, false, true),
    operators: CHOICE_OPS,
  },
  multi_select: {
    label: "Multi select",
    group: "Choice",
    description: "Several options from a list you manage.",
    rules: ["min_items", "max_items"],
    capabilities: caps(true, true, false, true, false, true),
    operators: CHOICE_OPS,
  },
  relation: {
    label: "Relation",
    group: "Link",
    description: "A link to an order, vehicle, driver or customer.",
    rules: [],
    capabilities: caps(true, true, true, true, false, false),
    operators: ["eq", "is_empty", "is_not_empty"],
  },
  address: {
    label: "Address",
    group: "Link",
    description: "Street, postal code, city, province and country.",
    rules: ["required_parts"],
    capabilities: caps(true, true, false, false, false, false),
    operators: ["contains", "is_empty", "is_not_empty"],
  },
  image: {
    label: "Image",
    group: "Media",
    description: "A photo stored privately (JPEG, PNG, WebP, GIF).",
    rules: ["max_size_mb", "allowed_types"],
    capabilities: caps(false, true, false, false, false, false),
    operators: ["is_empty", "is_not_empty"],
  },
  file: {
    label: "File",
    group: "Media",
    description: "A document stored privately (PDF, office files, images).",
    rules: ["max_size_mb", "allowed_types"],
    capabilities: caps(false, true, false, false, false, false),
    operators: ["is_empty", "is_not_empty"],
  },
};

export const FIELD_TYPE_GROUPS = [
  "Text",
  "Number",
  "Date & time",
  "Contact",
  "Choice",
  "Link",
  "Media",
] as const;

export function supports(type: FieldType, capability: Capability): boolean {
  return FIELD_TYPES[type].capabilities[capability];
}

export function isSelectType(type: FieldType): boolean {
  return type === "single_select" || type === "multi_select";
}

export function isNumericType(type: FieldType): boolean {
  return type === "integer" || type === "decimal" || type === "currency" || type === "percentage";
}

export function isFileType(type: FieldType): boolean {
  return type === "image" || type === "file";
}

/** Field types whose value can name a record (mirrors validate_entity_config). */
export const PRIMARY_DISPLAY_TYPES: readonly FieldType[] = [
  "short_text",
  "email",
  "phone",
  "url",
  "integer",
  "decimal",
  "single_select",
  "relation",
  "date",
  "datetime",
];

/** Type changes the server accepts while values exist (field_type_change_safe). */
export function isSafeTypeChange(from: FieldType, to: FieldType): boolean {
  return (
    from === to ||
    (from === "short_text" && to === "long_text") ||
    (from === "integer" && (to === "decimal" || to === "currency")) ||
    ((from === "decimal" || from === "currency") && (to === "decimal" || to === "currency"))
  );
}

export const DEFAULT_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
export const DEFAULT_FILE_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "text/plain",
  "text/csv",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
];

export function allowedFileTypes(
  def: Pick<FieldDefinition, "field_type" | "validation_rules">,
): string[] {
  return (
    def.validation_rules.allowed_types ??
    (def.field_type === "image" ? DEFAULT_IMAGE_TYPES : DEFAULT_FILE_TYPES)
  );
}

export function maxFileSizeMb(
  def: Pick<FieldDefinition, "field_type" | "validation_rules">,
): number {
  return def.validation_rules.max_size_mb ?? (def.field_type === "image" ? 10 : 25);
}

export const OPERATOR_LABELS: Readonly<Record<FilterOperator, string>> = {
  eq: "is",
  neq: "is not",
  in: "is any of",
  contains: "contains",
  gt: "greater than",
  gte: "at least",
  lt: "less than",
  lte: "at most",
  between: "between",
  is_empty: "is empty",
  is_not_empty: "is not empty",
};
