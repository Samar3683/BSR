import { create } from "zustand";

export type CanvasStatus = "idle" | "ready" | "failed";

interface ExperienceState {
  canvasStatus: CanvasStatus;
  setCanvasStatus: (status: CanvasStatus) => void;
}

/**
 * Cross-system state shared by the cinematic layer and the DOM (scene
 * progress, active chapter, etc. will live here). Render loops should read it
 * via `useExperienceStore.getState()` rather than subscribing per frame.
 */
export const useExperienceStore = create<ExperienceState>()((set) => ({
  canvasStatus: "idle",
  setCanvasStatus: (canvasStatus) => set({ canvasStatus }),
}));
