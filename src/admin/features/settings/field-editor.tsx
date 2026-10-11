"use client";

import { useMutation } from "@tanstack/react-query";
import { Lock } from "lucide-react";
import { useState } from "react";

import { FieldControl } from "../../components/fields/field-control";
import { Button } from "../../components/ui/button";
import { Dialog } from "../../components/ui/dialog";
import { Alert, FormError } from "../../components/ui/feedback";
import { Field, Input, Select, Switch, Textarea } from "../../components/ui/form";
import { useToast } from "../../components/ui/toast";
import { useInvalidateConfig } from "../../hooks/use-admin-config";
import { toAdminError } from "../../lib/errors";
import { fieldKeyError, fieldKeyFromLabel } from "../../lib/fields/keys";
import {
  FIELD_TYPE_GROUPS,
  FIELD_TYPES,
  isSafeTypeChange,
  isSelectType,
  supports,
  type Capability,
} from "../../lib/fields/registry";
import {
  ENTITY_KEYS,
  type EntityKey,
  type FieldDefinition,
  type FieldType,
  type ValidationRules,
} from "../../lib/fields/types";
import { checkFieldValue } from "../../lib/fields/validate";
import { fromFormValue, toFormValue, type FormValue } from "../../lib/fields/values";
import {
  createField,
  createOption,
  updateField,
  type AdminConfig,
  type FieldInput,
} from "../../services/config";
import { OptionsEditor } from "./options-editor";
import { RulesEditor } from "./rules-editor";

const CAPABILITIES: {
  key: "searchable" | "filterable" | "sortable" | "reportable";
  cap: Capability;
  label: string;
  help: string;
}[] = [
  {
    key: "searchable",
    cap: "searchable",
    label: "Searchable",
    help: "Matched by the list search box.",
  },
  { key: "filterable", cap: "filterable", label: "Filterable", help: "Offered as a list filter." },
  { key: "sortable", cap: "sortable", label: "Sortable", help: "Lists can be sorted by it." },
  {
    key: "reportable",
    cap: "reportable",
    label: "Reportable",
    help: "Available in Reports → Field breakdown.",
  },
];

const VISIBILITY: {
  key: "show_in_list" | "show_in_detail" | "show_in_create" | "show_in_edit";
  label: string;
}[] = [
  { key: "show_in_list", label: "List column" },
  { key: "show_in_detail", label: "Record page" },
  { key: "show_in_create", label: "Create form" },
  { key: "show_in_edit", label: "Edit form" },
];

type Draft = Required<
  Pick<
    FieldDefinition,
    | "label"
    | "field_key"
    | "field_type"
    | "required"
    | "unique_value"
    | "show_in_list"
    | "show_in_detail"
    | "show_in_create"
    | "show_in_edit"
    | "searchable"
    | "filterable"
    | "sortable"
    | "reportable"
    | "active"
  >
> & {
  description: string;
  help_text: string;
  placeholder: string;
  validation_rules: ValidationRules;
  relation_entity: EntityKey | null;
  default_value: FormValue;
};

function draftFrom(field: FieldDefinition | null): Draft {
  return {
    label: field?.label ?? "",
    field_key: field?.field_key ?? "",
    field_type: field?.field_type ?? "short_text",
    required: field?.required ?? false,
    unique_value: field?.unique_value ?? false,
    show_in_list: field?.show_in_list ?? true,
    show_in_detail: field?.show_in_detail ?? true,
    show_in_create: field?.show_in_create ?? true,
    show_in_edit: field?.show_in_edit ?? true,
    searchable: field?.searchable ?? false,
    filterable: field?.filterable ?? false,
    sortable: field?.sortable ?? false,
    reportable: field?.reportable ?? false,
    active: field?.active ?? true,
    description: field?.description ?? "",
    help_text: field?.help_text ?? "",
    placeholder: field?.placeholder ?? "",
    validation_rules: field?.validation_rules ?? {},
    relation_entity: field?.relation_entity ?? null,
    default_value: field ? toFormValue(field, field.default_value) : null,
  };
}

/** Create or edit one field of an entity. */
export function FieldEditorDialog({
  entity,
  config,
  field,
  usage,
  open,
  onClose,
}: {
  entity: EntityKey;
  config: AdminConfig;
  field: FieldDefinition | null;
  usage: number;
  open: boolean;
  onClose: () => void;
}) {
  const toast = useToast();
  const invalidate = useInvalidateConfig();
  const creating = field === null;
  const system = Boolean(field?.is_system);
  const [draft, setDraft] = useState<Draft>(() => draftFrom(field));
  const [keyEdited, setKeyEdited] = useState(false);
  const [initialOptions, setInitialOptions] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const takenKeys = config.fields[entity].filter((f) => f.id !== field?.id).map((f) => f.field_key);
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  // A pseudo definition to validate and render the default value with the field's own rules.
  const preview: FieldDefinition = {
    ...(field ?? ({} as FieldDefinition)),
    id: field?.id ?? "new",
    entity_type: entity,
    field_key: draft.field_key || "new_field",
    label: "Default value",
    field_type: draft.field_type,
    validation_rules: draft.validation_rules,
    relation_entity: draft.relation_entity,
    required: false,
    help_text: null,
    placeholder: null,
    binding_key: null,
    read_only: false,
  } as FieldDefinition;

  const save = useMutation({
    mutationFn: async () => {
      const input: FieldInput = {
        label: draft.label.trim(),
        description: draft.description.trim() || null,
        help_text: draft.help_text.trim() || null,
        placeholder: draft.placeholder.trim() || null,
        required: draft.required,
        active: draft.active,
        show_in_list: draft.show_in_list,
        show_in_detail: draft.show_in_detail,
        show_in_create: draft.show_in_create,
        show_in_edit: draft.show_in_edit,
        searchable: draft.searchable && supports(draft.field_type, "searchable"),
        filterable: draft.filterable && supports(draft.field_type, "filterable"),
        sortable: draft.sortable && supports(draft.field_type, "sortable"),
        reportable: draft.reportable && supports(draft.field_type, "reportable"),
        unique_value: draft.unique_value && supports(draft.field_type, "unique"),
        validation_rules: draft.validation_rules,
        default_value: supports(draft.field_type, "default")
          ? (fromFormValue(preview, draft.default_value) ?? null)
          : null,
      };
      if (!system) {
        input.field_type = draft.field_type;
        input.relation_entity = draft.field_type === "relation" ? draft.relation_entity : null;
      }
      const addInitialOptions = async (fieldId: string) => {
        const labels = [
          ...new Set(
            initialOptions
              .split("\n")
              .map((l) => l.trim())
              .filter(Boolean),
          ),
        ];
        for (const [index, label] of labels.entries())
          await createOption(fieldId, label, (index + 1) * 10);
      };
      if (creating) {
        const created = await createField(entity, {
          ...input,
          field_key: draft.field_key,
          sort_order: ((config.fields[entity].at(-1)?.sort_order ?? 0) as number) + 10,
        });
        if (isSelectType(draft.field_type)) await addInitialOptions(created.id);
        return created;
      }
      const updated = await updateField(field!.id, input);
      if (isSelectType(draft.field_type) && !isSelectType(field!.field_type))
        await addInitialOptions(updated.id);
      return updated;
    },
    onSuccess: async () => {
      await invalidate();
      toast.success(creating ? "Field created." : "Field saved.");
      onClose();
    },
    onError: (error) => {
      const mapped = toAdminError(error);
      setErrors(mapped.fieldErrors);
    },
  });

  const submit = () => {
    const next: Record<string, string> = {};
    if (!draft.label.trim()) next.label = "Enter a label";
    if (creating) {
      const keyProblem = fieldKeyError(draft.field_key, takenKeys);
      if (keyProblem) next.field_key = keyProblem;
    }
    if (draft.field_type === "relation" && !draft.relation_entity)
      next.relation_entity = "Choose the linked entity";
    if (supports(draft.field_type, "default")) {
      const value = fromFormValue(preview, draft.default_value);
      if (value !== null) {
        const options = field ? config.options[field.id] : [];
        const result = checkFieldValue(preview, value, { options });
        if (result.error) next.default_value = result.error;
      }
    }
    if (
      draft.required &&
      !draft.show_in_create &&
      !(supports(draft.field_type, "default") && draft.default_value)
    ) {
      next.show_in_create = "A required field must be in the create form or have a default value";
    }
    setErrors(next);
    if (!Object.keys(next).length) save.mutate();
  };

  const typeLocked = system || (!creating && usage > 0);
  const typeOptions = Object.entries(FIELD_TYPES).filter(
    ([type]) => creating || !typeLocked || isSafeTypeChange(field!.field_type, type as FieldType),
  );

  return (
    <Dialog
      open={open}
      wide
      busy={save.isPending}
      onClose={onClose}
      title={
        creating
          ? `New field · ${config.entities[entity]?.display_name}`
          : `Edit field · ${field!.label}`
      }
      onSubmit={submit}
      footer={
        <>
          <Button onClick={onClose} disabled={save.isPending}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" loading={save.isPending}>
            {creating ? "Create field" : "Save field"}
          </Button>
        </>
      }
    >
      {system ? (
        <Alert title="System field">
          Bound to the <span className="a-mono">{field!.binding_key}</span> column used by dispatch,
          the calendar or integrity rules. You can rename it and change how it is shown; it cannot
          be removed or change type.
        </Alert>
      ) : null}
      <FormError error={save.error && !Object.keys(errors).length ? save.error : null} />

      <fieldset className="a-fieldset">
        <legend>Basics</legend>
        <div className="a-form-grid">
          <Field label="Label" required error={errors.label}>
            <Input
              value={draft.label}
              maxLength={120}
              autoFocus
              onChange={(e) => {
                const label = e.target.value;
                setDraft((d) => ({
                  ...d,
                  label,
                  field_key:
                    creating && !keyEdited ? fieldKeyFromLabel(label, takenKeys) : d.field_key,
                }));
              }}
            />
          </Field>
          <Field
            label={<>Key {creating ? null : <Lock size={12} aria-label="locked" />}</>}
            error={errors.field_key}
            help={
              creating
                ? "Stable internal identifier. It cannot change later."
                : "Keys never change, so stored data stays linked."
            }
          >
            <Input
              className="a-mono"
              value={draft.field_key}
              disabled={!creating}
              maxLength={63}
              onChange={(e) => {
                setKeyEdited(true);
                set("field_key", e.target.value.toLowerCase());
              }}
            />
          </Field>
          <Field
            label="Type"
            error={errors.field_type}
            help={
              system
                ? "System fields keep their type."
                : !creating && usage > 0
                  ? `${usage} records hold values: only compatible types are offered.`
                  : FIELD_TYPES[draft.field_type].description
            }
          >
            <Select
              value={draft.field_type}
              disabled={system}
              onChange={(e) => {
                const type = e.target.value as FieldType;
                setDraft((d) => ({
                  ...d,
                  field_type: type,
                  validation_rules: {},
                  default_value: null,
                  searchable: d.searchable && supports(type, "searchable"),
                  filterable: d.filterable && supports(type, "filterable"),
                  sortable: d.sortable && supports(type, "sortable"),
                  reportable: d.reportable && supports(type, "reportable"),
                  unique_value: d.unique_value && supports(type, "unique"),
                }));
              }}
            >
              {FIELD_TYPE_GROUPS.map((group) => {
                const items = typeOptions.filter(([, info]) => info.group === group);
                return items.length ? (
                  <optgroup key={group} label={group}>
                    {items.map(([type, info]) => (
                      <option key={type} value={type}>
                        {info.label}
                      </option>
                    ))}
                  </optgroup>
                ) : null;
              })}
            </Select>
          </Field>
          {draft.field_type === "relation" ? (
            <Field label="Links to" required error={errors.relation_entity}>
              <Select
                value={draft.relation_entity ?? ""}
                disabled={system || (!creating && usage > 0)}
                onChange={(e) =>
                  set("relation_entity", (e.target.value || null) as EntityKey | null)
                }
              >
                <option value="">Choose…</option>
                {ENTITY_KEYS.map((key) => (
                  <option key={key} value={key}>
                    {config.entities[key]?.plural_display_name ?? key}
                  </option>
                ))}
              </Select>
            </Field>
          ) : null}
          <Field label="Help text" help="Shown under the input." wide>
            <Input
              value={draft.help_text}
              maxLength={500}
              onChange={(e) => set("help_text", e.target.value)}
            />
          </Field>
          <Field label="Placeholder">
            <Input
              value={draft.placeholder}
              maxLength={200}
              onChange={(e) => set("placeholder", e.target.value)}
            />
          </Field>
          <Field label="Description" help="Internal note for administrators.">
            <Textarea
              rows={2}
              value={draft.description}
              maxLength={1000}
              onChange={(e) => set("description", e.target.value)}
            />
          </Field>
        </div>
      </fieldset>

      <fieldset className="a-fieldset">
        <legend>Rules</legend>
        <div className="a-row" style={{ gap: 20 }}>
          <Switch
            label="Required"
            checked={draft.required}
            disabled={system && field?.binding_key === "customer_id"}
            onChange={(v) => set("required", v)}
          />
          {supports(draft.field_type, "unique") ? (
            <Switch
              label="Unique value"
              description="No two records may share a value."
              checked={draft.unique_value}
              onChange={(v) => set("unique_value", v)}
            />
          ) : null}
          {!system ? (
            <Switch
              label="Enabled"
              description="Disabled fields leave forms and lists; values are kept."
              checked={draft.active}
              onChange={(v) => set("active", v)}
            />
          ) : null}
        </div>
        {errors.unique_value ? <p className="a-error-text">{errors.unique_value}</p> : null}
        {errors.required ? <p className="a-error-text">{errors.required}</p> : null}
        <RulesEditor
          type={draft.field_type}
          rules={draft.validation_rules}
          onChange={(rules) => set("validation_rules", rules)}
          error={errors.validation_rules}
        />
        {supports(draft.field_type, "default") && !system ? (
          <div className="a-form-grid">
            {!isSelectType(draft.field_type) || !creating ? (
              <FieldControl
                def={{ ...preview, help_text: "Pre-filled when a record is created." }}
                value={draft.default_value}
                options={field ? config.options[field.id] : []}
                error={errors.default_value}
                onChange={(value) => set("default_value", value)}
              />
            ) : (
              <p className="a-help">Save the field first, then choose a default option.</p>
            )}
          </div>
        ) : null}
      </fieldset>

      <fieldset className="a-fieldset">
        <legend>Where it appears</legend>
        <div className="a-row" style={{ gap: 20 }}>
          {VISIBILITY.map((v) => (
            <Switch
              key={v.key}
              label={v.label}
              checked={draft[v.key]}
              disabled={
                field?.read_only && (v.key === "show_in_create" || v.key === "show_in_edit")
              }
              onChange={(checked) => set(v.key, checked)}
            />
          ))}
        </div>
        {errors.show_in_create ? <p className="a-error-text">{errors.show_in_create}</p> : null}
      </fieldset>

      <fieldset className="a-fieldset">
        <legend>Search, filters and reports</legend>
        <div className="a-form-grid">
          {CAPABILITIES.map((c) => {
            const available = supports(draft.field_type, c.cap);
            return (
              <div key={c.key}>
                <Switch
                  label={c.label}
                  description={
                    available
                      ? c.help
                      : `Not available for ${FIELD_TYPES[draft.field_type].label.toLowerCase()} fields.`
                  }
                  checked={available && draft[c.key]}
                  disabled={!available}
                  onChange={(checked) => set(c.key, checked)}
                />
                {errors[c.key] ? <p className="a-error-text">{errors[c.key]}</p> : null}
              </div>
            );
          })}
        </div>
      </fieldset>

      {isSelectType(draft.field_type) ? (
        <fieldset className="a-fieldset">
          <legend>Options</legend>
          {creating || !isSelectType(field!.field_type) ? (
            <Field
              label="Initial options"
              help="One per line. You can add, rename, reorder and archive options later."
            >
              <Textarea
                rows={4}
                value={initialOptions}
                onChange={(e) => setInitialOptions(e.target.value)}
              />
            </Field>
          ) : (
            <OptionsEditor field={field!} />
          )}
        </fieldset>
      ) : null}
    </Dialog>
  );
}
