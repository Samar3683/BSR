"use client";

import { Pause, Play } from "lucide-react";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";

import { IconButton } from "@/components/ui/button";
import { gsap, ScrollTrigger } from "@/lib/animation/gsap";
import { REDUCED_MOTION_QUERY } from "@/lib/accessibility/reduced-motion";
import { readHeroSignals } from "@/lib/performance/device-signals";
import type { RealtimeQuality } from "@/lib/performance/quality";
import {
  type GpuClass,
  type HeroRenderPath,
  resolveHeroRenderPath,
  resolveHeroTier,
} from "@/lib/performance/tier-decision";
import { onIdle } from "@/lib/utils/idle";

import { heroContent } from "../config/hero-content";
import { type HeroOverrides, NO_OVERRIDES, readHeroOverrides } from "../config/hero-dev";
import { ladderIndex } from "../motion/hero-handoff";
import {
  CHAPTER_B_START,
  CLIP_A_START_BEFORE,
  CLIP_B_CANCEL_AT,
  CLIP_B_START_BEFORE,
  INITIAL_MEDIA_STATE,
  mediaReducer,
  mediaStill,
} from "../motion/hero-media-chapters";
import { ProgressController } from "../motion/hero-progress";
import type { HeroRuntime } from "../runtime/hero-runtime";
import type { HeroRealtimePhase, HeroVisibility } from "../scenes/hero-frame-driver";
import { HeroMediaPlayer } from "./hero-media-player";
import type { HeroRealtimeFailure } from "./hero-realtime";
import { HeroStillLadder } from "./hero-still-ladder";

/** Build-time constant (see config/hero-dev.ts): folded, so tooling is compiled out of production. */
const DEV_TOOLS =
  process.env.NODE_ENV !== "production" || process.env.NEXT_PUBLIC_BSR_HERO_TEST_HOOKS === "true";

const HeroRealtime = dynamic(() => import("./hero-realtime"), { ssr: false });
const HeroDebugPanel = DEV_TOOLS
  ? dynamic(() => import("../debug/hero-debug-panel"), { ssr: false })
  : null;

export type RealtimeStatus = "idle" | "loading" | "active" | "failed";

/** Media-chapter zones: the reducer only needs to hear about zone changes. */
const MEDIA_ZONES = [CLIP_A_START_BEFORE, CHAPTER_B_START, CLIP_B_START_BEFORE, CLIP_B_CANCEL_AT];
const mediaZone = (p: number) => MEDIA_ZONES.filter((edge) => p >= edge).length;
const WARM_PROGRESS = 0.15;
/**
 * Copy fade window (inside the departure, after the reveal hold).
 *
 * ⚠ PROVISIONAL TIMING: the fade itself is approved (the copy must leave
 * during the departure), but 0.44–0.54 was set against placeholder visuals.
 * Review it against Styleframe 03 / the final departure composition before
 * sign-off — do not tune it further on placeholders.
 */
const COPY_FADE = [0.44, 0.54] as const;
const copyOpacityAt = (p: number) => {
  const t = Math.min(1, Math.max(0, (p - COPY_FADE[0]) / (COPY_FADE[1] - COPY_FADE[0])));
  return 1 - t * t * (3 - 2 * t);
};
const STILL_INDEX = { S1: 0, S2: 1, S3: 2, S4: 3 } as const;

/** Read-only view used by the debug panel and (test builds only) test hooks. */
export interface HeroInspector {
  readonly path: HeroRenderPath | "pending";
  readonly tier: RealtimeQuality;
  readonly gpu: GpuClass;
  readonly realtime: RealtimeStatus;
  readonly phase: HeroRealtimePhase | null;
  readonly failure: HeroRealtimeFailure | null;
  readonly ladderIndex: number;
  readonly media: typeof INITIAL_MEDIA_STATE;
  readonly progress: { raw: number; displayed: number };
  readonly runtime: HeroRuntime | null;
  readonly overrides: HeroOverrides;
  readonly heroScrollTriggers: number;
  readonly section: HTMLElement | null;
}

declare global {
  interface Window {
    __BSR_HERO__?: HeroInspector;
  }
}

/**
 * Client island of the hero. Owns the one progress source (a single unpinned
 * ScrollTrigger), decides the rendering path and tier, and composes the
 * visual layers: still ladder, real-time canvas or phone media. All of it is
 * decorative; the hero's content stays server-rendered HTML.
 */
export function HeroCinematic() {
  const anchor = useRef<HTMLDivElement>(null);
  const sectionRef = useRef<HTMLElement | null>(null);
  const progress = useMemo(() => new ProgressController(), []);
  const visibility = useRef<HeroVisibility & { ratio: number }>({ visible: true, ratio: 1 });
  const runtime = useRef<HeroRuntime | null>(null);
  const trigger = useRef<ScrollTrigger | null>(null);

  const [overrides, setOverrides] = useState<HeroOverrides>(NO_OVERRIDES);
  const [path, setPath] = useState<HeroRenderPath | "pending">("pending");
  const [tier, setTier] = useState<RealtimeQuality>("medium");
  const [gpu, setGpu] = useState<GpuClass>("unknown");
  const [realtime, setRealtime] = useState<RealtimeStatus>("idle");
  const [phase, setPhase] = useState<HeroRealtimePhase | null>(null);
  const [failure, setFailure] = useState<HeroRealtimeFailure | null>(null);
  const [ladder, setLadder] = useState(0);
  const [warm, setWarm] = useState(false);
  const [media, dispatchMedia] = useReducer(mediaReducer, INITIAL_MEDIA_STATE);

  // Progress: one unpinned ScrollTrigger + jump catch-up on the GSAP ticker.
  useEffect(() => {
    const section = anchor.current?.closest<HTMLElement>("[data-hero]") ?? null;
    sectionRef.current = section;
    if (!section) return;

    let currentLadder = 0;
    let zone = -1;
    let warmed = false;
    let copyOpacity = -1;
    const publish = () => {
      const p = progress.displayed;
      // The copy leaves during the departure (GSAP-ticker-owned DOM value, not
      // React state). Without JS it simply scrolls away.
      const opacity = copyOpacityAt(p);
      // Endpoints are always written exactly (0 and 1 must never stick at ±0.001).
      const endpoint = (opacity === 0 || opacity === 1) && opacity !== copyOpacity;
      if (endpoint || Math.abs(opacity - copyOpacity) > 0.001) {
        copyOpacity = opacity;
        section.style.setProperty("--hero-copy-opacity", opacity.toFixed(3));
        section.toggleAttribute("data-copy-hidden", opacity <= 0.001);
      }
      const nextLadder = ladderIndex(currentLadder, p);
      if (nextLadder !== currentLadder) {
        currentLadder = nextLadder;
        setLadder(nextLadder);
      }
      const nextZone = mediaZone(p);
      if (nextZone !== zone) {
        zone = nextZone;
        dispatchMedia({ type: "progress", progress: p });
      }
      if (!warmed && p >= WARM_PROGRESS) {
        warmed = true;
        setWarm(true);
      }
    };

    const scroll = ScrollTrigger.create({
      trigger: section,
      start: "top top",
      end: "bottom bottom",
      onUpdate: (self) => progress.setRaw(self.progress, performance.now()),
      onRefresh: (self) => progress.setRaw(self.progress, performance.now()),
    });
    trigger.current = scroll;
    progress.setRaw(scroll.progress, performance.now());
    progress.snap();
    publish();

    const tick = () => {
      progress.update(performance.now());
      publish();
    };
    gsap.ticker.add(tick);

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry) return;
        const wasVisible = visibility.current.visible;
        visibility.current = { visible: entry.isIntersecting, ratio: entry.intersectionRatio };
        if (!wasVisible && entry.isIntersecting) progress.snap();
        dispatchMedia({ type: "visibility", ratio: entry.intersectionRatio });
      },
      { threshold: [0, 0.25, 0.5, 0.75, 1] },
    );
    observer.observe(section);
    void document.fonts?.ready.then(() => ScrollTrigger.refresh());

    return () => {
      scroll.kill();
      trigger.current = null;
      gsap.ticker.remove(tick);
      observer.disconnect();
    };
  }, [progress]);

  // Rendering path + tier (after mount; the server markup never depends on them).
  useEffect(() => {
    const nextOverrides = readHeroOverrides(window.location.search);
    const reducedMotion = window.matchMedia(REDUCED_MOTION_QUERY);
    const signals = readHeroSignals({
      reducedMotion: reducedMotion.matches,
      allowSoftwareWebGL: nextOverrides.allowSoftware,
    });
    const decided = nextOverrides.path ?? resolveHeroRenderPath(signals);
    /* eslint-disable react-hooks/set-state-in-effect -- one-time client-only decision after hydration */
    setOverrides(nextOverrides);
    setTier(nextOverrides.tier ?? resolveHeroTier(signals));
    setGpu(signals.gpu);
    setPath(decided);
    /* eslint-enable react-hooks/set-state-in-effect */
    if (decided === "media" && signals.saveData) dispatchMedia({ type: "autoplayRefused" });

    // Turning reduced motion on mid-visit hands over to stills and stays there.
    const onChange = () => {
      if (reducedMotion.matches) setPath("reduced");
    };
    reducedMotion.addEventListener("change", onChange);
    return () => reducedMotion.removeEventListener("change", onChange);
  }, []);

  // Real-time loads after the page has loaded, when the browser is idle.
  useEffect(() => {
    if (path !== "realtime" || realtime !== "idle") return;
    let cancelled = false;
    let cancelIdle = () => {};
    let timer = 0;
    const start = () => {
      timer = window.setTimeout(() => {
        cancelIdle = onIdle(() => {
          if (!cancelled) setRealtime("loading");
        }, 1500);
      }, overrides.delayRealtimeMs);
    };
    if (document.readyState === "complete") start();
    else window.addEventListener("load", start, { once: true });
    return () => {
      cancelled = true;
      cancelIdle();
      window.clearTimeout(timer);
      window.removeEventListener("load", start);
    };
  }, [path, realtime, overrides.delayRealtimeMs]);

  const onRuntime = useCallback((instance: HeroRuntime | null) => {
    runtime.current = instance;
  }, []);
  const onActive = useCallback(() => setRealtime("active"), []);
  const onFailed = useCallback((reason: HeroRealtimeFailure) => {
    // Keep the first reason: unmounting the failed canvas also loses its context.
    setFailure((first) => first ?? reason);
    setRealtime("failed");
  }, []);

  const realtimeMounted = path === "realtime" && (realtime === "loading" || realtime === "active");
  const ladderMode = realtime === "active" && path === "realtime" ? "standby" : "primary";
  const stillIndex = path === "media" ? STILL_INDEX[mediaStill(media)] : ladder;

  // Inspector for the debug panel and test hooks (never in production builds).
  const inspectorState = useRef({
    path,
    tier,
    gpu,
    realtime,
    phase,
    failure,
    ladder: stillIndex,
    media,
    overrides,
  });
  useEffect(() => {
    inspectorState.current = {
      path,
      tier,
      gpu,
      realtime,
      phase,
      failure,
      ladder: stillIndex,
      media,
      overrides,
    };
  });
  const inspector = useMemo<HeroInspector | null>(() => {
    if (!DEV_TOOLS) return null;
    return {
      get path() {
        return inspectorState.current.path;
      },
      get tier() {
        return inspectorState.current.tier;
      },
      get gpu() {
        return inspectorState.current.gpu;
      },
      get realtime() {
        return inspectorState.current.realtime;
      },
      get phase() {
        return inspectorState.current.phase;
      },
      get failure() {
        return inspectorState.current.failure;
      },
      get ladderIndex() {
        return inspectorState.current.ladder;
      },
      get media() {
        return inspectorState.current.media;
      },
      get overrides() {
        return inspectorState.current.overrides;
      },
      get progress() {
        return { raw: progress.raw, displayed: progress.displayed };
      },
      get runtime() {
        return runtime.current;
      },
      get heroScrollTriggers() {
        return ScrollTrigger.getAll().filter((t) => t.trigger === sectionRef.current).length;
      },
      get section() {
        return sectionRef.current;
      },
    };
  }, [progress]);
  useEffect(() => {
    if (!DEV_TOOLS || !inspector) return;
    window.__BSR_HERO__ = inspector;
    return () => {
      if (window.__BSR_HERO__ === inspector) delete window.__BSR_HERO__;
    };
  }, [inspector]);

  return (
    <div
      ref={anchor}
      className="absolute inset-0"
      data-hero-path={path}
      data-hero-realtime={realtime}
    >
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <HeroStillLadder index={stillIndex} mode={ladderMode} warm={warm} />
        {path === "media" && (
          <HeroMediaPlayer
            state={media}
            dispatch={dispatchMedia}
            warmB={media.progress >= 0.2 || media.played.A}
          />
        )}
        {realtimeMounted && (
          <div
            className="absolute inset-0 transition-opacity duration-(--duration-slow) ease-ui"
            style={{ opacity: realtime === "active" ? 1 : 0 }}
            data-hero-canvas
          >
            <HeroRealtime
              progress={progress}
              tier={tier}
              // A forced tier (test/debug URL) starts at that tier's own level.
              reducedScale={gpu === "weak" && !overrides.tier}
              visibility={visibility}
              relaxLimits={overrides.allowSoftware}
              simulateAssetFailure={overrides.failAssets}
              audit={DEV_TOOLS}
              onRuntime={onRuntime}
              onPhase={setPhase}
              onActive={onActive}
              onFailed={onFailed}
            />
          </div>
        )}
      </div>

      {path === "media" && media.active && (
        <div className="absolute top-[calc(var(--spacing-gutter)+4.5rem)] right-(--spacing-gutter) z-(--z-content)">
          <IconButton
            icon={media.active.userPaused ? Play : Pause}
            label={media.active.userPaused ? heroContent.media.play : heroContent.media.pause}
            variant="inverse"
            size="sm"
            onClick={() =>
              dispatchMedia({ type: media.active?.userPaused ? "userResume" : "userPause" })
            }
          />
        </div>
      )}

      {DEV_TOOLS && HeroDebugPanel && overrides.debug && inspector && (
        <HeroDebugPanel inspector={inspector} trigger={trigger} />
      )}
    </div>
  );
}
