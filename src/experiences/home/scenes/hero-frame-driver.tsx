"use client";

import { useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import { type Material, type Mesh, type Object3D, type Texture, Vector2, WebGLRenderTarget } from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";

import { gsap } from "@/lib/animation/gsap";
import { onIdle } from "@/lib/utils/idle";
import {
  classifyReadiness,
  CRITICAL_FRAME_MS,
  FrameMonitor,
  READINESS_FRAMES,
  SLOW_FRAME_MS,
} from "@/lib/performance/frame-monitor";

import { HERO_LADDER, resolveDpr } from "../config/hero-quality";
import { HERO_MARKS } from "../config/hero-states";
import { H1_MAX_PROGRESS, handoffCheckpoint } from "../motion/hero-handoff";
import type { ProgressController } from "../motion/hero-progress";
import type { HeroRuntime } from "../runtime/hero-runtime";

/** Rendering is capped at ~60 fps even on high-refresh displays (battery). */
const MIN_FRAME_MS = 1000 / 60 - 2;
/**
 * Readiness limit scale for software WebGL (test environments only; see
 * `relaxLimits`). Wide on purpose: image-based lighting alone triples frame time
 * under CPU rasterisation, so these runs check the handoff logic, not speed. The
 * readiness thresholds themselves are unit-tested (frame-monitor.test.ts).
 */
const SOFTWARE_RELAX = 12;
/** Gaps longer than this are pauses, not frame times (never recorded). */
const MAX_RECORDED_INTERVAL_MS = 250;
/**
 * Unmeasured frames after the first one in a readiness check: first-use shader
 * variants and uploads land there, and are not a measure of the level.
 */
const WARMUP_FRAMES = 2;

export type HeroRealtimePhase = "compiling" | "dormant" | "validating" | "active" | "failed";
export type HeroFailureReason = "compile" | "readiness" | "performance";

export interface HeroVisibility {
  visible: boolean;
}

interface HeroFrameDriverProps {
  /** The world is built and bound (nothing to compile or render before). */
  ready: boolean;
  runtime: HeroRuntime;
  progress: ProgressController;
  /** Index into HERO_LADDER to start from (the tier, or a reduced scale on weak GPUs). */
  startLevel: number;
  visibility: { readonly current: HeroVisibility };
  /**
   * Test environments on software GPUs (the test-only `hero-allow-software`
   * override): readiness limits are scaled and the step-down monitor is off.
   * CPU rasterisation is not a performance signal — image-based lighting, for
   * example, triples frame time there and costs little on a GPU — so these runs
   * verify logic only; performance is measured on real hardware.
   */
  relaxLimits?: boolean;
  onPhase?: (phase: HeroRealtimePhase) => void;
  /** Pixel ratio for the current level and canvas size (held by the Canvas `dpr` prop). */
  onDpr: (dpr: number) => void;
  onActive: () => void;
  onFailure: (reason: HeroFailureReason) => void;
}

/** Real-time may only take over while the story matches a captured still. */
function withinHandoffWindow(progress: number): boolean {
  return (
    progress <= H1_MAX_PROGRESS ||
    (progress >= HERO_MARKS.holdStart && progress <= HERO_MARKS.holdEnd)
  );
}

/**
 * The single frame driver: one GSAP ticker callback (after Lenis), R3F with
 * frameloop="never". Phases:
 *   compiling  → shaders/textures prepared in the background (no rendering)
 *   dormant    → waiting for a handoff checkpoint (no rendering)
 *   validating → a few frames behind the poster (readiness check); a failure
 *                steps one level down the quality ladder and tries again
 *   active     → renders only when something changed; step-down monitoring:
 *                sustained <20 fps → one level down, <15 fps → straight to LOW
 *                (or one level once at/below LOW); <15 fps on the last level →
 *                stills. Never from a slow high-tier scene straight to stills.
 */
const LOW_LEVEL = HERO_LADDER.findIndex((settings) => settings.level === "low");
const LAST_LEVEL = HERO_LADDER.length - 1;
export function HeroFrameDriver({
  ready,
  runtime,
  progress,
  startLevel,
  visibility,
  relaxLimits = false,
  onPhase,
  onDpr,
  onActive,
  onFailure,
}: HeroFrameDriverProps) {
  const { gl, scene, camera, size } = useThree();
  const sizeRef = useRef(size);
  useEffect(() => {
    sizeRef.current = size;
  });
  // Ratio the current level asked for: it takes effect one React render later (the Canvas
  // `dpr` prop), so readiness frames only count once the canvas is actually there.
  const targetDpr = useRef(0);
  const callbacks = useRef({ onPhase, onDpr, onActive, onFailure });
  useEffect(() => {
    callbacks.current = { onPhase, onDpr, onActive, onFailure };
  });

  useEffect(() => {
    if (!ready) return;
    let phase: HeroRealtimePhase = "compiling";
    let cancelled = false;
    let lastRender = 0;
    /**
     * Whether the previous frame was rendered back-to-back with this one. Rendering is on
     * demand: after an idle tick (nothing moved — e.g. between wheel steps) the next
     * interval includes the idle gap and is not a frame time, so it is never recorded.
     */
    let continuous = false;
    let level = Math.min(Math.max(0, startLevel), LAST_LEVEL);
    let validation = { frames: 0, stamps: [] as number[], firstSubmitMs: 0 };
    /** Readiness attempts at the current level (one retry before stepping down). */
    let attempts = 0;
    const relax = relaxLimits ? SOFTWARE_RELAX : 1;
    const monitor = new FrameMonitor({
      slowFrameMs: SLOW_FRAME_MS * relax,
      criticalFrameMs: CRITICAL_FRAME_MS * relax,
    });

    const setPhase = (next: HeroRealtimePhase) => {
      phase = next;
      callbacks.current.onPhase?.(next);
    };
    const fail = (reason: HeroFailureReason) => {
      if (cancelled || phase === "failed") return;
      setPhase("failed");
      callbacks.current.onFailure(reason);
    };
    const applyLevel = (index: number) => {
      level = index;
      attempts = 0;
      runtime.setSettings(HERO_LADDER[index]!);
      const { width, height } = sizeRef.current;
      targetDpr.current = resolveDpr(runtime.settings, width, height, window.devicePixelRatio || 1);
      callbacks.current.onDpr(targetDpr.current);
      monitor.reset();
      // Bloom off from here on: release its render targets (the ladder never goes back up).
      if (!runtime.settings.bloom && composer) {
        composer.dispose();
        composer = null;
      }
    };
    /** Moves `levels` down the ladder; false when already on the last level. */
    const stepDown = (levels = 1): boolean => {
      if (level >= LAST_LEVEL) return false;
      applyLevel(Math.min(LAST_LEVEL, level + Math.max(1, levels)));
      return true;
    };
    // Photographic response (medium/high tiers): restrained bloom only on true HDR
    // highlights (threshold above white) — lamp lenses, sun, headlamps — then the single
    // ACES output stage. Levels without bloom render straight.
    let composer: EffectComposer | null = null;
    let bloom: UnrealBloomPass | null = null;
    if (HERO_LADDER[level]!.bloom) {
      composer = new EffectComposer(gl);
      composer.addPass(new RenderPass(scene, camera));
      bloom = new UnrealBloomPass(new Vector2(sizeRef.current.width, sizeRef.current.height), 0.12, 0.5, 1.15);
      composer.addPass(bloom);
      composer.addPass(new OutputPass());
    }
    // Composer size is synced only when the canvas size or DPR actually changes:
    // EffectComposer.setSize() has no same-size guard of its own and calls every
    // pass's setSize() unconditionally (UnrealBloomPass allocates new uniform
    // vectors there), so calling it every frame was pure per-frame churn.
    let composerW = 0;
    let composerH = 0;
    let composerDpr = 0;
    const render = (): number => {
      const start = performance.now();
      if (composer) {
        const dpr = gl.getPixelRatio();
        const { width, height } = sizeRef.current;
        if (width !== composerW || height !== composerH || dpr !== composerDpr) {
          composerW = width;
          composerH = height;
          composerDpr = dpr;
          composer.setPixelRatio(dpr);
          composer.setSize(width, height);
        }
        composer.render();
      } else gl.render(scene, camera);
      return performance.now() - start;
    };

    // Shader warm-up. three.js compiles a separate program variant for drawing into a
    // render target (no tone mapping, linear output): the wet-floor reflection always does,
    // and so does the whole main pass on bloom levels. compileAsync alone prepares only the
    // on-screen variant, so the first real frame used to compile everything again,
    // synchronously (4+ s on an Intel UHD 620, a frozen page). Both variants compile here,
    // behind the poster; the other world's lighting compiles in idle time once active.
    const compileTarget = new WebGLRenderTarget(1, 1);
    // Always the whole scene (scene === target scene): a separate subtree would have its lights
    // counted twice by three.js and compile variants no frame ever uses.
    const compileWith = (target: WebGLRenderTarget | null, objects: Object3D[] = [scene]) => {
      const previous = gl.getRenderTarget();
      gl.setRenderTarget(target);
      try {
        // The synchronous part creates every program; the promise waits for completion.
        return Promise.all(objects.map((object) => gl.compileAsync(object, camera, scene)));
      } finally {
        gl.setRenderTarget(previous);
      }
    };
    const mainTarget = () => (composer ? compileTarget : null);
    /** One idle step per texture: uploads block the main thread, large ones for a while. */
    const uploadSteps = (objects: Object3D[]) => {
      const textures = new Set<Texture>();
      for (const root of objects) {
        root.traverse((object) => {
          const material = (object as Mesh).material as Material | Material[] | undefined;
          for (const m of Array.isArray(material) ? material : material ? [material] : []) {
            for (const value of Object.values(m)) if ((value as Texture)?.isTexture) textures.add(value as Texture);
          }
        });
      }
      return [...textures].map((texture) => () => {
        gl.initTexture(texture);
        return Promise.resolve();
      });
    };
    // After the handoff, in idle time: the road world's on-demand buildings, its lighting's
    // programs, then its textures — so the dock → road switch never compiles or uploads.
    const warmups: Array<() => Promise<unknown>> = [
      () => {
        runtime.prepareRoad();
        return Promise.resolve();
      },
      () => runtime.compileWorld("road", (staged) => compileWith(mainTarget(), [staged])),
      () =>
        runtime.compileWorld("road", (staged) => {
          warmups.unshift(...uploadSteps([staged]));
          return Promise.resolve();
        }),
    ];
    // Bloom levels can step down to straight rendering: its variants come last.
    if (composer) {
      warmups.push(
        () => compileWith(null),
        () => runtime.compileWorld("road", (staged) => compileWith(null, [staged])),
      );
    }
    let cancelWarmup = () => {};
    const warmNext = () => {
      const next = warmups.shift();
      if (!next || cancelled) return;
      cancelWarmup = onIdle(() => {
        if (cancelled) return;
        // Deliberate one-off work between frames: the next interval is not a frame time.
        continuous = false;
        next().then(warmNext, warmNext);
      }, 3000);
    };

    // The starting level (and its render scale) applies before anything is compiled.
    applyLevel(level);
    setPhase("compiling");
    runtime.update(performance.now());
    Promise.all(composer ? [compileWith(compileTarget)] : [compileWith(null), compileWith(compileTarget)])
      .then(() => {
        if (!cancelled && phase === "compiling") setPhase("dormant");
      })
      .catch(() => fail("compile"));

    const tick = () => {
      if (cancelled || phase === "failed" || phase === "compiling") return;
      const now = performance.now();
      if (!visibility.current.visible || document.visibilityState === "hidden") {
        runtime.pause();
        monitor.resetWindow();
        continuous = false;
        return;
      }

      if (phase === "dormant") {
        if (!handoffCheckpoint(progress.displayed, progress.idleMs(now))) return;
        // Snap in this (unmeasured) tick: one-off work such as regenerating the
        // environment for the checkpoint's light never counts as a frame time.
        runtime.snapToProgress();
        runtime.update(now);
        validation = { frames: 0, stamps: [], firstSubmitMs: 0 };
        setPhase("validating");
        return;
      }

      if (phase === "validating") {
        if (!withinHandoffWindow(progress.displayed)) {
          setPhase("dormant"); // the visitor moved on: never take over mid-story
          return;
        }
        if (Math.abs(gl.getPixelRatio() - targetDpr.current) > 0.01) return; // resize pending
        runtime.update(now);
        const submitMs = render();
        if (validation.frames++ === 0) validation.firstSubmitMs = submitMs;
        if (validation.frames <= 1 + WARMUP_FRAMES) return;
        validation.stamps.push(now);
        if (validation.stamps.length < READINESS_FRAMES) return;
        const intervals = validation.stamps
          .slice(1)
          .map((stamp, i) => stamp - validation.stamps[i]!);
        const verdict = classifyReadiness(
          { firstSubmitMs: validation.firstSubmitMs, intervalsMs: intervals },
          relax,
        );
        if (verdict === "pass") {
          lastRender = now;
          continuous = true;
          setPhase("active");
          callbacks.current.onActive();
          warmNext();
          return;
        }
        // Too slow behind the poster: retry once (a transient hitch), then one level down
        // and try again — all still unseen.
        if (attempts++ === 0) setPhase("dormant");
        else if (!stepDown()) fail("readiness");
        else setPhase("dormant");
        return;
      }

      // Active.
      if (!runtime.update(now)) {
        continuous = false;
        return;
      }
      const interval = now - lastRender;
      if (interval < MIN_FRAME_MS) {
        runtime.markDirty(); // the 60 fps cap skips this tick; continuity is kept
        return;
      }
      const measured = continuous;
      continuous = true;
      lastRender = now;
      render();
      runtime.frameMs = interval;
      if (!measured || relaxLimits || interval > MAX_RECORDED_INTERVAL_MS) return;
      const verdict = monitor.record(interval);
      if (verdict === "critical") {
        // <15 fps: straight to LOW from above it, else one level; stills only from the last level.
        if (!stepDown(level < LOW_LEVEL ? LOW_LEVEL - level : 1)) fail("performance");
      } else if (verdict === "downgrade") {
        stepDown(); // <20 fps on the last level is tolerated (15–20 fps)
      }
    };

    gsap.ticker.add(tick);
    return () => {
      cancelled = true;
      cancelWarmup();
      compileTarget.dispose();
      composer?.dispose();
      gsap.ticker.remove(tick);
    };
  }, [ready, runtime, progress, startLevel, visibility, relaxLimits, gl, scene, camera]);

  // A scaled level holds a pixel budget: the ratio follows the canvas size.
  useEffect(() => {
    if (!ready) return;
    targetDpr.current = resolveDpr(runtime.settings, size.width, size.height, window.devicePixelRatio || 1);
    callbacks.current.onDpr(targetDpr.current);
  }, [ready, runtime, size.width, size.height]);

  return null;
}
