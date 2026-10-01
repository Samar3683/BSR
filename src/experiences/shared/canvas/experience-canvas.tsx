"use client";

import { Canvas, type RootState } from "@react-three/fiber";
import type { ReactNode } from "react";
import type { WebGLRendererParameters } from "three";

import type { QualityProfile } from "@/lib/performance/quality";
import { createRendererParameters } from "@/lib/three/renderer";
import { useExperienceStore } from "@/stores/experience-store";

export interface ExperienceCanvasProps {
  profile: QualityProfile;
  children?: ReactNode;
  /**
   * `demand` (default) renders only when invalidated. `never` hands the frame
   * loop to an external driver (the GSAP ticker) — see docs/architecture.md.
   */
  frameloop?: "demand" | "never";
  rendererOverrides?: Partial<WebGLRendererParameters>;
  /**
   * Exact pixel ratio (render scale), overriding the profile's [1, maxDpr] range.
   * This prop is the only way to hold a ratio: R3F re-applies the prop on every
   * Canvas render, so an imperative `setDpr` is undone by the next re-render.
   */
  dpr?: number;
  /** Called once if the WebGL context is lost (no restore is attempted). */
  onContextLost?: () => void;
  onCreated?: (state: RootState) => void;
}

/**
 * The React Three Fiber root. Loaded through a lazy boundary so Three.js
 * stays out of the initial bundle. Fills its parent element.
 */
export function ExperienceCanvas({
  profile,
  children,
  frameloop = "demand",
  rendererOverrides,
  dpr,
  onContextLost,
  onCreated,
}: ExperienceCanvasProps) {
  const setCanvasStatus = useExperienceStore((state) => state.setCanvasStatus);

  return (
    <Canvas
      dpr={dpr ?? [1, profile.maxDpr]}
      gl={createRendererParameters(profile, rendererOverrides)}
      frameloop={frameloop}
      onCreated={(state) => {
        state.gl.domElement.addEventListener(
          "webglcontextlost",
          () => {
            setCanvasStatus("failed");
            onContextLost?.();
          },
          { once: true },
        );
        setCanvasStatus("ready");
        onCreated?.(state);
      }}
    >
      {children}
    </Canvas>
  );
}
