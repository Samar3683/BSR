"use client";

import { useEffect, useRef } from "react";

import { SCENE_PROGRESS_EVENT } from "@/lib/animation/scene-events";
import { cx } from "@/lib/utils/cx";

const REDUCED = "(prefers-reduced-motion: reduce)";
const PHONE = "(max-width: 47.99rem)";
/** Frames requested at once while a sequence loads. */
const CONCURRENCY = 6;
/** A timed (not scrubbed) sequence plays at this rate. */
const LOOP_FPS = 24;

/** "/x/{0000}.webp" + 7 → "/x/0007.webp" (frames are numbered from 1). */
export function frameUrl(pattern: string, index: number): string {
  return pattern.replace(/\{(0+)\}/, (_, zeros: string) =>
    String(index + 1).padStart(zeros.length, "0"),
  );
}

interface MediaSequenceProps {
  pattern: string;
  frames: number;
  mobilePattern?: string;
  mobileFrames?: number;
  /** Follow the scene's scroll progress (default) or play as a timed loop. */
  scrub?: boolean;
  /** object-position of the frames, like the picture's focal point. */
  position?: string;
  className?: string;
}

/**
 * An image sequence on a canvas, over a scene's picture — the alternative to
 * WebGL or video for scroll-controlled moments (a truck turning, a forklift
 * lifting): 100–300 numbered frames.
 *
 * - Loads only once its scene is near the viewport, frame 1 first, then the
 *   rest a few at a time; until a frame exists the nearest loaded one is
 *   drawn (and before any, the picture underneath shows).
 * - Scrubbed: the frame follows the enclosing scene's progress (the
 *   SceneDirector's `sceneprogress` event) — no listener of its own on
 *   scroll. Timed: plays at 24 fps while visible.
 * - Phones load the lighter set; reduced motion and data saving draw nothing
 *   (the picture stays); a frame that fails to load is skipped.
 */
export function MediaSequence({
  pattern,
  frames,
  mobilePattern,
  mobileFrames,
  scrub = true,
  position = "50% 50%",
  className,
}: MediaSequenceProps) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection
      ?.saveData;
    // Reduced motion or data saving: draw nothing — the picture underneath stays.
    if (!canvas || saveData || window.matchMedia(REDUCED).matches) return;
    const context = canvas.getContext("2d");
    if (!context) return;

    const phone = window.matchMedia(PHONE).matches && mobilePattern;
    const source = phone ? mobilePattern! : pattern;
    const count = phone ? (mobileFrames ?? frames) : frames;
    const images: (HTMLImageElement | null)[] = Array.from({ length: count }, () => null);
    const [px, py] = position.split(/\s+/).map((v) => parseFloat(v) / 100);
    let wanted = 0;
    let started = false;
    let disposed = false;
    let timer = 0;

    const nearestLoaded = (index: number) => {
      for (let d = 0; d < count; d++) {
        if (images[index - d]) return images[index - d];
        if (images[index + d]) return images[index + d];
      }
      return null;
    };

    const draw = () => {
      const image = nearestLoaded(wanted);
      if (!image) return;
      const { clientWidth: w, clientHeight: h } = canvas;
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      if (canvas.width !== Math.round(w * ratio)) canvas.width = Math.round(w * ratio);
      if (canvas.height !== Math.round(h * ratio)) canvas.height = Math.round(h * ratio);
      // Cover, at the focal point.
      const scale = Math.max(
        canvas.width / image.naturalWidth,
        canvas.height / image.naturalHeight,
      );
      const dw = image.naturalWidth * scale;
      const dh = image.naturalHeight * scale;
      context.drawImage(
        image,
        (canvas.width - dw) * (px ?? 0.5),
        (canvas.height - dh) * (py ?? 0.5),
        dw,
        dh,
      );
    };

    const load = () => {
      if (started) return;
      started = true;
      const order = [0, ...Array.from({ length: count - 1 }, (_, i) => i + 1)];
      let next = 0;
      const pump = () => {
        if (disposed || next >= order.length) return;
        const index = order[next++]!;
        const image = new Image();
        image.decoding = "async";
        image.onload = () => {
          images[index] = image;
          if (Math.abs(index - wanted) < 2 || index === 0) draw();
          pump();
        };
        image.onerror = pump;
        image.src = frameUrl(source, index);
      };
      for (let i = 0; i < CONCURRENCY; i++) pump();
    };

    const scene = canvas.closest<HTMLElement>("[data-scene]");
    const onProgress = (event: Event) => {
      const p = (event as CustomEvent<number>).detail;
      wanted = Math.round(p * (count - 1));
      draw();
    };

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) {
          window.clearInterval(timer);
          return;
        }
        load();
        if (!scrub) {
          window.clearInterval(timer);
          timer = window.setInterval(() => {
            wanted = (wanted + 1) % count;
            draw();
          }, 1000 / LOOP_FPS);
        }
      },
      { rootMargin: "50% 0px" },
    );
    observer.observe(canvas);
    if (scrub) scene?.addEventListener(SCENE_PROGRESS_EVENT, onProgress);

    return () => {
      disposed = true;
      observer.disconnect();
      window.clearInterval(timer);
      scene?.removeEventListener(SCENE_PROGRESS_EVENT, onProgress);
    };
  }, [pattern, frames, mobilePattern, mobileFrames, scrub, position]);

  return (
    <canvas
      ref={ref}
      aria-hidden="true"
      className={cx("absolute inset-0 h-full w-full motion-reduce:hidden", className)}
    />
  );
}
