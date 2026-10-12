"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";

import { EmptyState, ErrorState, LoadingState } from "../../components/ui/feedback";
import { Field, Select } from "../../components/ui/form";
import { Panel } from "../../components/ui/layout";
import { useToast } from "../../components/ui/toast";
import { useAdminConfig } from "../../hooks/use-admin-config";
import { toAdminError } from "../../lib/errors";
import type { FieldDefinition } from "../../lib/fields/types";
import { addRequirement, fetchRequirements, removeRequirement } from "../../services/operations";

const isSelect = (field: FieldDefinition) =>
  !field.archived_at && (field.field_type === "single_select" || field.field_type === "multi_select");

/**
 * Which driver qualifications each kind of vehicle needs, e.g. vehicle type
 * "Articolato" → licence CE. Dispatch warns when the chosen driver has none
 * of the ticked options; it does not block the assignment.
 */
export function DispatchRules() {
  const { data: config, isLoading, error, refetch } = useAdminConfig();
  const client = useQueryClient();
  const toast = useToast();
  const requirements = useQuery({ queryKey: ["dispatch-requirements"], queryFn: fetchRequirements });

  const vehicleFields = config?.fields.vehicle.filter(isSelect) ?? [];
  const driverFields = config?.fields.driver.filter(isSelect) ?? [];
  const [vehicleFieldId, setVehicleFieldId] = useState<string | null>(null);
  const [driverFieldId, setDriverFieldId] = useState<string | null>(null);
  const vehicleField =
    vehicleFields.find((f) => f.id === vehicleFieldId) ??
    vehicleFields.find((f) => /type|tipo/i.test(f.field_key)) ??
    vehicleFields[0];
  const driverField =
    driverFields.find((f) => f.id === driverFieldId) ??
    driverFields.find((f) => /licen|patent/i.test(f.field_key)) ??
    driverFields[0];

  const toggle = useMutation({
    mutationFn: ({ vehicle, driver, on }: { vehicle: string; driver: string; on: boolean }) =>
      on ? addRequirement(vehicle, driver) : removeRequirement(vehicle, driver),
    onSuccess: () => client.invalidateQueries({ queryKey: ["dispatch-requirements"] }),
    onError: (e) => toast.error(toAdminError(e).message),
  });

  if (error) return <ErrorState error={error} onRetry={() => refetch()} />;
  if (requirements.error)
    return <ErrorState error={requirements.error} onRetry={() => requirements.refetch()} />;
  if (isLoading || requirements.isLoading || !config) return <LoadingState />;

  if (!vehicleField || !driverField) {
    return (
      <EmptyState
        title="No select fields to match"
        message="Dispatch rules link an option of a vehicle select field (such as vehicle type) to options of a driver select field (such as licence categories)."
        actions={
          <Link className="a-btn a-btn--primary" href="/admin/settings/fields">
            Open field settings
          </Link>
        }
      />
    );
  }

  const vehicleOptions = (config.options[vehicleField.id] ?? []).filter((o) => !o.archived_at);
  const driverOptions = (config.options[driverField.id] ?? []).filter((o) => !o.archived_at);
  const rows = requirements.data ?? [];
  const has = (vehicle: string, driver: string) =>
    rows.some((r) => r.vehicle_option_id === vehicle && r.driver_option_id === driver);
  /** Rules for a vehicle option must all use one driver field. */
  const otherField = (vehicle: string) => {
    const first = rows.find((r) => r.vehicle_option_id === vehicle);
    if (!first) return null;
    for (const field of config.fields.driver) {
      if (field.id === driverField.id) continue;
      if ((config.options[field.id] ?? []).some((o) => o.id === first.driver_option_id)) return field;
    }
    return null;
  };

  return (
    <div className="a-stack">
      <Panel title="Dispatch rules">
        <p className="a-muted" style={{ marginBottom: 14 }}>
          Tick the {driverField.label.toLowerCase()} that qualify a driver for each{" "}
          {vehicleField.label.toLowerCase()}. A driver qualifies with any one ticked option; rows
          with nothing ticked accept every driver. Dispatch shows a warning when a pair does not
          qualify — it never blocks the assignment.
        </p>
        <div className="a-form-grid" style={{ maxWidth: 640 }}>
          <Field label="Vehicle field">
            <Select value={vehicleField.id} onChange={(e) => setVehicleFieldId(e.target.value)}>
              {vehicleFields.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Driver field">
            <Select value={driverField.id} onChange={(e) => setDriverFieldId(e.target.value)}>
              {driverFields.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.label}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </Panel>

      <Panel title={`${vehicleField.label} → ${driverField.label}`} flush>
        {!vehicleOptions.length || !driverOptions.length ? (
          <EmptyState
            title="No options yet"
            message={`Add options to ${!vehicleOptions.length ? vehicleField.label : driverField.label} first.`}
          />
        ) : (
          <div className="a-table-wrap">
            <table className="a-table a-matrix">
              <caption className="a-sr-only">
                {driverField.label} required for each {vehicleField.label}
              </caption>
              <thead>
                <tr>
                  <th scope="col">{vehicleField.label}</th>
                  {driverOptions.map((o) => (
                    <th key={o.id} scope="col" className="a-matrix-col">
                      {o.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {vehicleOptions.map((vehicle) => {
                  const other = otherField(vehicle.id);
                  return (
                    <tr key={vehicle.id}>
                      <th scope="row">
                        {vehicle.label}
                        {other ? (
                          <span className="a-help" style={{ display: "block" }}>
                            Has rules on {other.label}; clear them there first.
                          </span>
                        ) : null}
                      </th>
                      {driverOptions.map((driver) => {
                        const checked = has(vehicle.id, driver.id);
                        return (
                          <td key={driver.id} className="a-matrix-col">
                            <input
                              type="checkbox"
                              checked={checked}
                              disabled={Boolean(other) || toggle.isPending}
                              aria-label={`${vehicle.label} accepts ${driver.label}`}
                              onChange={() =>
                                toggle.mutate({ vehicle: vehicle.id, driver: driver.id, on: !checked })
                              }
                            />
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
