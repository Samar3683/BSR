"use client";

import Link from "next/link";
import type { ReactNode } from "react";

import { FieldCell } from "../../components/fields/field-value";
import { Empty, StatusBadge } from "../../components/ui/layout";
import type { CsvCell } from "../../lib/csv";
import { formatDateTime, formatRelative } from "../../lib/datetime";
import { formatFieldValue, type FormatContext } from "../../lib/fields/format";
import type { EntityKey, EntityRecord, FieldDefinition } from "../../lib/fields/types";
import { recordValue } from "../../lib/fields/values";
import type { AdminConfig } from "../../services/config";
import { listFields } from "../../services/config";
import { STATUS_LABELS } from "../../services/operations";
import { ENTITY_PATHS, type OrderRow, type ResourceRow } from "../../services/records";

export interface Column {
  key: string;
  label: string;
  sortField?: string;
  numeric?: boolean;
  render: (row: EntityRecord) => ReactNode;
  csv: (row: EntityRecord) => CsvCell;
}

/** Relation ids per target entity found in rows (for name lookups). */
export function collectRelationIds(
  fields: readonly FieldDefinition[],
  rows: readonly EntityRecord[],
) {
  const ids: Record<EntityKey, string[]> = { order: [], vehicle: [], driver: [], customer: [] };
  for (const def of fields) {
    if (def.field_type !== "relation" || !def.relation_entity) continue;
    for (const row of rows) {
      const value = recordValue(def, row);
      if (typeof value === "string") ids[def.relation_entity].push(value);
    }
  }
  return ids;
}

/** Columns of an entity list, from the configured list fields. */
export function buildColumns(entity: EntityKey, config: AdminConfig, ctx: FormatContext): Column[] {
  const entityConfig = config.entities[entity];
  const primaryKey = entityConfig?.primary_display_field;
  const primary = config.fields[entity].find((f) => f.field_key === primaryKey);
  const columns: Column[] = [];
  const path = ENTITY_PATHS[entity];

  columns.push({
    key: "display_name",
    label: primary?.label ?? "Name",
    sortField: "display_name",
    render: (row) => (
      <Link
        href={`${path}/${row.id}`}
        className={entity === "order" ? "a-row-link a-mono" : "a-row-link"}
        onClick={(e) => e.stopPropagation()}
      >
        {row.display_name}
      </Link>
    ),
    csv: (row) => row.display_name,
  });

  if (entity === "order") {
    columns.push({
      key: "status",
      label: "Status",
      sortField: "status",
      render: (row) => <StatusBadge status={(row as OrderRow).status} />,
      csv: (row) => STATUS_LABELS[(row as OrderRow).status],
    });
  }

  for (const def of listFields(config, entity)) {
    if (def.field_key === primaryKey) continue;
    columns.push({
      key: def.field_key,
      label: def.label,
      sortField: def.sortable ? def.field_key : undefined,
      numeric: ["integer", "decimal", "currency", "percentage"].includes(def.field_type),
      render: (row) => <FieldCell def={def} value={recordValue(def, row)} ctx={ctx} />,
      csv: (row) => formatFieldValue(def, recordValue(def, row), ctx),
    });
  }

  if (entity === "order") {
    columns.push({
      key: "assignment",
      label: "Driver · Vehicle",
      render: (row) => {
        const a = (row as OrderRow).assignment;
        if (!a) return <span className="a-badge a-badge--outline">Unassigned</span>;
        return (
          <span>
            {a.driver_name ?? <Empty>No driver</Empty>} ·{" "}
            {a.vehicle_name ?? <Empty>No vehicle</Empty>}
          </span>
        );
      },
      csv: (row) => {
        const a = (row as OrderRow).assignment;
        return a ? [a.driver_name, a.vehicle_name].filter(Boolean).join(" · ") : "";
      },
    });
  }

  if (entity === "driver" || entity === "vehicle") {
    columns.push({
      key: "available",
      label: "Dispatch",
      render: (row) =>
        (row as ResourceRow).available ? (
          <span className="a-badge a-badge--green">Available</span>
        ) : (
          <span className="a-badge">Unavailable</span>
        ),
      csv: (row) => ((row as ResourceRow).available ? "Available" : "Unavailable"),
    });
    columns.push({
      key: "pairing",
      label: entity === "driver" ? "Current vehicle" : "Current driver",
      render: (row) => {
        const p = (row as ResourceRow).pairing;
        const name = entity === "driver" ? p?.vehicle_name : p?.driver_name;
        return name ? <span>{name}</span> : <Empty />;
      },
      csv: (row) => {
        const p = (row as ResourceRow).pairing;
        return (entity === "driver" ? p?.vehicle_name : p?.driver_name) ?? "";
      },
    });
  }

  columns.push({
    key: "updated_at",
    label: "Updated",
    sortField: "updated_at",
    render: (row) => (
      <span className="a-muted" title={formatDateTime(row.updated_at)}>
        {formatRelative(row.updated_at)}
      </span>
    ),
    csv: (row) => formatDateTime(row.updated_at),
  });

  return columns;
}
