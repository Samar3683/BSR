import { describe, expect, it } from "vitest";

import { STATUS_DEFINITIONS } from "./status-badge";

describe("status grammar", () => {
  it("gives every status its own icon, so meaning never relies on colour", () => {
    const icons = Object.values(STATUS_DEFINITIONS).map((definition) => definition.icon);
    expect(new Set(icons).size).toBe(icons.length);
  });
});
