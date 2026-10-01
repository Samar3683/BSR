import type { QualityProfile, RealtimeQuality } from "@/lib/performance/quality";

/** Rendering budget per real-time tier. `fallback` has no WebGL budget. */
export const QUALITY_PROFILES: Record<RealtimeQuality, QualityProfile> = {
  high: { maxDpr: 2, antialias: true, powerPreference: "high-performance" },
  medium: { maxDpr: 1.5, antialias: true, powerPreference: "high-performance" },
  low: { maxDpr: 1, antialias: false, powerPreference: "default" },
};
