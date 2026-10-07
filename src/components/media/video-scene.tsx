"use client";

import { useEffect, useRef, useState } from "react";

import { cx } from "@/lib/utils/cx";

const REDUCED = "(prefers-reduced-motion: reduce)";
const PHONE = "(max-width: 47.99rem)";

interface VideoSceneProps {
  src: string;
  /** A lighter cut for phones (9:16 or 4:5). */
  mobileSrc?: string;
  type?: string;
  /** The picture under the clip; shown before it plays, if it fails, and under reduced motion. */
  poster?: string;
  className?: string;
}

/**
 * A decorative video loop over a scene's picture: muted, inline, looping —
 * loaded only when near the viewport, played only while visible, paused off
 * screen. Never plays under reduced motion or with data saving; if the clip
 * fails to load it removes itself and the picture underneath stays. Only one
 * clip plays per screen in practice: the others are off screen, paused.
 */
export function VideoScene({
  src,
  mobileSrc,
  type = "video/mp4",
  poster,
  className,
}: VideoSceneProps) {
  const ref = useRef<HTMLVideoElement>(null);
  const [state, setState] = useState<"off" | "on" | "failed">("off");

  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection
      ?.saveData;
    if (window.matchMedia(REDUCED).matches || saveData) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          if (!video.src) {
            video.src = mobileSrc && window.matchMedia(PHONE).matches ? mobileSrc : src;
          }
          setState((current) => (current === "failed" ? current : "on"));
          video.play().catch(() => undefined);
        } else {
          video.pause();
        }
      },
      { rootMargin: "25% 0px" },
    );
    observer.observe(video);
    return () => observer.disconnect();
  }, [src, mobileSrc]);

  if (state === "failed") return null;
  return (
    <video
      ref={ref}
      aria-hidden="true"
      muted
      loop
      playsInline
      preload="none"
      poster={poster}
      data-type={type}
      onError={() => setState("failed")}
      className={cx(
        "absolute inset-0 h-full w-full object-cover transition-opacity duration-700",
        state === "on" ? "opacity-100" : "opacity-0",
        className,
      )}
    />
  );
}
