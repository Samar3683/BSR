import { describe, expect, it } from "vitest";

import type { FieldDefinition, FieldOption } from "./fields/types";
import { requirementIssues, type DispatchRequirement } from "./requirements";

const field = (id: string, field_key: string, label: string): FieldDefinition =>
  ({ id, field_key, label, field_type: "single_select" }) as FieldDefinition;
const multi = (id: string, field_key: string, label: string): FieldDefinition =>
  ({ id, field_key, label, field_type: "multi_select" }) as FieldDefinition;
const option = (id: string, field_id: string, label: string): FieldOption =>
  ({ id, field_id, label }) as FieldOption;

const vehicleType = field("vt", "vehicle_type", "Vehicle type");
const licences = multi("lc", "licences", "Licence categories");
const config = {
  fields: { vehicle: [vehicleType], driver: [licences] },
  options: {
    vt: [option("van", "vt", "Furgone"), option("rig", "vt", "Articolato")],
    lc: [option("B", "lc", "B"), option("C", "lc", "C"), option("CE", "lc", "CE")],
  },
  fieldById: { vt: vehicleType, lc: licences },
};
const rules: DispatchRequirement[] = [
  { id: "1", vehicle_option_id: "rig", driver_option_id: "CE" },
  { id: "2", vehicle_option_id: "rig", driver_option_id: "C" },
];

describe("requirementIssues", () => {
  it("is silent when no rule applies", () => {
    expect(requirementIssues(config, rules, { vehicle_type: "van" }, { licences: ["B"] })).toEqual(
      [],
    );
    expect(requirementIssues(config, [], { vehicle_type: "rig" }, { licences: [] })).toEqual([]);
  });

  it("is silent when the driver has any accepted option", () => {
    expect(requirementIssues(config, rules, { vehicle_type: "rig" }, { licences: ["C"] })).toEqual(
      [],
    );
  });

  it("explains what is missing in the configured labels", () => {
    expect(requirementIssues(config, rules, { vehicle_type: "rig" }, { licences: ["B"] })).toEqual([
      'Vehicle type "Articolato" needs Licence categories: CE or C',
    ]);
  });

  it("treats a driver without the field as unqualified", () => {
    expect(requirementIssues(config, rules, { vehicle_type: "rig" }, {})).toHaveLength(1);
  });
});
