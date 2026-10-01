import { describe, expect, it } from "vitest";

import {
  classifyGpu,
  type GpuClass,
  type HeroSignals,
  isPhoneFormFactor,
  resolveHeroRenderPath,
  resolveHeroTier,
  resolveLayoutMode,
} from "./tier-decision";

const desktop: HeroSignals = {
  reducedMotion: false,
  webgl2: true,
  gpu: "unknown",
  maxSamples: 8,
  maxTextureSize: 16384,
  primaryPointerCoarse: false,
  anyPointerFine: true,
  hoverNone: false,
  maxTouchPoints: 0,
  screenShortSide: 1080,
  logicalCores: 12,
  deviceMemoryGb: 16,
  saveData: false,
  effectiveType: "4g",
};

const phone: HeroSignals = {
  ...desktop,
  primaryPointerCoarse: true,
  anyPointerFine: false,
  hoverNone: true,
  maxTouchPoints: 5,
  screenShortSide: 412,
  logicalCores: 8,
  deviceMemoryGb: 8,
};

const tablet: HeroSignals = { ...phone, screenShortSide: 820 };

describe("layout mode and rendering path are independent", () => {
  it("resized short desktop window: short (not compact) layout, still a real-time candidate", () => {
    expect(resolveLayoutMode(1280, 560)).toEqual({ mode: "wide", short: true });
    expect(resolveLayoutMode(1100, 600)).toEqual({ mode: "wide", short: true });
    expect(resolveLayoutMode(1000, 600)).toEqual({ mode: "standard", short: true });
    expect(resolveHeroRenderPath(desktop)).toBe("realtime");
  });

  it("narrow desktop window: compact layout, still real-time (never phone video)", () => {
    expect(resolveLayoutMode(600, 900).mode).toBe("compact");
    expect(isPhoneFormFactor(desktop)).toBe(false);
    expect(resolveHeroRenderPath(desktop)).toBe("realtime");
  });

  it("Pixel-like phone: compact layout, media path", () => {
    expect(resolveLayoutMode(412, 915).mode).toBe("compact");
    expect(resolveHeroRenderPath(phone)).toBe("media");
  });

  it("phone in landscape is still the media path (screen size, not window size)", () => {
    expect(resolveLayoutMode(915, 412)).toEqual({ mode: "standard", short: true });
    expect(resolveHeroRenderPath(phone)).toBe("media");
  });

  it("tablet (landscape and portrait) is a real-time candidate", () => {
    expect(resolveLayoutMode(1180, 820).mode).toBe("standard");
    expect(resolveLayoutMode(820, 1180).mode).toBe("standard");
    expect(resolveHeroRenderPath(tablet)).toBe("realtime");
  });

  it("touchscreen laptop with a mouse is not a phone", () => {
    expect(
      isPhoneFormFactor({
        ...desktop,
        primaryPointerCoarse: true,
        maxTouchPoints: 10,
        screenShortSide: 400,
      }),
    ).toBe(false);
  });

  it("wide layout needs width and a wide aspect", () => {
    expect(resolveLayoutMode(1920, 1080).mode).toBe("wide");
    expect(resolveLayoutMode(1440, 1080).mode).toBe("standard");
  });

  it("reduced motion always wins; no WebGL2 falls back (phones keep media)", () => {
    expect(resolveHeroRenderPath({ ...phone, reducedMotion: true })).toBe("reduced");
    expect(resolveHeroRenderPath({ ...desktop, webgl2: false })).toBe("fallback");
    expect(resolveHeroRenderPath({ ...phone, webgl2: false })).toBe("media");
  });
});

describe("initial tier (signals only, no benchmark)", () => {
  it("strong desktop signals start at high", () => {
    expect(resolveHeroTier(desktop)).toBe("high");
  });

  it("absent memory hints are neutral (Safari/Firefox)", () => {
    expect(resolveHeroTier({ ...desktop, deviceMemoryGb: null })).toBe("high");
  });

  it("weaker desktop signals start at medium", () => {
    expect(resolveHeroTier({ ...desktop, logicalCores: 6 })).toBe("medium");
    expect(resolveHeroTier({ ...desktop, maxSamples: 2 })).toBe("medium");
    expect(resolveHeroTier({ ...desktop, logicalCores: null })).toBe("medium");
  });

  it("constrained devices and slow connections start at low", () => {
    expect(resolveHeroTier({ ...desktop, logicalCores: 4 })).toBe("low");
    expect(resolveHeroTier({ ...desktop, deviceMemoryGb: 4 })).toBe("low");
    expect(resolveHeroTier({ ...desktop, saveData: true })).toBe("low");
    expect(resolveHeroTier({ ...desktop, effectiveType: "3g" })).toBe("low");
  });

  it("tablets never start at high", () => {
    expect(resolveHeroTier(tablet)).toBe("medium");
    expect(resolveHeroTier({ ...tablet, logicalCores: 4 })).toBe("low");
  });

  it("the GPU class caps the tier (weak integrated GPUs never start above low)", () => {
    expect(resolveHeroTier({ ...desktop, gpu: "weak" })).toBe("low");
    expect(resolveHeroTier({ ...desktop, gpu: "integrated" })).toBe("medium");
    expect(resolveHeroTier({ ...desktop, gpu: "integrated", logicalCores: 4 })).toBe("low");
    expect(resolveHeroTier({ ...desktop, gpu: "discrete" })).toBe("high");
    expect(resolveHeroTier({ ...desktop, gpu: "unknown" })).toBe("high");
  });

  it("minimal GPUs get stills from the start (phones keep media)", () => {
    expect(resolveHeroRenderPath({ ...desktop, gpu: "minimal" })).toBe("fallback");
    expect(resolveHeroRenderPath({ ...phone, gpu: "minimal" })).toBe("media");
    expect(resolveHeroRenderPath({ ...desktop, gpu: "weak" })).toBe("realtime");
  });
});

describe("GPU class from the WebGL renderer name", () => {
  const cases: Array<[string, GpuClass]> = [
    // The reference weak GPU (this project's test laptop) and its family.
    ["ANGLE (Intel, Intel(R) UHD Graphics 620 (0x00005917) Direct3D11 vs_5_0 ps_5_0, D3D11)", "weak"],
    ["Mesa Intel(R) UHD Graphics 620 (KBL GT2)", "weak"],
    ["ANGLE (Intel, Intel(R) HD Graphics 520 Direct3D11 vs_5_0 ps_5_0)", "weak"],
    ["Intel(R) HD Graphics 5500", "weak"],
    ["Intel(R) HD Graphics P530", "weak"],
    ["Intel(R) UHD Graphics", "weak"],
    ["Intel(R) Iris(R) Plus Graphics 655", "weak"],
    ["Intel(R) Iris(R) Plus Graphics", "weak"],
    ["Intel(R) Iris(TM) Graphics 6100", "weak"],
    ["AMD Radeon(TM) Vega 8 Graphics", "weak"],
    ["NVIDIA GeForce MX250", "weak"],
    ["NVIDIA GeForce GT 1030", "weak"],
    ["Mali-G78", "weak"],
    // Below the reference: stills.
    ["Intel(R) HD Graphics 4600", "minimal"],
    ["Intel(R) HD Graphics P4600", "minimal"],
    ["Intel(R) HD Graphics", "minimal"],
    ["Intel(R) HD Graphics 505", "minimal"],
    ["Intel(R) UHD Graphics 600", "minimal"],
    ["AMD Radeon R4 Graphics", "minimal"],
    ["Mali-T860", "minimal"],
    ["ANGLE (Microsoft, Microsoft Basic Render Driver Direct3D11)", "minimal"],
    // Modern integrated: medium at most.
    ["ANGLE (Intel, Intel(R) Iris(R) Xe Graphics (0x00009A49) Direct3D11)", "integrated"],
    ["Intel(R) Arc(TM) Graphics", "integrated"],
    ["ANGLE (AMD, AMD Radeon(TM) Graphics (0x00001638) Direct3D11)", "integrated"],
    ["AMD Radeon 780M", "integrated"],
    // Discrete and Apple silicon.
    ["ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Laptop GPU (0x00002560) Direct3D11)", "discrete"],
    ["NVIDIA GeForce GTX 1050", "discrete"],
    ["ANGLE (AMD, AMD Radeon RX 6600 XT (0x000073FF) Direct3D11)", "discrete"],
    ["Intel(R) Arc(TM) A770 Graphics", "discrete"],
    ["ANGLE (Apple, ANGLE Metal Renderer: Apple M1, Unspecified Version)", "discrete"],
    ["Apple GPU", "discrete"],
    // Masked or unrecognised: decided by the other signals.
    ["WebKit WebGL", "unknown"],
    ["", "unknown"],
  ];
  it.each(cases)("%s → %s", (renderer, expected) => {
    expect(classifyGpu(renderer)).toBe(expected);
  });

  it("no renderer name is unknown", () => {
    expect(classifyGpu(null)).toBe("unknown");
  });
});
