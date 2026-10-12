"use client";

import { useRecordNames } from "../../hooks/use-admin-config";
import { formatDateTime } from "../../lib/datetime";
import { formatFieldValue } from "../../lib/fields/format";
import type { EntityKey } from "../../lib/fields/types";
import type { AdminConfig } from "../../services/config";
import { AUDIT_ENTITY_LABELS, type AuditEntry } from "../../services/audit";
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

/** Names of the records an entry refers to, by id (customers, drivers, vehicles, orders). */
export type AuditNames = Record<string, string>;

const REFERENCE_KEYS: Record<string, EntityKey> = {
  customer_id: "customer",
  driver_id: "driver",
  vehicle_id: "vehicle",
  order_id: "order",
};

function referencedIds(entries: readonly AuditEntry[], key: string): string[] {
  const ids: string[] = [];
  for (const entry of entries) {
    for (const source of [entry.before_state, entry.after_state, entry.context]) {
      const value = source?.[key];
      if (typeof value === "string") ids.push(value);
    }
  }
  return ids;
}

/** Resolves the ids mentioned by audit entries to record names. */
export function useAuditNames(entries: readonly AuditEntry[]): AuditNames {
  const customers = useRecordNames("customer", referencedIds(entries, "customer_id"));
  const drivers = useRecordNames("driver", referencedIds(entries, "driver_id"));
  const vehicles = useRecordNames("vehicle", referencedIds(entries, "vehicle_id"));
  const orders = useRecordNames("order", referencedIds(entries, "order_id"));
  return {
    ...customers.data,
    ...drivers.data,
    ...vehicles.data,
    ...orders.data,
  };
}

function pick(entry: AuditEntry, key: string): string | null {
  const value = entry.after_state?.[key] ?? entry.before_state?.[key] ?? entry.context[key];
  return typeof value === "string" ? value : null;
}

/** One readable sentence about what an entry did (the actor is shown separately). */
export function auditSentence(
  entry: AuditEntry,
  config: AdminConfig | undefined,
  names: AuditNames,
): string {
  const label = entry.entity_label ?? "";
  const kind = (AUDIT_ENTITY_LABELS[entry.entity_type] ?? entry.entity_type).toLowerCase();
  const name = (key: string) => {
    const id = pick(entry, key);
    return id ? (names[id] ?? null) : null;
  };
  const crew = [name("driver_id"), name("vehicle_id")].filter(Boolean).join(" and ");
  switch (entry.action) {
    case "create":
      return `Created ${kind} ${label}`.trim();
    case "delete":
      return `Deleted ${kind} ${label}`.trim();
    case "archive":
      return `Archived ${kind} ${label}`.trim();
    case "restore":
      return `Restored ${kind} ${label}`.trim();
    case "status_change": {
      const from = entry.before_state?.status as OrderStatus | undefined;
      const to = entry.after_state?.status as OrderStatus | undefined;
      return `Moved ${label} from ${from ? STATUS_LABELS[from] : "—"} to ${to ? STATUS_LABELS[to] : "—"}`;
    }
    case "assign":
    case "reassign":
      return `${entry.action === "assign" ? "Assigned" : "Reassigned"} ${crew || "a crew"} to ${label}`;
    case "unassign":
      return `Removed ${crew || "the crew"} from ${label}`;
    case "pair":
      return `Paired ${name("driver_id") ?? "a driver"} with ${name("vehicle_id") ?? "a vehicle"}`;
    case "unpair":
      return `Ended the pairing of ${name("driver_id") ?? "a driver"} and ${name("vehicle_id") ?? "a vehicle"}`;
    default: {
      const changed = entry.changed_fields
        .filter((k) => !["updated_at", "updated_by"].includes(k))
        .slice(0, 3)
        .map((k) => describeChange(entry, k, config, names).label.toLowerCase());
      const more = entry.changed_fields.length > 3 ? ` +${entry.changed_fields.length - 3}` : "";
      return changed.length
        ? `Changed ${changed.join(", ")}${more} of ${kind} ${label}`.trim()
        : `${AUDIT_ENTITY_LABELS[entry.entity_type] ?? entry.entity_type} ${label}`.trim();
    }
  }
}

/** Label and readable value of one changed key of an audit entry. */
export function describeChange(
  entry: AuditEntry,
  key: string,
  config: AdminConfig | undefined,
  names: AuditNames = {},
) {
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

  if (key in REFERENCE_KEYS) {
    const show = (value: unknown) =>
      typeof value === "string" ? (names[value] ?? "…") : plain(value);
    return { label: humanize(key), before: show(before), after: show(after) };
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
  names = {},
}: {
  entry: AuditEntry;
  config: AdminConfig | undefined;
  names?: AuditNames;
}) {
  const keys =
    entry.changed_fields.length > 0
      ? entry.changed_fields
      : Object.keys(entry.after_state ?? entry.before_state ?? {}).filter(
          (k) =>
            !["id", "created_at", "updated_at", "created_by", "updated_by", "period"].includes(k),
        );
  const flattened = keys.flatMap((key) => {
    if (key !== "attributes") return [key];
    const attrs = (entry.after_state ?? entry.before_state)?.attributes as
      Record<string, unknown> | undefined;
    return Object.keys(attrs ?? {}).map((k) => `attributes.${k}`);
  });
  // Snapshots (created / deleted) list only what has a value.
  const rows = flattened
    .map((key) => ({ key, change: describeChange(entry, key, config, names) }))
    .filter(({ change }) =>
      entry.before_state && entry.after_state
        ? true
        : (entry.after_state ? change.after : change.before) !== "—",
    );
  const expanded = rows.map((r) => r.key);
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
          {rows.map(({ key, change }) => {
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
