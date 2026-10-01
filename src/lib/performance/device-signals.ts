import type { DeviceSignals } from "./quality";
import { classifyGpu, type HeroSignals } from "./tier-decision";

// Non-standard or not-yet-typed Navigator fields; all optional by nature.
interface NavigatorWithHints extends Navigator {
  deviceMemory?: number;
  connection?: { saveData?: boolean; effectiveType?: string };
}

export interface WebGL2Probe {
  available: boolean;
  maxSamples: number;
  maxTextureSize: number;
  /** Unmasked renderer name when exposed (empty otherwise). */
  renderer: string;
}

const NO_WEBGL2: WebGL2Probe = { available: false, maxSamples: 0, maxTextureSize: 0, renderer: "" };

/** Software rasterisers, identified by renderer name. */
const SOFTWARE_RENDERER = /swiftshader|llvmpipe|softpipe|software/i;

/** Renderer name if the browser exposes it (Chromium/Safari/Firefox may mask it). */
function rendererName(gl: WebGL2RenderingContext): string {
  const info = gl.getExtension("WEBGL_debug_renderer_info");
  return String(gl.getParameter(info ? info.UNMASKED_RENDERER_WEBGL : gl.RENDERER) ?? "");
}

export function isSoftwareRenderer(name: string): boolean {
  return SOFTWARE_RENDERER.test(name);
}

/**
 * Probes for a hardware-accelerated WebGL2 context (Three.js requires WebGL2)
 * and reads the limits used for tier selection.
 *
 * Software rasterisers (e.g. SwiftShader) report as unavailable — a
 * CPU-rendered cinematic scene would be worse than the designed fallback.
 * `failIfMajorPerformanceCaveat` is not reliable for this (current Chromium
 * ignores it for SwiftShader), so the renderer name is checked too. The name
 * also feeds the hero's GPU class (`classifyGpu`): the probe asks for the
 * high-performance GPU, as the hero canvas does, so dual-GPU laptops are
 * classified by the GPU the scene will actually get.
 * `allowSoftware` exists only for test environments.
 */
export function probeWebGL2(options: { allowSoftware?: boolean } = {}): WebGL2Probe {
  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl2", {
      failIfMajorPerformanceCaveat: !options.allowSoftware,
      powerPreference: "high-performance",
    });
    if (!gl) return NO_WEBGL2;
    const renderer = rendererName(gl);
    if (!options.allowSoftware && isSoftwareRenderer(renderer)) {
      gl.getExtension("WEBGL_lose_context")?.loseContext();
      return NO_WEBGL2;
    }
    const probe: WebGL2Probe = {
      available: true,
      maxSamples: Number(gl.getParameter(gl.MAX_SAMPLES)) || 0,
      maxTextureSize: Number(gl.getParameter(gl.MAX_TEXTURE_SIZE)) || 0,
      renderer,
    };
    // Release the probe context immediately; browsers cap live contexts.
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    return probe;
  } catch {
    return NO_WEBGL2;
  }
}

/** Whether a hardware-accelerated WebGL2 context can be created. */
export function detectWebGL2(): boolean {
  return probeWebGL2().available;
}

/** Reads coarse device hints. Browser-only. No fingerprinting or benchmarks. */
export function readDeviceSignals(): DeviceSignals {
  const nav = navigator as NavigatorWithHints;
  return {
    webgl2: detectWebGL2(),
    saveData: nav.connection?.saveData ?? false,
    deviceMemoryGb: nav.deviceMemory ?? null,
    logicalCores: nav.hardwareConcurrency || null,
  };
}

/** Signals for the hero's rendering-path and tier decisions. Browser-only. */
export function readHeroSignals(options: {
  reducedMotion: boolean;
  allowSoftwareWebGL?: boolean;
}): HeroSignals {
  const nav = navigator as NavigatorWithHints;
  const matches = (query: string) => window.matchMedia(query).matches;
  const probe = probeWebGL2({ allowSoftware: options.allowSoftwareWebGL });
  return {
    reducedMotion: options.reducedMotion,
    webgl2: probe.available,
    gpu: probe.available ? classifyGpu(probe.renderer) : "unknown",
    maxSamples: probe.maxSamples,
    maxTextureSize: probe.maxTextureSize,
    primaryPointerCoarse: matches("(pointer: coarse)"),
    anyPointerFine: matches("(any-pointer: fine)"),
    hoverNone: matches("(hover: none)"),
    maxTouchPoints: nav.maxTouchPoints ?? 0,
    screenShortSide: Math.min(window.screen.width, window.screen.height),
    logicalCores: nav.hardwareConcurrency || null,
    deviceMemoryGb: nav.deviceMemory ?? null,
    saveData: nav.connection?.saveData ?? false,
    effectiveType: nav.connection?.effectiveType ?? null,
  };
}
