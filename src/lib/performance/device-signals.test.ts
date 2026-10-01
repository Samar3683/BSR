import { describe, expect, it } from "vitest";

import { isSoftwareRenderer } from "./device-signals";

describe("software renderer detection (only used to reject CPU rendering)", () => {
  it("recognises software rasterisers", () => {
    expect(
      isSoftwareRenderer(
        "ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero)), SwiftShader driver)",
      ),
    ).toBe(true);
    expect(isSoftwareRenderer("llvmpipe (LLVM 15.0.7, 256 bits)")).toBe(true);
    expect(isSoftwareRenderer("Google SwiftShader")).toBe(true);
  });

  it("does not flag hardware or masked renderer names", () => {
    expect(
      isSoftwareRenderer("ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11 vs_5_0 ps_5_0, D3D11)"),
    ).toBe(false);
    expect(isSoftwareRenderer("Apple GPU")).toBe(false);
    expect(isSoftwareRenderer("WebKit WebGL")).toBe(false);
    expect(isSoftwareRenderer("")).toBe(false);
  });
});
