"use client";

import { useThree } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useState } from "react";

import type { RealtimeQuality } from "@/lib/performance/quality";
import { disposeObject3D } from "@/lib/three/dispose";

import { HERO_MODELS } from "../config/hero-assets";
import type { HeroRuntime } from "../runtime/hero-runtime";
import { createHeroEnvironment } from "./hero-environment";
import { buildHeroWorld, type HeroWorldParts } from "./hero-world";

interface HeroSceneProps {
  runtime: HeroRuntime;
  tier: RealtimeQuality;
  /** Called once the world is built and bound (the frame driver waits for it). */
  onReady: () => void;
  /** Test/debug: behave as if an asset failed to load. */
  simulateAssetFailure?: boolean;
}

/**
 * Scene structure only: builds the world (production GLBs or development
 * placeholders, per the manifest) and binds it to the runtime. No animation
 * here — the frame driver owns every frame. A failed build is rethrown during
 * render, so the error boundary falls back to stills exactly as before.
 */
export function HeroScene({
  runtime,
  tier,
  onReady,
  simulateAssetFailure = false,
}: HeroSceneProps) {
  const { gl, scene, camera, size } = useThree();
  const [world, setWorld] = useState<HeroWorldParts | null>(null);
  const [failure, setFailure] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;
    const build = simulateAssetFailure
      ? Promise.reject(new Error("Simulated hero asset failure"))
      : buildHeroWorld({ renderer: gl, models: HERO_MODELS[tier], tier });
    build.then(
      (built) => {
        if (cancelled) disposeObject3D(built.root);
        else setWorld(built);
      },
      (error: unknown) => {
        if (!cancelled) setFailure(error instanceof Error ? error : new Error(String(error)));
      },
    );
    return () => {
      cancelled = true;
    };
  }, [gl, tier, simulateAssetFailure]);

  useLayoutEffect(() => {
    if (!world) return;
    const environment = createHeroEnvironment(
      gl,
      world.sky.mesh.geometry,
      tier === "low" ? 64 : 128,
    );
    runtime.bind({
      scene,
      camera: camera as import("three").PerspectiveCamera,
      renderer: gl,
      rig: world.rig,
      dock: world.dock,
      road: world.road,
      sky: world.sky,
      environment,
    });
    onReady();
    return () => {
      runtime.unbind();
      environment.dispose();
      disposeObject3D(world.root);
    };
  }, [runtime, world, scene, camera, gl, tier, onReady]);

  useEffect(() => {
    runtime.setViewport(size.width, size.height);
  }, [runtime, size.width, size.height]);

  if (failure) throw failure;
  return world ? <primitive object={world.root} /> : null;
}
