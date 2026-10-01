import type { RealtimeQuality } from "./quality";

/*
 * Two independent decisions:
 *   - LAYOUT MODE (wide / standard / compact + short) comes from the viewport
 *     and is expressed in CSS; `resolveLayoutMode` mirrors it for code/tests.
 *   - RENDERING PATH comes from preference, device form factor and capability.
 * A short or narrow window never selects the phone media path by itself.
 */

export type LayoutMode = "wide" | "standard" | "compact";

/** Mirrors the hero's CSS media queries (rem = 16px). */
export function resolveLayoutMode(
  width: number,
  height: number,
): {
  mode: LayoutMode;
  short: boolean;
} {
  const short = height < 640;
  if (width < 768) return { mode: "compact", short };
  if (width >= 1024 && width / height >= 1.6) return { mode: "wide", short };
  return { mode: "standard", short };
}

export type HeroRenderPath = "realtime" | "media" | "reduced" | "fallback";

/**
 * GPU capability class from the (unmasked) WebGL renderer name.
 *  - minimal: below the weakest supported GPU (older/Atom-class Intel, low-end
 *    APUs, embedded GPUs) — the real-time scene cannot hold 15 fps: stills.
 *  - weak: Intel HD/UHD/Iris-class integrated, first APUs, GeForce MX — the
 *    reference is Intel UHD 620: low tier at a reduced render scale.
 *  - integrated: modern integrated (Iris Xe, Radeon 680M/780M…) — medium at most.
 *  - discrete: dedicated GPUs and Apple silicon.
 *  - unknown: masked or unrecognised names — decided by the other signals.
 * Heuristic by design: a wrong guess is caught by the readiness check and the
 * runtime ladder; recognising the common weak families keeps them from
 * starting on a tier they cannot hold.
 */
export type GpuClass = "minimal" | "weak" | "integrated" | "discrete" | "unknown";

const TM = String.raw`(\s*\((r|tm)\))?`;
const GPU_RULES: ReadonlyArray<[GpuClass, RegExp]> = [
  // Order matters: specific weak families before the vendor-wide discrete rules.
  // Haswell and older, Atom/Celeron-class Intel (HD 500/505, UHD 600/605, unnumbered HD).
  ["minimal", /\bhd graphics (2000|2500|3000|4000|4200|4400|4600|5000|p4\d{3}|50[05])\b/i],
  ["minimal", /\bhd graphics(?! p?\d)|\buhd graphics 60[05]\b/i],
  ["minimal", new RegExp(String.raw`\bradeon${TM} r[2-5] graphics\b|powervr|videocore|vivante|\bmali-[t4]|basic render driver`, "i")],
  // Intel HD/UHD 5xx–7xx, Iris / Iris Plus / Iris Pro (UHD 620 is the reference).
  ["weak", new RegExp(String.raw`\b(u?hd|iris${TM}( plus| pro)?)( graphics)? ?(p?\d{3,4}|graphics)\b`, "i")],
  ["weak", new RegExp(String.raw`\bradeon${TM} (r[6-8]|vega \d{1,2}) graphics\b|\bgeforce mx\d|\bgeforce gt \d{3,4}m?\b|\bmali|\badreno`, "i")],
  ["integrated", new RegExp(String.raw`\biris${TM} xe\b|\barc${TM} graphics\b|\bradeon${TM} (\d{3}m )?graphics\b|\bradeon \d{3}m\b`, "i")],
  ["discrete", new RegExp(String.raw`nvidia|geforce|quadro|\brtx\b|radeon${TM} (rx|pro|vii)|firepro|\barc\b|\bapple (m\d|gpu)|metal renderer: apple`, "i")],
];

export function classifyGpu(renderer: string | null): GpuClass {
  if (!renderer) return "unknown";
  for (const [gpu, pattern] of GPU_RULES) if (pattern.test(renderer)) return gpu;
  return "unknown";
}

export interface HeroSignals {
  reducedMotion: boolean;
  /** Hardware WebGL2 (software rasterisers count as unavailable). */
  webgl2: boolean;
  /** GPU capability class (see `classifyGpu`). */
  gpu: GpuClass;
  maxSamples: number;
  maxTextureSize: number;
  primaryPointerCoarse: boolean;
  anyPointerFine: boolean;
  hoverNone: boolean;
  maxTouchPoints: number;
  /** Short side of the device *screen* (CSS px) — not the window. */
  screenShortSide: number;
  logicalCores: number | null;
  deviceMemoryGb: number | null;
  saveData: boolean;
  effectiveType: string | null;
}

export const PHONE_SCREEN_MAX_SHORT_SIDE = 500;

/** Phone form factor requires every phone signal; window size plays no part. */
export function isPhoneFormFactor(signals: HeroSignals): boolean {
  return (
    signals.primaryPointerCoarse &&
    !signals.anyPointerFine &&
    signals.hoverNone &&
    signals.maxTouchPoints > 0 &&
    signals.screenShortSide <= PHONE_SCREEN_MAX_SHORT_SIDE
  );
}

export function isTouchTablet(signals: HeroSignals): boolean {
  return signals.primaryPointerCoarse && !isPhoneFormFactor(signals);
}

/**
 * Order matters: a motion preference always wins; phones get pre-rendered
 * media (which needs no WebGL); everything else needs hardware WebGL2.
 */
export function resolveHeroRenderPath(signals: HeroSignals): HeroRenderPath {
  if (signals.reducedMotion) return "reduced";
  if (isPhoneFormFactor(signals)) return "media";
  if (!signals.webgl2) return "fallback";
  // Hardware that cannot hold the scene at its lowest setting gets stills from the start —
  // never a real-time layer that appears and then drops out mid-scroll.
  if (signals.gpu === "minimal") return "fallback";
  return "realtime";
}

const SLOW_CONNECTIONS = new Set(["slow-2g", "2g", "3g"]);

/**
 * Conservative initial real-time tier from device signals — no benchmark.
 * Memory/core hints and the GPU class only ever lower the tier; absent hints
 * are neutral. Quality never steps up after this decision.
 */
export function resolveHeroTier(signals: HeroSignals): RealtimeQuality {
  const tier = tierFromDevice(signals);
  if (signals.gpu === "weak" || signals.gpu === "minimal") return "low";
  if (signals.gpu === "integrated" && tier === "high") return "medium";
  return tier;
}

function tierFromDevice(signals: HeroSignals): RealtimeQuality {
  const slowNetwork =
    signals.saveData ||
    (signals.effectiveType !== null && SLOW_CONNECTIONS.has(signals.effectiveType));
  const constrained =
    (signals.logicalCores !== null && signals.logicalCores <= 4) ||
    (signals.deviceMemoryGb !== null && signals.deviceMemoryGb <= 4);
  if (slowNetwork || constrained) return "low";

  const desktopInput = !signals.primaryPointerCoarse && !signals.hoverNone;
  if (!desktopInput) {
    return signals.logicalCores !== null && signals.logicalCores >= 6 ? "medium" : "low";
  }

  const strong =
    signals.maxSamples >= 4 &&
    signals.maxTextureSize >= 8192 &&
    signals.logicalCores !== null &&
    signals.logicalCores >= 8 &&
    (signals.deviceMemoryGb === null || signals.deviceMemoryGb >= 8);
  return strong ? "high" : "medium";
}
