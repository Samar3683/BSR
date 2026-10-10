"use client";

import { useEffect, useRef, useState } from "react";

import { REDUCED_MOTION_QUERY } from "@/lib/accessibility/reduced-motion";
import { gsap, ScrollTrigger } from "@/lib/animation/gsap";

import { HERO_VIDEO } from "../config/hero-video";
import { ProgressController } from "../motion/hero-progress";
import {
  fadeOut,
  type ScrubTiming,
  timeForProgress,
  trackAt,
  VideoScrubber,
  windowOpacity,
} from "../motion/video-scrub";
import styles from "./hero.module.css";

/** Build-time constant: test hooks exist only in development and test builds. */
const DEV_TOOLS =
  process.env.NODE_ENV !== "production" || process.env.NEXT_PUBLIC_BSR_HERO_TEST_HOOKS === "true";

type Mode = "pending" | "video" | "static";
type StaticReason = "reduced-motion" | "save-data" | "short-viewport" | "error" | "timeout";

/** Read-only state for tests and debugging (test builds only). */
export interface HeroVideoInspector {
  readonly mode: Mode;
  readonly reason: StaticReason | null;
  readonly ready: boolean;
  readonly src: string;
  readonly frame: number;
  readonly targetFrame: number;
  readonly duration: number;
  readonly seeks: number;
  readonly progress: { raw: number; displayed: number };
  readonly heroScrollTriggers: number;
}

declare global {
  interface Window {
    __BSR_HERO_VIDEO__?: HeroVideoInspector;
  }
}

interface NetworkInformationLike {
  saveData?: boolean;
  effectiveType?: string;
}

const connection = (): NetworkInformationLike | undefined =>
  (navigator as Navigator & { connection?: NetworkInformationLike }).connection;

/** Why the hero must stay static from the start (null: scrub the video). */
/** Too short to pin a full-screen scene without clipping the copy (must match hero.module.css). */
const SHORT_VIEWPORT_QUERY = "(max-height: 34rem)";

function initialStaticReason(): StaticReason | null {
  if (window.matchMedia(REDUCED_MOTION_QUERY).matches) return "reduced-motion";
  if (window.matchMedia(SHORT_VIEWPORT_QUERY).matches) return "short-viewport";
  const net = connection();
  if (net?.saveData || net?.effectiveType === "2g" || net?.effectiveType === "slow-2g") {
    return "save-data";
  }
  return null;
}

/** 720 p on compact layouts and slow connections; the full file elsewhere. */
function chooseSource(): string {
  const compact = window.matchMedia("(max-width: 47.99rem)").matches;
  const slow = connection()?.effectiveType === "3g";
  return compact || slow ? HERO_VIDEO.src.compact : HERO_VIDEO.src.full;
}

/**
 * Releases the pinned scroll distance (static hero) without moving what the
 * visitor is looking at: past the hero, the page keeps its place; inside the
 * pinned range, the visitor lands on the (now static) hero.
 */
function settleStatic(section: HTMLElement): void {
  if (section.dataset.heroMode === "static") return;
  const top = section.getBoundingClientRect().top + window.scrollY;
  const before = section.offsetHeight;
  const y = window.scrollY;
  section.dataset.heroMode = "static";
  const removed = before - section.offsetHeight;
  if (removed > 0) {
    if (y >= top + before - window.innerHeight) window.scrollTo(0, y - removed);
    else if (y > top) window.scrollTo(0, top);
  }
  ScrollTrigger.refresh();
}

/**
 * The hero's client island: one paused, muted video scrubbed by the hero's single
 * ScrollTrigger on the GSAP ticker (the page's one animation clock; Lenis already
 * smooths the scroll, so no further easing is stacked on it). The poster, the
 * headline and the actions are server-rendered HTML; this layer only adds the video
 * once a frame at the visitor's position is decoded, and drives the copy and cue
 * opacities through DOM writes (no React state per frame).
 */
export function HeroVideo() {
  const layer = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [mode, setMode] = useState<Mode>("pending");
  const [reason, setReason] = useState<StaticReason | null>(null);
  const [src, setSrc] = useState("");

  // Path decision after hydration (the server markup never depends on it).
  useEffect(() => {
    const section = layer.current?.closest<HTMLElement>("[data-hero]");
    const staticReason = initialStaticReason();
    /* eslint-disable react-hooks/set-state-in-effect -- one-time client-only decision after hydration */
    if (staticReason) {
      if (section) settleStatic(section);
      setReason(staticReason);
      setMode("static");
    } else {
      setSrc(chooseSource());
      setMode("video");
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    const section = layer.current?.closest<HTMLElement>("[data-hero]");
    const stage = layer.current?.closest<HTMLElement>("[data-hero-stage]");
    if (mode !== "video" || !video || !section || !stage || !src) return;

    const { media, hold, copyFade, cueFade } = HERO_VIDEO;
    const timing: ScrubTiming = {
      duration: media.duration,
      fps: media.fps,
      holdStart: hold.start,
      holdEnd: hold.end,
    };
    const cues = [...section.querySelectorAll<HTMLElement>("[data-hero-cue]")].flatMap((el) => {
      const cue = HERO_VIDEO.cues.find((c) => c.id === el.dataset.heroCue);
      return cue ? [{ el, cue, opacity: -1 }] : [];
    });
    const progress = new ProgressController();
    let ready = false;
    let disposed = false;
    let seeks = 0;
    let visible = true;
    let painted = -1;
    let copyOpacity = -1;
    let scrim = -1;
    let framingX = -1;
    // Must match the compact layout of hero.module.css (not wide-and-landscape-ish).
    const compact = window.matchMedia("not all and (min-width: 48rem) and (min-aspect-ratio: 4/5)");
    const onLayoutChange = () => {
      framingX = -1;
      painted = -1;
      if (!compact.matches) section.style.removeProperty("--hero-framing");
    };
    compact.addEventListener("change", onLayoutChange);

    const scrubber = new VideoScrubber(video, {
      timing,
      onSeeked: () => {
        seeks++;
        if (!ready) presentThenReveal();
      },
    });

    // ---- reveal: only once a decoded frame at the visitor's position is on screen
    const timers: Array<ReturnType<typeof setTimeout>> = [];
    const presentThenReveal = () => {
      const reveal = () => {
        if (ready || disposed) return;
        ready = true;
        stage.dataset.video = "ready";
        painted = -1; // cues may now show
      };
      const frame = video as HTMLVideoElement & {
        requestVideoFrameCallback?: (callback: () => void) => number;
      };
      frame.requestVideoFrameCallback?.(reveal);
      // rVFC is not fired for a paused seek in every engine: never wait on it alone.
      requestAnimationFrame(() => requestAnimationFrame(reveal));
    };

    // ---- failure: a static hero, never a broken player or a trapped pinned still
    const fail = (why: StaticReason) => {
      if (disposed) return;
      disposed = true;
      cleanup();
      settleStatic(section);
      setReason(why);
      setMode("static");
    };

    // ---- per-frame: progress → target frame, copy and cue opacity (DOM writes only on change)
    const paint = (time: number) => {
      const copy = fadeOut(time, copyFade.from, copyFade.to);
      if (
        Math.abs(copy - copyOpacity) > 0.002 ||
        ((copy === 0 || copy === 1) && copy !== copyOpacity)
      ) {
        copyOpacity = copy;
        section.style.setProperty("--hero-copy-opacity", copy.toFixed(3));
        section.toggleAttribute("data-copy-hidden", copy <= 0.001);
      }
      let strongest = copy;
      for (const entry of cues) {
        const value = ready ? windowOpacity(time, entry.cue.from, entry.cue.to, cueFade) : 0;
        strongest = Math.max(strongest, value);
        const unchanged =
          value === entry.opacity ||
          (Math.abs(value - entry.opacity) < 0.002 && value > 0 && value < 1);
        if (unchanged) continue;
        entry.opacity = value;
        entry.el.style.opacity = value.toFixed(3);
        // Invisible cues are out of the tab order and the accessibility tree.
        entry.el.inert = value < 0.02;
      }
      // Compact screens: the crop follows the subject (config framing.compactTrack).
      if (compact.matches) {
        const x = trackAt(time, HERO_VIDEO.framing.compactTrack);
        if (Math.abs(x - framingX) > 0.05) {
          framingX = x;
          section.style.setProperty("--hero-framing", `${x.toFixed(2)}% 50%`);
        }
      }
      if (
        Math.abs(strongest - scrim) > 0.002 ||
        (strongest !== scrim && (strongest === 0 || strongest === 1))
      ) {
        scrim = strongest;
        section.style.setProperty("--hero-scrim", strongest.toFixed(3));
      }
    };

    const trigger = ScrollTrigger.create({
      trigger: section,
      start: "top top",
      end: "bottom bottom",
      onUpdate: (self) => progress.setRaw(self.progress, performance.now()),
    });
    progress.setRaw(trigger.progress, performance.now());
    progress.snap(); // a reload mid-page starts where the visitor is

    const tick = (force = false) => {
      if (!visible && !force) return;
      progress.update(performance.now());
      const time = timeForProgress(progress.displayed, timing);
      scrubber.setTarget(time);
      if (time !== painted) {
        painted = time;
        paint(time);
      }
    };
    const onTick = () => tick();
    gsap.ticker.add(onTick);

    // Compact layouts size the footage band to what the copy leaves (measured on
    // resize only, never per frame); the CSS ignores it on wide layouts.
    const copyEl = section.querySelector<HTMLElement>("[data-hero-copy]");
    const measure = new ResizeObserver(() => {
      if (copyEl) section.style.setProperty("--hero-copy-h", `${copyEl.offsetHeight}px`);
    });
    if (copyEl) measure.observe(copyEl);
    section.setAttribute("data-hero-band", "");

    // Off screen (past the hero) nothing needs to run — after one last update, so the
    // video settles on the scroll position the hero left at (also when a fast scroll
    // carried it off screen between two ticks).
    const observer = new IntersectionObserver(([entry]) => {
      visible = Boolean(entry?.isIntersecting);
      if (!visible) {
        progress.snap();
        tick(true);
      }
    });
    observer.observe(section);

    // ---- loading: immediately, not after window.load or an idle callback
    const onMetadata = () => {
      if (Number.isFinite(video.duration) && video.duration > 0) {
        timing.duration = video.duration;
        scrubber.setTiming(timing);
        painted = -1;
      }
    };
    const onData = () => scrubber.enable();
    const onError = () => fail("error");
    video.addEventListener("loadedmetadata", onMetadata);
    video.addEventListener("loadeddata", onData);
    video.addEventListener("error", onError);
    video.muted = true;
    video.preload = "auto";
    video.src = src;
    video.load();

    // Some mobile browsers do not decode a paused video until it has played: a
    // muted play-and-pause primes it (refused in low-power modes → the timeout).
    timers.push(
      setTimeout(() => {
        if (video.readyState >= 2 || disposed) return;
        video
          .play()
          .then(() => video.pause())
          .catch(() => {});
      }, 2500),
    );
    timers.push(setTimeout(() => !ready && fail("timeout"), HERO_VIDEO.readyTimeoutMs));

    const reducedMotion = window.matchMedia(REDUCED_MOTION_QUERY);
    const onMotionChange = () => reducedMotion.matches && fail("reduced-motion");
    reducedMotion.addEventListener("change", onMotionChange);
    // Rotated to a landscape phone mid-visit: the CSS releases the pin, so stop scrubbing too.
    const shortViewport = window.matchMedia(SHORT_VIEWPORT_QUERY);
    const onShortChange = () => shortViewport.matches && fail("short-viewport");
    shortViewport.addEventListener("change", onShortChange);

    let fontsRefreshed = false;
    void document.fonts?.ready.then(() => {
      if (disposed || fontsRefreshed) return;
      fontsRefreshed = true;
      ScrollTrigger.refresh();
    });

    if (DEV_TOOLS) {
      window.__BSR_HERO_VIDEO__ = {
        mode: "video",
        reason: null,
        get ready() {
          return ready;
        },
        src,
        get frame() {
          return scrubber.frame;
        },
        get targetFrame() {
          return scrubber.target;
        },
        get duration() {
          return timing.duration;
        },
        get seeks() {
          return seeks;
        },
        get progress() {
          return { raw: progress.raw, displayed: progress.displayed };
        },
        get heroScrollTriggers() {
          return ScrollTrigger.getAll().filter((t) => t.trigger === section).length;
        },
      };
    }

    function cleanup() {
      gsap.ticker.remove(onTick);
      trigger.kill();
      observer.disconnect();
      measure.disconnect();
      section!.removeAttribute("data-hero-band");
      section!.style.removeProperty("--hero-copy-h");
      scrubber.dispose();
      for (const timer of timers) clearTimeout(timer);
      reducedMotion.removeEventListener("change", onMotionChange);
      shortViewport.removeEventListener("change", onShortChange);
      compact.removeEventListener("change", onLayoutChange);
      section!.style.removeProperty("--hero-framing");
      video!.removeEventListener("loadedmetadata", onMetadata);
      video!.removeEventListener("loadeddata", onData);
      video!.removeEventListener("error", onError);
      // Stop the download (an unmounted or failed hero must not keep fetching).
      video!.removeAttribute("src");
      video!.load();
      delete stage!.dataset.video;
      section!.style.removeProperty("--hero-copy-opacity");
      section!.style.removeProperty("--hero-scrim");
      section!.removeAttribute("data-copy-hidden");
      for (const entry of cues) {
        entry.el.style.removeProperty("opacity");
        entry.el.inert = false;
      }
      if (DEV_TOOLS) delete window.__BSR_HERO_VIDEO__;
    }

    return () => {
      if (disposed) return;
      disposed = true;
      cleanup();
    };
  }, [mode, src]);

  // Static hero: expose why (test builds), nothing else to run.
  useEffect(() => {
    if (!DEV_TOOLS || mode !== "static") return;
    const section = layer.current?.closest<HTMLElement>("[data-hero]");
    window.__BSR_HERO_VIDEO__ = {
      mode,
      reason,
      ready: false,
      src: "",
      frame: -1,
      targetFrame: -1,
      duration: 0,
      seeks: 0,
      progress: { raw: 0, displayed: 0 },
      get heroScrollTriggers() {
        return ScrollTrigger.getAll().filter((t) => t.trigger === section).length;
      },
    };
    return () => {
      delete window.__BSR_HERO_VIDEO__;
    };
  }, [mode, reason]);

  return (
    <div ref={layer} className={styles.videoLayer}>
      {mode === "video" && (
        <video
          ref={videoRef}
          className={styles.video}
          muted
          playsInline
          preload="none"
          disablePictureInPicture
          disableRemotePlayback
          aria-hidden="true"
          tabIndex={-1}
        />
      )}
    </div>
  );
}
