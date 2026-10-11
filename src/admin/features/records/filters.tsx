"use client";

import { Funnel, Plus, X } from "lucide-react";

import { RelationPicker } from "../../components/fields/relation-picker";
import { Button } from "../../components/ui/button";
import { Checkbox, Input, Select } from "../../components/ui/form";
import { defaultOperator, NO_VALUE_OPERATORS, type UiFilter } from "../../lib/filters";
import { FIELD_TYPES, OPERATOR_LABELS, type FilterOperator } from "../../lib/fields/registry";
import type { FieldDefinition, FieldOption } from "../../lib/fields/types";

export { toApiFilters, type UiFilter } from "../../lib/filters";

function ValueEditor({
  def,
  filter,
  options,
  onChange,
}: {
  def: FieldDefinition;
  filter: UiFilter;
  options: readonly FieldOption[];
  onChange: (value: unknown) => void;
}) {
  const label = `${def.label} value`;
  if (NO_VALUE_OPERATORS.includes(filter.op)) return <span />;
  const type = def.field_type;
  const inputType =
    type === "date" || type === "datetime" ? "date" : type === "time" ? "time" : "text";

  if (type === "single_select" || type === "multi_select") {
    const selected = Array.isArray(filter.value) ? (filter.value as string[]) : [];
    return (
      <div className="a-option-list" role="group" aria-label={label} style={{ maxHeight: 150 }}>
        {options.map((option) => (
          <Checkbox
            key={option.id}
            label={`${option.label}${option.archived_at ? " (archived)" : ""}`}
            checked={selected.includes(option.id)}
            onChange={(checked) =>
              onChange(
                checked ? [...selected, option.id] : selected.filter((id) => id !== option.id),
              )
            }
          />
        ))}
      </div>
    );
  }
  if (type === "relation") {
    return (
      <RelationPicker
        entity={def.relation_entity!}
        value={(filter.value as string) || null}
        onChange={(id) => onChange(id ?? "")}
        aria-label={label}
      />
    );
  }
  if (type === "boolean") {
    return (
      <Select
        className="a-select--sm"
        aria-label={label}
        value={String(filter.value ?? "")}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">Choose…</option>
        <option value="true">Yes</option>
        <option value="false">No</option>
      </Select>
    );
  }
  if (filter.op === "between") {
    const pair = Array.isArray(filter.value) ? (filter.value as string[]) : ["", ""];
    return (
      <div className="a-input-pair">
        <Input
          className="a-input--sm"
          type={inputType}
          aria-label={`${label} from`}
          value={pair[0] ?? ""}
          onChange={(e) => onChange([e.target.value, pair[1] ?? ""])}
        />
        <Input
          className="a-input--sm"
          type={inputType}
          aria-label={`${label} to`}
          value={pair[1] ?? ""}
          onChange={(e) => onChange([pair[0] ?? "", e.target.value])}
        />
      </div>
    );
  }
  return (
    <Input
      className="a-input--sm"
      type={inputType}
      inputMode={
        ["integer", "decimal", "currency", "percentage"].includes(type) ? "decimal" : undefined
      }
      aria-label={label}
      value={String(filter.value ?? "")}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

export function FilterPanel({
  fields,
  options,
  filters,
  onChange,
}: {
  fields: readonly FieldDefinition[];
  options: Readonly<Record<string, readonly FieldOption[]>>;
  filters: UiFilter[];
  onChange: (filters: UiFilter[]) => void;
}) {
  const update = (id: string, patch: Partial<UiFilter>) =>
    onChange(filters.map((f) => (f.id === id ? { ...f, ...patch } : f)));

  return (
    <div className="a-filter-panel">
      {filters.length === 0 ? (
        <p className="a-muted a-small">No filters. Add one to narrow the list.</p>
      ) : null}
      {filters.map((filter) => {
        const def = fields.find((f) => f.field_key === filter.field);
        if (!def) return null;
        const operators = FIELD_TYPES[def.field_type].operators;
        return (
          <div key={filter.id} className="a-filter-row">
            <strong className="a-filter-field">{def.label}</strong>
            <Select
              className="a-select--sm"
              aria-label={`${def.label} condition`}
              value={filter.op}
              onChange={(e) => {
                const op = e.target.value as FilterOperator;
                const value =
                  op === "between" ? ["", ""] : filter.op === "between" ? "" : filter.value;
                update(filter.id, { op, value });
              }}
            >
              {operators.map((op) => (
                <option key={op} value={op}>
                  {OPERATOR_LABELS[op]}
                </option>
              ))}
            </Select>
            <ValueEditor
              def={def}
              filter={filter}
              options={options[def.id] ?? []}
              onChange={(value) => update(filter.id, { value })}
            />
            <Button
              size="sm"
              variant="ghost"
              icon
              aria-label={`Remove ${def.label} filter`}
              onClick={() => onChange(filters.filter((f) => f.id !== filter.id))}
            >
              <X aria-hidden="true" />
            </Button>
          </div>
        );
      })}
      <div className="a-row">
        <Plus size={15} aria-hidden="true" className="a-muted" />
        <Select
          className="a-select--sm"
          aria-label="Add a filter"
          value=""
          style={{ width: "auto", minWidth: 180 }}
          onChange={(e) => {
            const def = fields.find((f) => f.field_key === e.target.value);
            if (!def) return;
            const op = defaultOperator(def);
            onChange([
              ...filters,
              { id: crypto.randomUUID(), field: def.field_key, op, value: op === "in" ? [] : "" },
            ]);
          }}
        >
          <option value="">Add filter…</option>
          {fields.map((def) => (
            <option key={def.id} value={def.field_key}>
              {def.label}
            </option>
          ))}
        </Select>
        {filters.length ? (
          <Button size="sm" variant="ghost" onClick={() => onChange([])}>
            Clear all
          </Button>
        ) : null}
      </div>
    </div>
  );
}

export function FilterToggle({
  count,
  open,
  onToggle,
}: {
  count: number;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <Button size="sm" onClick={onToggle} aria-expanded={open}>
      <Funnel aria-hidden="true" />
      Filters
      {count ? <span className="a-badge a-badge--green">{count}</span> : null}
    </Button>
  );
}
