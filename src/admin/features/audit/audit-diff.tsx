"use client";

import { formatDateTime } from "../../lib/datetime";
import { formatFieldValue } from "../../lib/fields/format";
import type { EntityKey } from "../../lib/fields/types";
import type { AdminConfig } from "../../services/config";
import type { AuditEntry } from "../../services/audit";
import { STATUS_LABELS } from "../../services/operations";
import type { OrderStatus } from "../../services/records";

const ENTITY_TYPES: readonly string[] = ["order", "vehicle", "driver", "customer"];

const COLUMN_LABELS: Record<string, string> = {
  status: "Status",
  archived_at: "Archived",
  available: "Available for dispatch",
  customer_id: "Customer",
  pickup_at: "Pickup",
  delivery_at: "Delivery",
  driver_id: "Driver",
  vehicle_id: "Vehicle",
  starts_at: "Starts",
  ends_at: "Ends",
  released_at: "Released",
  release_reason: "Release reason",
  released_by: "Released by",
  note: "Note",
  label: "Label",
  sort_order: "Order",
  active: "Active",
  display_name: "Name",
  plural_display_name: "Plural name",
  primary_display_field: "Primary display field",
  required: "Required",
  field_type: "Type",
  validation_rules: "Validation",
  default_value: "Default value",
  help_text: "Help text",
  description: "Description",
  placeholder: "Placeholder",
  show_in_list: "Shown in list",
  show_in_detail: "Shown in detail",
  show_in_create: "Shown when creating",
  show_in_edit: "Shown when editing",
  searchable: "Searchable",
  filterable: "Filterable",
  sortable: "Sortable",
  reportable: "Reportable",
  unique_value: "Unique",
  relation_entity: "Related entity",
  role: "Role",
};

function humanize(key: string) {
  return COLUMN_LABELS[key] ?? key.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}

/** Label and readable value of one changed key of an audit entry. */
export function describeChange(entry: AuditEntry, key: string, config: AdminConfig | undefined) {
  const read = (state: Record<string, unknown> | null) => {
    if (!state) return undefined;
    if (key.startsWith("attributes."))
      return (state.attributes as Record<string, unknown> | undefined)?.[key.slice(11)];
    return state[key];
  };
  const before = read(entry.before_state);
  const after = read(entry.after_state);

  if (key.startsWith("attributes.") && config && ENTITY_TYPES.includes(entry.entity_type)) {
    const fieldKey = key.slice(11);
    const def = config.fields[entry.entity_type as EntityKey]?.find(
      (f) => f.field_key === fieldKey,
    );
    if (def) {
      const ctx = { optionsByField: config.options };
      const fmt = (value: unknown) =>
        value === undefined || value === null
          ? "—"
          : formatFieldValue(def, value, ctx) || JSON.stringify(value);
      return { label: def.label, before: fmt(before), after: fmt(after) };
    }
    return { label: fieldKey, before: plain(before), after: plain(after) };
  }

  if (key === "status") {
    return {
      label: "Status",
      before: before ? STATUS_LABELS[before as OrderStatus] : "—",
      after: after ? STATUS_LABELS[after as OrderStatus] : "—",
    };
  }
  return { label: humanize(key), before: plain(before), after: plain(after) };
}

function plain(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value))
    return formatDateTime(value);
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export function AuditChanges({
  entry,
  config,
}: {
  entry: AuditEntry;
  config: AdminConfig | undefined;
}) {
  const keys =
    entry.changed_fields.length > 0
      ? entry.changed_fields
      : Object.keys(entry.after_state ?? entry.before_state ?? {}).filter(
          (k) =>
            !["id", "created_at", "updated_at", "created_by", "updated_by", "period"].includes(k),
        );
  const expanded = keys.flatMap((key) => {
    if (key !== "attributes") return [key];
    const attrs = (entry.after_state ?? entry.before_state)?.attributes as
      Record<string, unknown> | undefined;
    return Object.keys(attrs ?? {}).map((k) => `attributes.${k}`);
  });
  if (!expanded.length) return <p className="a-muted a-small">No field-level details.</p>;
  return (
    <div className="a-table-wrap">
      <table className="a-table">
        <thead>
          <tr>
            <th scope="col">Field</th>
            {entry.before_state ? <th scope="col">Before</th> : null}
            {entry.after_state ? <th scope="col">After</th> : null}
          </tr>
        </thead>
        <tbody>
          {expanded.map((key) => {
            const change = describeChange(entry, key, config);
            return (
              <tr key={key}>
                <td>{change.label}</td>
                {entry.before_state ? <td className="a-wrap">{change.before}</td> : null}
                {entry.after_state ? <td className="a-wrap">{change.after}</td> : null}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
