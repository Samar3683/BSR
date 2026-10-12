import { describe, expect, it } from "vitest";

import { groupBySection } from "./sections";
import type { FieldDefinition } from "./types";

const f = (field_key: string, section: string | null) =>
  ({ field_key, section }) as FieldDefinition;

describe("groupBySection", () => {
  it("keeps the configured order and gathers sections by first appearance", () => {
    const groups = groupBySection([
      f("a", "Route"),
      f("b", null),
      f("c", "Route"),
      f("d", " Cargo "),
    ]);
    expect(groups.map((g) => [g.name, g.fields.map((x) => x.field_key)])).toEqual([
      ["Route", ["a", "c"]],
      [null, ["b"]],
      ["Cargo", ["d"]],
    ]);
  });
});
