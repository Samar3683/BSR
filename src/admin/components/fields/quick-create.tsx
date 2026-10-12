"use client";

import { useMutation } from "@tanstack/react-query";
import { useState } from "react";

import { useAdminConfig, useInvalidateData } from "../../hooks/use-admin-config";
import { toAdminError } from "../../lib/errors";
import type { EntityKey, EntityRecord, FieldDefinition } from "../../lib/fields/types";
import { validateForm } from "../../lib/fields/validate";
import {
  buildRecordPayload,
  fromFormValue,
  initialFormValues,
  type FormValue,
} from "../../lib/fields/values";
import { formFields } from "../../services/config";
import { createRecord } from "../../services/records";
import { Button } from "../ui/button";
import { Dialog } from "../ui/dialog";
import { Alert } from "../ui/feedback";
import { FieldControl } from "./field-control";

/**
 * Creates a related record without leaving the form: only the required
 * fields of the entity are asked for; the rest can be filled in later.
 */
export function QuickCreateDialog({
  entity,
  term,
  onClose,
  onCreated,
}: {
  entity: EntityKey;
  term: string;
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const { data: config } = useAdminConfig();
  const invalidate = useInvalidateData();
  const fields: FieldDefinition[] = config
    ? formFields(config, entity, "create").filter((f) => f.required)
    : [];
  const [values, setValues] = useState<Record<string, FormValue>>(() => ({}));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  const initial = initialFormValues(fields, null);
  const current = (def: FieldDefinition): FormValue => {
    if (def.field_key in values) return values[def.field_key] ?? null;
    // Pre-fill the first text field with what was typed in the picker.
    if (term && def.id === fields.find((f) => f.field_type === "short_text")?.id) return term;
    return initial[def.field_key] ?? null;
  };

  const create = useMutation({
    mutationFn: (payload: {
      columns: Record<string, unknown>;
      attributes: Record<string, unknown>;
    }) => createRecord<EntityRecord>(entity, payload),
    onSuccess: async (record) => {
      await invalidate();
      onCreated(record.id);
    },
    onError: (error) => {
      const mapped = toAdminError(error);
      setErrors(mapped.fieldErrors);
      setFormError(mapped.message);
    },
  });

  const onSubmit = () => {
    if (!config) return;
    setFormError(null);
    const submitted = Object.fromEntries(
      fields.map((f) => [f.field_key, fromFormValue(f, current(f))]),
    );
    const result = validateForm(fields, submitted, "create", {
      optionsByField: config.options,
      oldValues: {},
    });
    setErrors(result.errors);
    if (Object.keys(result.errors).length) return;
    create.mutate(buildRecordPayload(fields, result.values));
  };

  const name = config?.entities[entity]?.display_name ?? entity;
  return (
    <Dialog
      open
      title={`New ${name.toLowerCase()}`}
      onClose={onClose}
      busy={create.isPending}
      footer={
        <>
          <Button onClick={onClose} disabled={create.isPending}>
            Cancel
          </Button>
          <Button variant="primary" loading={create.isPending} onClick={onSubmit}>
            Create {name.toLowerCase()}
          </Button>
        </>
      }
    >
      <div
        className="a-form"
        onKeyDown={(event) => {
          // This dialog sits inside the record form: Enter must not submit that one.
          if (event.key === "Enter" && (event.target as HTMLElement).tagName === "INPUT") {
            event.preventDefault();
            onSubmit();
          }
        }}
      >
        {formError ? <Alert tone="error">{formError}</Alert> : null}
        <p className="a-help">Only the required details. You can complete the rest later.</p>
        <div className="a-form-grid">
          {fields.map((def) => (
            <FieldControl
              key={def.id}
              def={def}
              value={current(def)}
              options={config?.options[def.id]}
              error={errors[def.field_key]}
              disabled={create.isPending}
              onChange={(value) => setValues((v) => ({ ...v, [def.field_key]: value }))}
            />
          ))}
        </div>
      </div>
    </Dialog>
  );
}
