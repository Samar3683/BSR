"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ACESFilmicToneMapping } from "three";

import { ErrorBoundary } from "@/components/feedback/error-boundary";
import { ExperienceCanvas } from "@/experiences/shared/canvas/experience-canvas";
import type { RealtimeQuality } from "@/lib/performance/quality";
import { SCENE_COLORS } from "@/lib/three/brand-colors";

import { HERO_TIER_PROFILES, startLevel } from "../config/hero-quality";
import type { ProgressController } from "../motion/hero-progress";
import { HeroRuntime } from "../runtime/hero-runtime";
import {
  type HeroFailureReason,
  HeroFrameDriver,
  type HeroRealtimePhase,
  type HeroVisibility,
} from "../scenes/hero-frame-driver";
import { HeroScene } from "../scenes/hero-scene";

export type HeroRealtimeFailure = HeroFailureReason | "error" | "context-lost";

interface HeroRealtimeProps {
  progress: ProgressController;
  tier: RealtimeQuality;
  /** Weak integrated GPU: start LOW at a reduced render scale. */
  reducedScale: boolean;
  visibility: { readonly current: HeroVisibility };
  relaxLimits: boolean;
  simulateAssetFailure: boolean;
  audit: boolean;
  onRuntime?: (runtime: HeroRuntime | null) => void;
  onPhase?: (phase: HeroRealtimePhase) => void;
  onActive: () => void;
  onFailed: (reason: HeroRealtimeFailure) => void;
  /** Past the wipe without the road world yet: the still ladder must cover the hero. */
  onWaiting?: (waiting: boolean) => void;
}

/**
 * The lazily loaded real-time layer (Three.js, R3F, runtime). One canvas, one
 * renderer. Any failure — asset, shader, context loss, performance — is
 * reported upwards and the ladder of stills takes over quietly.
 */
export default function HeroRealtime({
  progress,
  tier,
  reducedScale,
  visibility,
  relaxLimits,
  simulateAssetFailure,
  audit,
  onRuntime,
  onPhase,
  onActive,
  onFailed,
  onWaiting,
}: HeroRealtimeProps) {
  const profile = HERO_TIER_PROFILES[tier];
  const runtime = useMemo(
    () => new HeroRuntime(progress, profile.settings, { audit }),
    [progress, profile, audit],
  );

  useEffect(() => {
    onRuntime?.(runtime);
    return () => {
      onRuntime?.(null);
      runtime.dispose();
    };
  }, [runtime, onRuntime]);

  // The frame driver starts compiling only once the world is built and bound.
  const [ready, setReady] = useState(false);
  // Render scale chosen by the frame driver's quality level (changes only with the level
  // or the canvas size — never per frame).
  const [dpr, setDpr] = useState<number>();
  const handleReady = useCallback(() => setReady(true), []);

  return (
    <ErrorBoundary onError={() => onFailed("error")}>
      <ExperienceCanvas
        profile={profile.renderer}
        frameloop="never"
        dpr={dpr}
        rendererOverrides={{ alpha: false }}
        onContextLost={() => onFailed("context-lost")}
        onCreated={({ gl }) => {
          // Shader error checks read program logs back synchronously on first use: a
          // development aid only (production shaders are fixed and tested).
          gl.debug.checkShaderErrors = process.env.NODE_ENV !== "production";
          gl.toneMapping = ACESFilmicToneMapping;
          gl.setClearColor(SCENE_COLORS.carbon);
        }}
      >
        <HeroScene
          runtime={runtime}
          tier={tier}
          onReady={handleReady}
          simulateAssetFailure={simulateAssetFailure}
        />
        <HeroFrameDriver
          ready={ready}
          runtime={runtime}
          progress={progress}
          startLevel={startLevel(tier, { reducedScale })}
          onDpr={setDpr}
          visibility={visibility}
          relaxLimits={relaxLimits}
          onPhase={onPhase}
          onActive={onActive}
          onFailure={onFailed}
          onWaiting={onWaiting}
        />
      </ExperienceCanvas>
    </ErrorBoundary>
  );
}
