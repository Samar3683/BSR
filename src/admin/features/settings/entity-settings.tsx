"use client";

import { useMutation } from "@tanstack/react-query";
import { Save } from "lucide-react";
import { useState } from "react";

import { Button } from "../../components/ui/button";
import { ErrorState, FormError, LoadingState } from "../../components/ui/feedback";
import { Field, Input, Select, Switch } from "../../components/ui/form";
import { Panel } from "../../components/ui/layout";
import { useToast } from "../../components/ui/toast";
import { useAdminConfig, useInvalidateConfig } from "../../hooks/use-admin-config";
import { toAdminError } from "../../lib/errors";
import { PRIMARY_DISPLAY_TYPES } from "../../lib/fields/registry";
import { ENTITY_KEYS, type EntityConfig, type EntityKey } from "../../lib/fields/types";
import { liveFields, updateEntityConfig, type AdminConfig } from "../../services/config";

/** Names, state and primary display field of the four entities. */
export function EntitySettings() {
  const configQuery = useAdminConfig();
  if (configQuery.isError)
    return <ErrorState error={configQuery.error} onRetry={() => configQuery.refetch()} />;
  if (!configQuery.data) return <LoadingState />;
  const config = configQuery.data;
  return (
    <div className="a-grid a-grid--2">
      {ENTITY_KEYS.map((key) => (
        <EntityCard
          key={`${key}:${config.entities[key]?.updated_at}`}
          entity={key}
          config={config}
          current={config.entities[key]!}
        />
      ))}
    </div>
  );
}

function EntityCard({
  entity,
  config,
  current,
}: {
  entity: EntityKey;
  config: AdminConfig;
  current: EntityConfig;
}) {
  const toast = useToast();
  const invalidate = useInvalidateConfig();
  const [displayName, setDisplayName] = useState(current.display_name);
  const [plural, setPlural] = useState(current.plural_display_name);
  const [active, setActive] = useState(current.active);
  const [primary, setPrimary] = useState(current.primary_display_field ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const eligible = liveFields(config, entity).filter((f) =>
    PRIMARY_DISPLAY_TYPES.includes(f.field_type),
  );

  const save = useMutation({
    mutationFn: () =>
      updateEntityConfig(entity, {
        display_name: displayName.trim(),
        plural_display_name: plural.trim(),
        active,
        primary_display_field: primary || null,
      }),
    onSuccess: async () => {
      await invalidate();
      toast.success(`${plural.trim()} settings saved.`);
    },
    onError: (error) => setErrors(toAdminError(error).fieldErrors),
  });

  const dirty =
    displayName !== current.display_name ||
    plural !== current.plural_display_name ||
    active !== current.active ||
    primary !== (current.primary_display_field ?? "");

  return (
    <Panel
      title={current.plural_display_name}
      footer={
        <Button
          variant="primary"
          size="sm"
          disabled={!dirty || !displayName.trim() || !plural.trim()}
          loading={save.isPending}
          onClick={() => {
            setErrors({});
            save.mutate();
          }}
        >
          {save.isPending ? null : <Save aria-hidden="true" />}
          Save
        </Button>
      }
    >
      <div className="a-form">
        <div className="a-form-grid">
          <Field label="Name (singular)" error={errors.display_name}>
            <Input
              value={displayName}
              maxLength={60}
              onChange={(e) => setDisplayName(e.target.value)}
            />
          </Field>
          <Field
            label="Name (plural)"
            help="Used in the navigation and list titles."
            error={errors.plural_display_name}
          >
            <Input value={plural} maxLength={60} onChange={(e) => setPlural(e.target.value)} />
          </Field>
          <Field
            label="Primary display field"
            wide
            help="Names each record in lists, pickers, the calendar and reports."
            error={errors.primary_display_field}
          >
            <Select value={primary} onChange={(e) => setPrimary(e.target.value)}>
              <option value="">Default</option>
              {eligible.map((f) => (
                <option key={f.id} value={f.field_key}>
                  {f.label}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Switch
          label="Active"
          description="When inactive, new records of this entity cannot be created. Existing records stay available."
          checked={active}
          onChange={setActive}
        />
        <FormError error={save.error && !Object.keys(errors).length ? save.error : null} />
      </div>
    </Panel>
  );
}
