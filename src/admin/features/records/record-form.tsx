"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { Plus, Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";

import { DEFAULT_COUNTRY, FieldControl } from "../../components/fields/field-control";
import { Button, ButtonLink } from "../../components/ui/button";
import { Alert, ErrorState, LoadingState } from "../../components/ui/feedback";
import { Segmented, Switch } from "../../components/ui/form";
import { PageHeader } from "../../components/ui/layout";
import { useToast } from "../../components/ui/toast";
import { useAdminConfig, useInvalidateData } from "../../hooks/use-admin-config";
import { toAdminError } from "../../lib/errors";
import type {
  AddressValue,
  EntityKey,
  EntityRecord,
  FieldDefinition,
  FormMode,
} from "../../lib/fields/types";
import { groupBySection } from "../../lib/fields/sections";
import { validateForm } from "../../lib/fields/validate";
import {
  buildRecordPayload,
  fromFormValue,
  initialFormValues,
  recordValue,
  type DateTimeParts,
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
    return (
      <div className="a-page">
        <ErrorState
          error={recordQuery.error}
          onRetry={() => recordQuery.refetch()}
          back={{ href: ENTITY_PATHS[entity], label: `Back to ${entity}s` }}
        />
      </div>
    );
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

  const freshValues = () => {
    const base = initialFormValues(fields, record);
    if (mode === "create") {
      // New addresses start in Italy.
      for (const def of fields) {
        if (
          def.field_type === "address" &&
          !Object.keys(base[def.field_key] as AddressValue).length
        )
          base[def.field_key] = { country: DEFAULT_COUNTRY };
      }
    }
    return base;
  };
  const [values, setValues] = useState<Record<string, FormValue>>(freshValues);
  const baseline = useRef(JSON.stringify(values));
  const leaving = useRef(false);
  const another = useRef(false);
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
      if (another.current) {
        // Stay on the form for the next one.
        const next = freshValues();
        baseline.current = JSON.stringify(next);
        setValues(next);
        setErrors({});
        setStatus("confirmed");
        window.scrollTo({ top: 0 });
        document.querySelector<HTMLElement>(".adm form input:not([disabled])")?.focus();
        return;
      }
      leaving.current = true;
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

  const pickupField = fields.find((f) => f.binding_key === "pickup_at");
  const deliveryField = fields.find((f) => f.binding_key === "delivery_at");
  const pickupAddress = fields.find((f) => f.field_key === "pickup_address");

  /** Delivery day follows the pickup day until someone sets it. */
  const applyDefaults = (
    def: FieldDefinition,
    value: FormValue,
    current: Record<string, FormValue>,
  ): Record<string, FormValue> => {
    const next = { ...current, [def.field_key]: value };
    if (entity === "order" && pickupField && deliveryField && def.id === pickupField.id) {
      const pickup = value as DateTimeParts;
      const delivery = (current[deliveryField.field_key] as DateTimeParts) ?? {
        date: "",
        time: "",
      };
      if (pickup.date && (!delivery.date || delivery.date < pickup.date)) {
        next[deliveryField.field_key] = { ...delivery, date: pickup.date };
      }
    }
    return next;
  };

  /** A chosen customer's address becomes the pickup address (when still empty). */
  const prefillPickup = async (customerId: FormValue) => {
    if (typeof customerId !== "string" || !customerId || !pickupAddress) return;
    try {
      const customer = await getRecord("customer", customerId);
      const address = customer.attributes?.address as AddressValue | undefined;
      if (!address || !Object.values(address).some(Boolean)) return;
      setValues((current) => {
        const existing = (current[pickupAddress.field_key] as AddressValue) ?? {};
        const typed = Object.entries(existing).some(
          ([k, v]) => v && !(k === "country" && v === DEFAULT_COUNTRY),
        );
        return typed
          ? current
          : { ...current, [pickupAddress.field_key]: { country: DEFAULT_COUNTRY, ...address } };
      });
    } catch {
      // The prefill is a convenience; the form works without it.
    }
  };

  const dirty = JSON.stringify(values) !== baseline.current;
  useEffect(() => {
    if (!dirty) return;
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (leaving.current) return;
      event.preventDefault();
    };
    // In-app links: ask before dropping edits.
    const onClick = (event: MouseEvent) => {
      if (leaving.current || event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey) return;
      const link = (event.target as HTMLElement).closest?.("a[href]") as HTMLAnchorElement | null;
      if (!link || link.target === "_blank" || !link.href.startsWith(window.location.origin))
        return;
      if (link.href === window.location.href) return;
      if (!window.confirm("You have unsaved changes. Leave this page and discard them?")) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    window.addEventListener("beforeunload", beforeUnload);
    document.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      document.removeEventListener("click", onClick, true);
    };
  }, [dirty]);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLElement | null;
    another.current = submitter?.dataset.another === "true";
    const submitted = Object.fromEntries(
      fields.map((f) => {
        let value = values[f.field_key];
        if (f.field_type === "address") {
          // A bare default country is not an address.
          const parts = Object.entries(value as AddressValue).filter(([, v]) => v?.trim());
          if (parts.length === 1 && parts[0]![0] === "country" && parts[0]![1] === DEFAULT_COUNTRY)
            value = {};
        }
        return [f.field_key, fromFormValue(f, value)];
      }),
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
          {groupBySection(fields).map((section) => (
            <div key={section.name ?? "_"} className="a-form-section">
              {section.name ? <h2 className="a-section-title">{section.name}</h2> : null}
              <div className="a-form-grid">
                {section.fields.map((def) => (
                  <FieldControl
                    key={def.id}
                    def={def}
                    value={values[def.field_key] ?? null}
                    options={config.options[def.id]}
                    storedValue={record ? recordValue(def, record) : undefined}
                    error={errors[def.field_key]}
                    disabled={save.isPending || Boolean(record?.archived_at)}
                    onChange={(value) => {
                      setValues((current) => applyDefaults(def, value, current));
                      if (mode === "create" && def.binding_key === "customer_id")
                        void prefillPickup(value);
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
            </div>
          ))}
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
          {mode === "create" ? (
            <Button
              type="submit"
              data-another="true"
              disabled={save.isPending || !entityConfig?.active}
            >
              <Plus aria-hidden="true" />
              Save and create another
            </Button>
          ) : null}
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
