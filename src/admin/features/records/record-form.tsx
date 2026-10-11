"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { FieldControl } from "../../components/fields/field-control";
import { Button, ButtonLink } from "../../components/ui/button";
import { Alert, ErrorState, LoadingState } from "../../components/ui/feedback";
import { Segmented, Switch } from "../../components/ui/form";
import { PageHeader } from "../../components/ui/layout";
import { useToast } from "../../components/ui/toast";
import { useAdminConfig, useInvalidateData } from "../../hooks/use-admin-config";
import { toAdminError } from "../../lib/errors";
import type { EntityKey, EntityRecord, FieldDefinition, FormMode } from "../../lib/fields/types";
import { validateForm } from "../../lib/fields/validate";
import {
  buildRecordPayload,
  fromFormValue,
  initialFormValues,
  recordValue,
  type FormValue,
} from "../../lib/fields/values";
import { formFields, type AdminConfig } from "../../services/config";
import { createRecord, ENTITY_PATHS, getRecord, updateRecord } from "../../services/records";

export function RecordFormView({ entity, id }: { entity: EntityKey; id?: string }) {
  const mode: FormMode = id ? "edit" : "create";
  const configQuery = useAdminConfig();
  const recordQuery = useQuery({
    queryKey: ["record", entity, id],
    queryFn: () => getRecord(entity, id!),
    enabled: Boolean(id),
  });

  if (configQuery.isError)
    return <ErrorState error={configQuery.error} onRetry={() => configQuery.refetch()} />;
  if (recordQuery.isError)
    return <ErrorState error={recordQuery.error} onRetry={() => recordQuery.refetch()} />;
  const config = configQuery.data;
  if (!config || (id && !recordQuery.data)) return <LoadingState />;

  return (
    <RecordForm
      // Re-initialise when the stored record changes.
      key={`${id ?? "new"}:${recordQuery.data?.updated_at ?? ""}`}
      entity={entity}
      mode={mode}
      config={config}
      fields={formFields(config, entity, mode)}
      record={recordQuery.data ?? null}
    />
  );
}

function RecordForm({
  entity,
  mode,
  config,
  fields,
  record,
}: {
  entity: EntityKey;
  mode: FormMode;
  config: AdminConfig;
  fields: FieldDefinition[];
  record: EntityRecord | null;
}) {
  const router = useRouter();
  const toast = useToast();
  const invalidate = useInvalidateData();
  const entityConfig = config.entities[entity];
  const singular = entityConfig?.display_name ?? entity;
  const basePath = ENTITY_PATHS[entity];

  const [values, setValues] = useState<Record<string, FormValue>>(() =>
    initialFormValues(fields, record),
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [status, setStatus] = useState<"confirmed" | "draft">("confirmed");
  const [available, setAvailable] = useState<boolean>(record ? Boolean(record.available) : true);

  const save = useMutation({
    mutationFn: async (payload: {
      columns: Record<string, unknown>;
      attributes: Record<string, unknown>;
    }) =>
      mode === "create" ? createRecord(entity, payload) : updateRecord(entity, record!.id, payload),
    onSuccess: async (saved) => {
      await invalidate();
      toast.success(mode === "create" ? `${singular} created.` : "Changes saved.");
      router.push(`${basePath}/${(saved as EntityRecord).id}`);
    },
    onError: (error) => {
      const mapped = toAdminError(error);
      if (mapped.kind === "validation" && Object.keys(mapped.fieldErrors).length) {
        setErrors(mapped.fieldErrors);
        const known = Object.keys(mapped.fieldErrors).every((key) =>
          fields.some((f) => f.field_key === key),
        );
        setFormError(known ? "Some fields need attention." : mapped.message);
        focusFirstError();
      } else {
        setFormError(mapped.message);
      }
    },
  });

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    const submitted = Object.fromEntries(
      fields.map((f) => [f.field_key, fromFormValue(f, values[f.field_key])]),
    );
    const oldValues = record
      ? Object.fromEntries(fields.map((f) => [f.field_key, recordValue(f, record)]))
      : {};
    const result = validateForm(fields, submitted, mode, {
      optionsByField: config.options,
      oldValues,
    });

    // Orders: the planned window must end after it starts (also a DB constraint).
    if (entity === "order") {
      const pickup = fields.find((f) => f.binding_key === "pickup_at");
      const delivery = fields.find((f) => f.binding_key === "delivery_at");
      const from = pickup ? (result.values[pickup.field_key] as string | null) : null;
      const to = delivery ? (result.values[delivery.field_key] as string | null) : null;
      if (delivery && from && to && Date.parse(to) <= Date.parse(from)) {
        result.errors[delivery.field_key] = "Must be after the pickup";
      }
    }

    setErrors(result.errors);
    if (Object.keys(result.errors).length) {
      setFormError("Some fields need attention.");
      focusFirstError();
      return;
    }
    const payload = buildRecordPayload(fields, result.values);
    if (entity === "order" && mode === "create") payload.columns.status = status;
    if (entity === "driver" || entity === "vehicle") payload.columns.available = available;
    save.mutate(payload);
  }

  const title =
    mode === "create"
      ? `New ${singular.toLowerCase()}`
      : `Edit ${record?.display_name ?? singular}`;

  return (
    <div className="a-page">
      <PageHeader
        title={title}
        back={
          mode === "create"
            ? { href: basePath, label: entityConfig?.plural_display_name ?? "Back" }
            : { href: `${basePath}/${record!.id}`, label: record!.display_name }
        }
      />
      {mode === "create" && !entityConfig?.active ? (
        <Alert tone="error">
          New {entityConfig?.plural_display_name.toLowerCase()} cannot be created while the entity
          is disabled in Settings.
        </Alert>
      ) : null}
      {record?.archived_at ? (
        <Alert tone="error">This record is archived. Restore it before editing.</Alert>
      ) : null}

      <form className="a-panel" onSubmit={onSubmit} noValidate aria-label={title}>
        <div className="a-panel-body a-form">
          {formError ? <Alert tone="error">{formError}</Alert> : null}
          {entity === "order" && mode === "create" ? (
            <div className="a-field">
              <span className="a-label" id="initial-status">
                Initial status
              </span>
              <Segmented
                label="Initial status"
                value={status}
                onChange={setStatus}
                options={[
                  { value: "confirmed", label: "Confirmed — ready for dispatch" },
                  { value: "draft", label: "Draft" },
                ]}
              />
            </div>
          ) : null}
          {fields.length === 0 ? (
            <Alert>
              No fields are shown in this form. Configure the fields of this entity in Settings →
              Fields.
            </Alert>
          ) : null}
          <div className="a-form-grid">
            {fields.map((def) => (
              <FieldControl
                key={def.id}
                def={def}
                value={values[def.field_key] ?? null}
                options={config.options[def.id]}
                storedValue={record ? recordValue(def, record) : undefined}
                error={errors[def.field_key]}
                disabled={save.isPending || Boolean(record?.archived_at)}
                onChange={(value) => {
                  setValues((current) => ({ ...current, [def.field_key]: value }));
                  if (errors[def.field_key]) {
                    setErrors(({ [def.field_key]: _removed, ...rest }) => {
                      void _removed;
                      return rest;
                    });
                  }
                }}
              />
            ))}
          </div>
          {entity === "driver" || entity === "vehicle" ? (
            <Switch
              label="Available for dispatch"
              description="Unavailable resources are not offered when assigning orders."
              checked={available}
              onChange={setAvailable}
              disabled={save.isPending}
            />
          ) : null}
        </div>
        <div className="a-panel-foot">
          <ButtonLink href={mode === "create" ? basePath : `${basePath}/${record!.id}`}>
            Cancel
          </ButtonLink>
          <Button
            type="submit"
            variant="primary"
            loading={save.isPending}
            disabled={Boolean(record?.archived_at) || (mode === "create" && !entityConfig?.active)}
          >
            {save.isPending ? null : <Save aria-hidden="true" />}
            {mode === "create" ? `Create ${singular.toLowerCase()}` : "Save changes"}
          </Button>
        </div>
      </form>
    </div>
  );
}

function focusFirstError() {
  requestAnimationFrame(() => {
    const target = document.querySelector<HTMLElement>('.adm [aria-invalid="true"]');
    target?.focus();
  });
}
