"use client";

import { type Dispatch, useEffect, useRef, useState } from "react";

import { onIdle } from "@/lib/utils/idle";

import { HERO_CLIPS, type HeroClipId } from "../config/hero-assets";
import type { MediaEvent, MediaState } from "../motion/hero-media-chapters";

interface HeroMediaPlayerProps {
  state: MediaState;
  dispatch: Dispatch<MediaEvent>;
  /** Start fetching clip B (visitor is heading towards chapter B). */
  warmB: boolean;
}

const CLIP_IDS: HeroClipId[] = ["A", "B"];

/**
 * Phone media path: pre-rendered clips, muted and inline, triggered by the
 * chapter reducer (never scrubbed, never queued). Decorative — the pause
 * control lives outside this aria-hidden layer.
 */
export function HeroMediaPlayer({ state, dispatch, warmB }: HeroMediaPlayerProps) {
  const videos = useRef<Record<HeroClipId, HTMLVideoElement | null>>({ A: null, B: null });
  const [load, setLoad] = useState<Record<HeroClipId, boolean>>({ A: false, B: false });
  // Once clip B is worth fetching it stays loaded (derived during render, not in an effect).
  if (warmB && !load.B) setLoad({ ...load, B: true });

  useEffect(() => onIdle(() => setLoad((current) => ({ ...current, A: true })), 1500), []);

  const active = state.active;
  useEffect(() => {
    for (const id of CLIP_IDS) {
      const video = videos.current[id];
      if (!video) continue;
      if (active?.clip === id && !active.userPaused) {
        video.play().then(
          () => dispatch({ type: "autoplayAllowed" }),
          () => dispatch({ type: "autoplayRefused" }),
        );
      } else if (!video.paused) {
        video.pause();
      }
    }
  }, [active, dispatch]);

  return CLIP_IDS.map((id) =>
    load[id] ? (
      <video
        key={id}
        ref={(element) => {
          videos.current[id] = element;
        }}
        muted
        playsInline
        preload="auto"
        disablePictureInPicture
        tabIndex={-1}
        data-clip={id}
        className="absolute inset-0 h-full w-full object-cover transition-opacity duration-(--duration-normal) ease-ui"
        style={{ opacity: active?.clip === id ? 1 : 0 }}
        onLoadedData={() => dispatch({ type: "ready", clip: id })}
        onEnded={() => dispatch({ type: "ended", clip: id })}
      >
        {HERO_CLIPS[id].sources.map((source) => (
          <source key={source.src} src={source.src} type={source.type} />
        ))}
      </video>
    ) : null,
  );
}
