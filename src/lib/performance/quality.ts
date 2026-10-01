/**
 * Rendering quality tiers. `fallback` means no real-time WebGL: the page is
 * served by HTML plus static/video media only.
 */
export const EXPERIENCE_QUALITIES = ["high", "medium", "low", "fallback"] as const;

export type ExperienceQuality = (typeof EXPERIENCE_QUALITIES)[number];
export type RealtimeQuality = Exclude<ExperienceQuality, "fallback">;

export interface QualityProfile {
  /** Upper bound for the canvas device-pixel ratio. */
  maxDpr: number;
  antialias: boolean;
  powerPreference: WebGLPowerPreference;
}

export interface DeviceSignals {
  webgl2: boolean;
  saveData: boolean;
  /** Approximate RAM in GB (Chromium only; `null` elsewhere). */
  deviceMemoryGb: number | null;
  logicalCores: number | null;
}

const LOW_MEMORY_GB = 2;
const LOW_CORE_COUNT = 2;

/**
 * Conservative starting tier from coarse, privacy-safe signals.
 *
 * It never returns `high`: promotion to the top tier is reserved for runtime
 * evidence (measured frame rate) rather than guesses from static signals.
 * Missing signals are not treated as weakness.
 */
export function resolveInitialQuality(signals: DeviceSignals): ExperienceQuality {
  if (!signals.webgl2) return "fallback";
  if (signals.saveData) return "low";

  const lowMemory = signals.deviceMemoryGb !== null && signals.deviceMemoryGb <= LOW_MEMORY_GB;
  const fewCores = signals.logicalCores !== null && signals.logicalCores <= LOW_CORE_COUNT;
  if (lowMemory || fewCores) return "low";

  return "medium";
}

export function isRealtimeQuality(quality: ExperienceQuality): quality is RealtimeQuality {
  return quality !== "fallback";
}
