import { unwrap } from "../lib/errors";
import type {
  EntityConfig,
  EntityKey,
  FieldDefinition,
  FieldOption,
  FormMode,
} from "../lib/fields/types";
import { ENTITY_KEYS } from "../lib/fields/types";
import { getSupabase } from "../lib/supabase/client";

/** Everything the panel needs to render entities dynamically. */
export interface AdminConfig {
  entities: Record<EntityKey, EntityConfig>;
  /** All fields of each entity (archived included), in display order. */
  fields: Record<EntityKey, FieldDefinition[]>;
  /** All options of each select field (archived included), in display order. */
  options: Record<string, FieldOption[]>;
  fieldById: Record<string, FieldDefinition>;
}

const bySortOrder = (
  a: { sort_order: number; created_at: string },
  b: { sort_order: number; created_at: string },
) => a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at);

export async function fetchAdminConfig(): Promise<AdminConfig> {
  const supabase = getSupabase();
  const [entities, fields, options] = await Promise.all([
    supabase.from("entity_configs").select("*"),
    supabase.from("field_definitions").select("*"),
    supabase.from("field_options").select("*"),
  ]);
  const entityRows = unwrap(entities) as EntityConfig[];
  const fieldRows = (unwrap(fields) as FieldDefinition[]).map((f) => ({
    ...f,
    validation_rules: f.validation_rules ?? {},
  }));
  const optionRows = unwrap(options) as FieldOption[];

  const config: AdminConfig = {
    entities: {} as Record<EntityKey, EntityConfig>,
    fields: { order: [], vehicle: [], driver: [], customer: [] },
    options: {},
    fieldById: {},
  };
  for (const entity of entityRows) config.entities[entity.entity_key] = entity;
  for (const key of ENTITY_KEYS) {
    config.fields[key] = fieldRows.filter((f) => f.entity_type === key).sort(bySortOrder);
  }
  for (const field of fieldRows) config.fieldById[field.id] = field;
  for (const option of optionRows.sort(bySortOrder)) {
    (config.options[option.field_id] ??= []).push(option);
  }
  return config;
}

// --------------------------------------------------------------------------
// Field selections (what each surface shows)
// --------------------------------------------------------------------------

export const isLive = (f: FieldDefinition) => f.active && !f.archived_at;

export function liveFields(config: AdminConfig, entity: EntityKey): FieldDefinition[] {
  return config.fields[entity].filter(isLive);
}

export function formFields(
  config: AdminConfig,
  entity: EntityKey,
  mode: FormMode,
): FieldDefinition[] {
  return liveFields(config, entity).filter(
    (f) => !f.read_only && (mode === "create" ? f.show_in_create : f.show_in_edit),
  );
}

export function listFields(config: AdminConfig, entity: EntityKey): FieldDefinition[] {
  return liveFields(config, entity).filter((f) => f.show_in_list);
}

export function detailFields(config: AdminConfig, entity: EntityKey): FieldDefinition[] {
  return liveFields(config, entity).filter((f) => f.show_in_detail);
}

/** Retired fields that may still hold values on older records. */
export function retiredFields(config: AdminConfig, entity: EntityKey): FieldDefinition[] {
  return config.fields[entity].filter((f) => !isLive(f) && !f.binding_key);
}

export function filterableFields(config: AdminConfig, entity: EntityKey): FieldDefinition[] {
  return liveFields(config, entity).filter((f) => f.filterable);
}

export function sortableFieldKeys(config: AdminConfig, entity: EntityKey): Set<string> {
  return new Set(
    liveFields(config, entity)
      .filter((f) => f.sortable)
      .map((f) => f.field_key),
  );
}

export function reportableFields(config: AdminConfig, entity: EntityKey): FieldDefinition[] {
  return liveFields(config, entity).filter((f) => f.reportable);
}

// --------------------------------------------------------------------------
// Mutations (RLS + database triggers validate every one)
// --------------------------------------------------------------------------

export type FieldInput = Partial<
  Pick<
    FieldDefinition,
    | "field_key"
    | "label"
    | "field_type"
    | "description"
    | "help_text"
    | "placeholder"
    | "required"
    | "active"
    | "sort_order"
    | "show_in_list"
    | "show_in_detail"
    | "show_in_create"
    | "show_in_edit"
    | "searchable"
    | "filterable"
    | "sortable"
    | "reportable"
    | "unique_value"
    | "default_value"
    | "validation_rules"
    | "relation_entity"
  >
>;

export async function createField(entity: EntityKey, input: FieldInput): Promise<FieldDefinition> {
  const supabase = getSupabase();
  return unwrap(
    await supabase
      .from("field_definitions")
      .insert({ ...input, entity_type: entity })
      .select()
      .single(),
  ) as FieldDefinition;
}

/** Updates editable properties; key and entity never change. */
export async function updateField(id: string, input: FieldInput): Promise<FieldDefinition> {
  const { field_key: _key, ...patch } = input;
  void _key;
  return unwrap(
    await getSupabase().from("field_definitions").update(patch).eq("id", id).select().single(),
  ) as FieldDefinition;
}

export async function setFieldArchived(id: string, archived: boolean): Promise<FieldDefinition> {
  return unwrap(
    await getSupabase()
      .from("field_definitions")
      .update({ archived_at: archived ? new Date().toISOString() : null })
      .eq("id", id)
      .select()
      .single(),
  ) as FieldDefinition;
}

export async function deleteField(id: string): Promise<void> {
  unwrap(await getSupabase().from("field_definitions").delete().eq("id", id));
}

export async function reorderFields(entity: EntityKey, ids: string[]): Promise<void> {
  unwrap(await getSupabase().rpc("reorder_fields", { p_entity: entity, p_field_ids: ids }));
}

export async function fetchFieldUsage(entity: EntityKey): Promise<Record<string, number>> {
  const rows = unwrap(await getSupabase().rpc("field_usage", { p_entity: entity })) as {
    field_id: string;
    record_count: number;
  }[];
  return Object.fromEntries(rows.map((r) => [r.field_id, Number(r.record_count)]));
}

export async function createOption(
  fieldId: string,
  label: string,
  sortOrder: number,
): Promise<FieldOption> {
  return unwrap(
    await getSupabase()
      .from("field_options")
      .insert({ field_id: fieldId, label, sort_order: sortOrder })
      .select()
      .single(),
  ) as FieldOption;
}

export async function updateOption(id: string, label: string): Promise<FieldOption> {
  return unwrap(
    await getSupabase().from("field_options").update({ label }).eq("id", id).select().single(),
  ) as FieldOption;
}

export async function setOptionArchived(id: string, archived: boolean): Promise<FieldOption> {
  return unwrap(
    await getSupabase()
      .from("field_options")
      .update({ archived_at: archived ? new Date().toISOString() : null })
      .eq("id", id)
      .select()
      .single(),
  ) as FieldOption;
}

export async function deleteOption(id: string): Promise<void> {
  unwrap(await getSupabase().from("field_options").delete().eq("id", id));
}

export async function reorderOptions(fieldId: string, ids: string[]): Promise<void> {
  unwrap(
    await getSupabase().rpc("reorder_field_options", { p_field_id: fieldId, p_option_ids: ids }),
  );
}

export async function fetchOptionUsage(fieldId: string): Promise<Record<string, number>> {
  const rows = unwrap(await getSupabase().rpc("option_usage", { p_field_id: fieldId })) as {
    option_id: string;
    record_count: number;
  }[];
  return Object.fromEntries(rows.map((r) => [r.option_id, Number(r.record_count)]));
}

export async function updateEntityConfig(
  entity: EntityKey,
  patch: Partial<
    Pick<EntityConfig, "display_name" | "plural_display_name" | "active" | "primary_display_field">
  >,
): Promise<EntityConfig> {
  return unwrap(
    await getSupabase()
      .from("entity_configs")
      .update(patch)
      .eq("entity_key", entity)
      .select()
      .single(),
  ) as EntityConfig;
}
