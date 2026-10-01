import { describe, expect, it } from "vitest";

import { type DeviceSignals, resolveInitialQuality } from "./quality";

const capableDevice: DeviceSignals = {
  webgl2: true,
  saveData: false,
  deviceMemoryGb: 8,
  logicalCores: 8,
};

describe("resolveInitialQuality", () => {
  it("falls back to the HTML experience without WebGL2", () => {
    expect(resolveInitialQuality({ ...capableDevice, webgl2: false })).toBe("fallback");
  });

  it("honours the user's data-saver preference", () => {
    expect(resolveInitialQuality({ ...capableDevice, saveData: true })).toBe("low");
  });

  it("selects the low tier on constrained memory or CPU", () => {
    expect(resolveInitialQuality({ ...capableDevice, deviceMemoryGb: 2 })).toBe("low");
    expect(resolveInitialQuality({ ...capableDevice, logicalCores: 2 })).toBe("low");
  });

  it("does not treat unavailable signals as weakness", () => {
    expect(
      resolveInitialQuality({ ...capableDevice, deviceMemoryGb: null, logicalCores: null }),
    ).toBe("medium");
  });

  it("never starts at the high tier without runtime evidence", () => {
    expect(resolveInitialQuality({ ...capableDevice, deviceMemoryGb: 32, logicalCores: 24 })).toBe(
      "medium",
    );
  });
});
