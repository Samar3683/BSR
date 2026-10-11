"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Archive,
  ArchiveRestore,
  ArrowDown,
  ArrowUp,
  ChartColumn,
  Eye,
  Funnel,
  GripVertical,
  List,
  Pencil,
  Plus,
  Power,
  Search,
  SquarePen,
  ArrowUpDown,
  TextCursorInput,
  Trash,
} from "lucide-react";
import { useState, type DragEvent, type ReactNode } from "react";

import { Button } from "../../components/ui/button";
import { ConfirmDialog } from "../../components/ui/dialog";
import { ErrorState, LoadingState } from "../../components/ui/feedback";
import { Checkbox, Segmented } from "../../components/ui/form";
import { Panel } from "../../components/ui/layout";
import { useToast } from "../../components/ui/toast";
import { useAdminConfig, useInvalidateConfig } from "../../hooks/use-admin-config";
import { toAdminError } from "../../lib/errors";
import { FIELD_TYPES } from "../../lib/fields/registry";
import { ENTITY_KEYS, type EntityKey, type FieldDefinition } from "../../lib/fields/types";
import {
  deleteField,
  fetchFieldUsage,
  isLive,
  reorderFields,
  setFieldArchived,
  updateField,
  type AdminConfig,
} from "../../services/config";
import { useUrlState } from "../records/url-state";
import { FieldEditorDialog } from "./field-editor";

type Confirm = { kind: "archive" | "delete"; field: FieldDefinition } | null;

export function FieldBuilder() {
  const { get, update } = useUrlState();
  const configQuery = useAdminConfig();
  const entity = (ENTITY_KEYS as readonly string[]).includes(get("entity") ?? "")
    ? (get("entity") as EntityKey)
    : "order";

  if (configQuery.isError)
    return <ErrorState error={configQuery.error} onRetry={() => configQuery.refetch()} />;
  if (!configQuery.data) return <LoadingState />;
  const config = configQuery.data;

  return (
    <div className="a-stack">
      <div className="a-row" style={{ justifyContent: "space-between" }}>
        <Segmented
          label="Entity"
          value={entity}
          onChange={(value) => update({ entity: value === "order" ? null : value })}
          options={ENTITY_KEYS.map((key) => ({
            value: key,
            label: config.entities[key]?.plural_display_name ?? key,
          }))}
        />
      </div>
      <FieldList key={entity} entity={entity} config={config} />
    </div>
  );
}

function FieldList({ entity, config }: { entity: EntityKey; config: AdminConfig }) {
  const toast = useToast();
  const invalidate = useInvalidateConfig();
  const [editing, setEditing] = useState<FieldDefinition | "new" | null>(null);
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropId, setDropId] = useState<string | null>(null);
  const [handleId, setHandleId] = useState<string | null>(null);
  const usage = useQuery({
    queryKey: ["field-usage", entity],
    queryFn: () => fetchFieldUsage(entity),
  });

  const fields = config.fields[entity];
  const ordered = fields.filter((f) => !f.archived_at);
  const archived = fields.filter((f) => f.archived_at);
  const primary = config.entities[entity]?.primary_display_field;

  const run = useMutation({
    mutationFn: async ({ task }: { task: () => Promise<unknown>; success: string }) => task(),
    onSuccess: async (_, { success }) => {
      await invalidate();
      toast.success(success);
      setConfirm(null);
    },
    onError: (error) => toast.error(toAdminError(error).message),
  });

  const reorder = (ids: string[]) =>
    run.mutate({
      task: () => reorderFields(entity, [...ids, ...archived.map((f) => f.id)]),
      success: "Order saved.",
    });

  const move = (field: FieldDefinition, delta: -1 | 1) => {
    const ids = ordered.map((f) => f.id);
    const index = ids.indexOf(field.id);
    const target = index + delta;
    if (target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target]!, ids[index]!];
    reorder(ids);
  };

  const onDrop = (event: DragEvent, targetId: string) => {
    event.preventDefault();
    const sourceId = dragId;
    setDragId(null);
    setDropId(null);
    if (!sourceId || sourceId === targetId) return;
    const ids = ordered.map((f) => f.id).filter((id) => id !== sourceId);
    ids.splice(ids.indexOf(targetId), 0, sourceId);
    reorder(ids);
  };

  const usageOf = (field: FieldDefinition) => usage.data?.[field.id] ?? 0;

  const row = (field: FieldDefinition, index: number, list: FieldDefinition[]) => {
    const live = isLive(field);
    const used = usageOf(field);
    const draggable = !field.archived_at;
    return (
      <div
        key={field.id}
        role="listitem"
        className="a-field-row"
        data-retired={!live}
        data-dragging={dragId === field.id}
        data-drop={dropId === field.id && dragId !== field.id}
        draggable={draggable && handleId === field.id}
        onDragStart={(e) => {
          setDragId(field.id);
          e.dataTransfer.effectAllowed = "move";
          e.dataTransfer.setData("text/plain", field.id);
        }}
        onDragEnd={() => {
          setDragId(null);
          setDropId(null);
          setHandleId(null);
        }}
        onDragOver={(e) => {
          if (!dragId || field.archived_at) return;
          e.preventDefault();
          setDropId(field.id);
        }}
        onDrop={(e) => onDrop(e, field.id)}
      >
        {draggable ? (
          <span
            className="a-drag"
            aria-hidden="true"
            title="Drag to reorder"
            onMouseDown={() => setHandleId(field.id)}
            onMouseUp={() => setHandleId(null)}
          >
            <GripVertical />
          </span>
        ) : (
          <span />
        )}
        <div className="a-field-title">
          <strong>
            {field.label}
            {field.required ? (
              <span className="a-required" title="Required">
                {" "}
                *
              </span>
            ) : null}
          </strong>
          <span className="a-small a-muted">
            <span className="a-mono">{field.field_key}</span>
            {field.relation_entity
              ? ` → ${config.entities[field.relation_entity]?.plural_display_name}`
              : ""}
            {` · ${used} ${used === 1 ? "record" : "records"}`}
          </span>
          <div className="a-flags">
            {field.is_system ? <span className="a-badge a-badge--carbon">System</span> : null}
            {field.field_key === primary ? (
              <span className="a-badge a-badge--green">Names records</span>
            ) : null}
            {field.unique_value ? <span className="a-badge">Unique</span> : null}
            {!field.active ? <span className="a-badge a-badge--red">Disabled</span> : null}
            {field.archived_at ? <span className="a-badge a-badge--red">Archived</span> : null}
          </div>
        </div>
        <div className="a-field-type">
          <span className="a-badge a-badge--outline">{FIELD_TYPES[field.field_type].label}</span>
        </div>
        <div className="a-field-caps">
          <span className="a-icons" aria-label="Shown in">
            <Flag on={field.show_in_list} label="List" icon={<List />} />
            <Flag on={field.show_in_detail} label="Record page" icon={<Eye />} />
            <Flag on={field.show_in_create} label="Create form" icon={<TextCursorInput />} />
            <Flag on={field.show_in_edit} label="Edit form" icon={<SquarePen />} />
          </span>
          <span className="a-icons" aria-label="Behaviour">
            <Flag on={field.searchable} label="Searchable" icon={<Search />} />
            <Flag on={field.filterable} label="Filterable" icon={<Funnel />} />
            <Flag on={field.sortable} label="Sortable" icon={<ArrowUpDown />} />
            <Flag on={field.reportable} label="Reportable" icon={<ChartColumn />} />
          </span>
        </div>
        <div className="a-row" style={{ flexWrap: "nowrap", gap: 2 }}>
          {!field.archived_at ? (
            <>
              <Button
                size="sm"
                variant="ghost"
                icon
                aria-label={`Move ${field.label} up`}
                disabled={index === 0 || run.isPending}
                onClick={() => move(field, -1)}
              >
                <ArrowUp aria-hidden="true" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                icon
                aria-label={`Move ${field.label} down`}
                disabled={index === list.length - 1 || run.isPending}
                onClick={() => move(field, 1)}
              >
                <ArrowDown aria-hidden="true" />
              </Button>
            </>
          ) : null}
          <Button
            size="sm"
            variant="ghost"
            icon
            aria-label={`Edit ${field.label}`}
            title="Edit"
            onClick={() => setEditing(field)}
          >
            <Pencil aria-hidden="true" />
          </Button>
          {!field.is_system && !field.archived_at ? (
            <Button
              size="sm"
              variant="ghost"
              icon
              aria-label={field.active ? `Disable ${field.label}` : `Enable ${field.label}`}
              title={field.active ? "Disable" : "Enable"}
              onClick={() =>
                run.mutate({
                  task: () => updateField(field.id, { active: !field.active }),
                  success: field.active ? "Field disabled." : "Field enabled.",
                })
              }
            >
              <Power aria-hidden="true" />
            </Button>
          ) : null}
          {!field.is_system ? (
            field.archived_at ? (
              <Button
                size="sm"
                variant="ghost"
                icon
                aria-label={`Restore ${field.label}`}
                title="Restore"
                onClick={() =>
                  run.mutate({
                    task: () => setFieldArchived(field.id, false),
                    success: "Field restored.",
                  })
                }
              >
                <ArchiveRestore aria-hidden="true" />
              </Button>
            ) : (
              <Button
                size="sm"
                variant="ghost"
                icon
                aria-label={`Archive ${field.label}`}
                title="Archive"
                onClick={() => setConfirm({ kind: "archive", field })}
              >
                <Archive aria-hidden="true" />
              </Button>
            )
          ) : null}
          {!field.is_system ? (
            <Button
              size="sm"
              variant="danger-ghost"
              icon
              aria-label={`Delete ${field.label}`}
              title={used ? "Holds data: archive it instead" : "Delete"}
              disabled={used > 0}
              onClick={() => setConfirm({ kind: "delete", field })}
            >
              <Trash aria-hidden="true" />
            </Button>
          ) : null}
        </div>
      </div>
    );
  };

  return (
    <>
      <Panel
        title={`${config.entities[entity]?.display_name} fields`}
        flush
        actions={
          <>
            <Checkbox
              label={`Show archived (${archived.length})`}
              checked={showArchived}
              onChange={setShowArchived}
            />
            <Button variant="primary" size="sm" onClick={() => setEditing("new")}>
              <Plus aria-hidden="true" />
              New field
            </Button>
          </>
        }
      >
        <div
          className="a-fields"
          role="list"
          aria-label="Fields in display order"
          aria-busy={run.isPending || undefined}
        >
          {ordered.map((field, index) => row(field, index, ordered))}
          {showArchived ? archived.map((field, index) => row(field, index, archived)) : null}
        </div>
        <p className="a-panel-foot a-help" style={{ justifyContent: "flex-start" }}>
          Drag rows or use the arrows to change the order of forms, record pages and list columns.
          Archived fields keep their values on existing records and leave every form.
        </p>
      </Panel>

      {editing ? (
        <FieldEditorDialog
          key={editing === "new" ? "new" : `${editing.id}:${editing.updated_at}`}
          entity={entity}
          config={config}
          field={editing === "new" ? null : (config.fieldById[editing.id] ?? editing)}
          usage={editing === "new" ? 0 : usageOf(editing)}
          open
          onClose={() => setEditing(null)}
        />
      ) : null}

      <ConfirmDialog
        open={confirm !== null}
        title={confirm?.kind === "delete" ? "Delete this field?" : "Archive this field?"}
        message={
          confirm?.kind === "delete"
            ? `“${confirm.field.label}” holds no data and will be removed permanently.`
            : `“${confirm?.field.label}” leaves every form and list. Values already stored stay on their records and in the audit history. You can restore it later.`
        }
        confirmLabel={confirm?.kind === "delete" ? "Delete field" : "Archive field"}
        busy={run.isPending}
        onConfirm={() =>
          confirm &&
          run.mutate(
            confirm.kind === "delete"
              ? { task: () => deleteField(confirm.field.id), success: "Field deleted." }
              : {
                  task: () => setFieldArchived(confirm.field.id, true),
                  success: "Field archived.",
                },
          )
        }
        onClose={() => setConfirm(null)}
      />
    </>
  );
}

function Flag({ on, label, icon }: { on: boolean; label: string; icon: ReactNode }) {
  return (
    <span data-on={on} title={`${label}: ${on ? "yes" : "no"}`}>
      {icon}
      <span className="a-sr-only">
        {label}: {on ? "yes" : "no"}
      </span>
    </span>
  );
}
