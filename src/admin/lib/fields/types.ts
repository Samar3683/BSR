/**
 * Metadata model of the dynamic field system (mirrors public.entity_configs,
 * public.field_definitions and public.field_options).
 */

export const ENTITY_KEYS = ["order", "vehicle", "driver", "customer"] as const;
export type EntityKey = (typeof ENTITY_KEYS)[number];

export const FIELD_TYPE_KEYS = [
  "short_text",
  "long_text",
  "integer",
  "decimal",
  "currency",
  "percentage",
  "date",
  "time",
  "datetime",
  "email",
  "phone",
  "url",
  "boolean",
  "single_select",
  "multi_select",
  "relation",
  "address",
  "image",
  "file",
] as const;
export type FieldType = (typeof FIELD_TYPE_KEYS)[number];

export interface ValidationRules {
  min_length?: number;
  max_length?: number;
  pattern?: string;
  pattern_message?: string;
  min?: number;
  max?: number;
  precision?: number;
  currency?: string;
  min_date?: string;
  max_date?: string;
  min_time?: string;
  max_time?: string;
  min_items?: number;
  max_items?: number;
  required_parts?: AddressPart[];
  max_size_mb?: number;
  allowed_types?: string[];
}

export type RuleKey = keyof ValidationRules;

export interface EntityConfig {
  entity_key: EntityKey;
  display_name: string;
  plural_display_name: string;
  active: boolean;
  primary_display_field: string | null;
  updated_at: string;
}

export interface FieldDefinition {
  id: string;
  entity_type: EntityKey;
  field_key: string;
  label: string;
  field_type: FieldType;
  description: string | null;
  help_text: string | null;
  placeholder: string | null;
  required: boolean;
  active: boolean;
  archived_at: string | null;
  sort_order: number;
  show_in_list: boolean;
  show_in_detail: boolean;
  show_in_create: boolean;
  show_in_edit: boolean;
  searchable: boolean;
  filterable: boolean;
  sortable: boolean;
  reportable: boolean;
  unique_value: boolean;
  default_value: unknown;
  validation_rules: ValidationRules;
  relation_entity: EntityKey | null;
  binding_key: string | null;
  is_system: boolean;
  read_only: boolean;
  created_at: string;
  updated_at: string;
}

export interface FieldOption {
  id: string;
  field_id: string;
  label: string;
  sort_order: number;
  archived_at: string | null;
  created_at: string;
}

export const ADDRESS_PARTS = [
  "line1",
  "line2",
  "postal_code",
  "city",
  "province",
  "country",
] as const;
export type AddressPart = (typeof ADDRESS_PARTS)[number];
export type AddressValue = Partial<Record<AddressPart, string>>;

export interface FileValue {
  path: string;
  name: string;
  size?: number | null;
  mime_type?: string | null;
}

/** A row of customers / drivers / vehicles / orders as the API returns it. */
export interface EntityRecord {
  id: string;
  display_name: string;
  attributes: Record<string, unknown>;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
  [column: string]: unknown;
}

export type FormMode = "create" | "edit";
