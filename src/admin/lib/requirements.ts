import type { FieldDefinition, FieldOption } from "./fields/types";

/** A vehicle option that requires the driver to have one of several options. */
export interface DispatchRequirement {
  id: string;
  vehicle_option_id: string;
  driver_option_id: string;
}

interface ConfigLike {
  fields: { vehicle: FieldDefinition[]; driver: FieldDefinition[] };
  options: Record<string, FieldOption[]>;
  fieldById: Record<string, FieldDefinition>;
}

function values(raw: unknown): string[] {
  if (typeof raw === "string") return [raw];
  if (Array.isArray(raw)) return raw.filter((v): v is string => typeof v === "string");
  return [];
}

/**
 * Requirements a driver does not meet for a vehicle, as readable sentences
 * (e.g. 'Vehicle type "Articolato" needs License categories: CE').
 * Advisory: the panel warns, it does not block.
 */
export function requirementIssues(
  config: ConfigLike,
  requirements: readonly DispatchRequirement[],
  vehicleAttributes: Record<string, unknown> | null | undefined,
  driverAttributes: Record<string, unknown> | null | undefined,
): string[] {
  if (!requirements.length || !vehicleAttributes || !driverAttributes) return [];
  const optionById = new Map<string, FieldOption>();
  for (const list of Object.values(config.options)) for (const option of list) optionById.set(option.id, option);

  const accepted = new Map<string, string[]>();
  for (const r of requirements) accepted.set(r.vehicle_option_id, [...(accepted.get(r.vehicle_option_id) ?? []), r.driver_option_id]);

  const issues: string[] = [];
  for (const vehicleField of config.fields.vehicle) {
    if (vehicleField.field_type !== "single_select" && vehicleField.field_type !== "multi_select") continue;
    for (const vehicleOptionId of values(vehicleAttributes[vehicleField.field_key])) {
      const driverOptionIds = accepted.get(vehicleOptionId);
      if (!driverOptionIds?.length) continue;
      const driverField = config.fieldById[optionById.get(driverOptionIds[0]!)?.field_id ?? ""];
      if (!driverField) continue;
      const driverHas = values(driverAttributes[driverField.field_key]);
      if (driverOptionIds.some((id) => driverHas.includes(id))) continue;
      const vehicleLabel = optionById.get(vehicleOptionId)?.label ?? "?";
      const needed = driverOptionIds.map((id) => optionById.get(id)?.label ?? "?").join(" or ");
      issues.push(`${vehicleField.label} "${vehicleLabel}" needs ${driverField.label}: ${needed}`);
    }
  }
  return issues;
}
