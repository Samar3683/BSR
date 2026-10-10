"use client";

import { useThree } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useState } from "react";

import type { RealtimeQuality } from "@/lib/performance/quality";
import { disposeObject3D } from "@/lib/three/dispose";
import { createGltfLoader, type GltfAssetLoader } from "@/lib/three/gltf-loader";

import { HERO_MODELS } from "../config/hero-assets";
import type { HeroRuntime } from "../runtime/hero-runtime";
import { createHeroEnvironment } from "./hero-environment";
import { buildHeroWorld, buildRoadWorld, type HeroWorldParts } from "./hero-world";

interface HeroSceneProps {
  runtime: HeroRuntime;
  tier: RealtimeQuality;
  /** Called once the world is built and bound (the frame driver waits for it). */
  onReady: () => void;
  /** Test/debug: behave as if an asset failed to load. */
  simulateAssetFailure?: boolean;
}

/** The built world and the loader it was built with (kept for the late road kit). */
interface BuiltWorld {
  parts: HeroWorldParts;
  loader: GltfAssetLoader;
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
  const [world, setWorld] = useState<BuiltWorld | null>(null);
  const [failure, setFailure] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;
    // One loader (one KTX2 transcoder) for the opening's assets and the late road kit.
    const loader = createGltfLoader(gl);
    const build = simulateAssetFailure
      ? Promise.reject(new Error("Simulated hero asset failure"))
      : buildHeroWorld({ renderer: gl, models: HERO_MODELS[tier], tier, loader });
    build.then(
      (parts) => {
        if (cancelled) {
          disposeObject3D(parts.root);
          loader.dispose();
        } else setWorld({ parts, loader });
      },
      (error: unknown) => {
        loader.dispose();
        if (!cancelled) setFailure(error instanceof Error ? error : new Error(String(error)));
      },
    );
    return () => {
      cancelled = true;
    };
  }, [gl, tier, simulateAssetFailure]);

  useLayoutEffect(() => {
    if (!world) return;
    const { parts, loader } = world;
    const environment = createHeroEnvironment(
      gl,
      parts.sky.mesh.geometry,
      tier === "low" ? 64 : 128,
    );
    runtime.bind({
      scene,
      camera: camera as import("three").PerspectiveCamera,
      renderer: gl,
      rig: parts.rig,
      dock: parts.dock,
      road: parts.road,
      roadPending: parts.roadKitUrl !== null,
      sky: parts.sky,
      environment,
    });
    onReady();
    // The road kit downloads now — after the opening's assets, while its shaders compile —
    // and is swapped in while the dock is on screen. If it fails, the hero stays real-time
    // up to the wipe and the still ladder covers the road and route.
    let detached = false;
    const standIn = parts.road;
    if (parts.roadKitUrl) {
      buildRoadWorld({ loader, url: parts.roadKitUrl })
        .then(
          (road) => {
            if (detached) {
              disposeObject3D(road.group);
              return;
            }
            runtime.attachRoad(road);
            disposeObject3D(standIn.group);
          },
          () => {},
        )
        .finally(() => loader.dispose());
    } else loader.dispose();
    return () => {
      detached = true;
      runtime.unbind();
      environment.dispose();
      disposeObject3D(parts.root);
    };
  }, [runtime, world, scene, camera, gl, tier, onReady]);

  useEffect(() => {
    runtime.setViewport(size.width, size.height);
  }, [runtime, size.width, size.height]);

  if (failure) throw failure;
  return world ? <primitive object={world.parts.root} /> : null;
}
