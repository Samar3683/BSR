import { create } from "zustand";

import type { ExperienceQuality } from "@/lib/performance/quality";

export type WebGLSupport = "unknown" | "supported" | "unsupported";

interface PerformanceState {
  webgl: WebGLSupport;
  /**
   * Starts at `fallback` so the first paint is the HTML experience; real-time
   * rendering is opted into only once capabilities are known.
   */
  quality: ExperienceQuality;
  setCapabilities: (capabilities: { webgl: WebGLSupport; quality: ExperienceQuality }) => void;
  setQuality: (quality: ExperienceQuality) => void;
}

/**
 * Device capability and rendering tier. Client-only state: it is never
 * populated on the server, so a module-level store is safe here.
 */
export const usePerformanceStore = create<PerformanceState>()((set) => ({
  webgl: "unknown",
  quality: "fallback",
  setCapabilities: ({ webgl, quality }) => set({ webgl, quality }),
  setQuality: (quality) => set({ quality }),
}));
