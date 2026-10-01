"use client";

import { useEffect, useState } from "react";

import { onIdle } from "@/lib/utils/idle";

import { HERO_STILLS, type HeroStillId } from "../config/hero-assets";
import { HeroPicture } from "./hero-picture";

interface HeroStillLadderProps {
  /** 0 = S1 (the server-rendered poster underneath) … 3 = S4. */
  index: number;
  /**
   * `primary`: stills are the visible hero (reduced, fallback, media paths, or
   * real-time not yet handed over). `standby`: real-time is visible; stills
   * are fetched only if they become needed (failure fallback).
   */
  mode: "primary" | "standby";
  /** Progress passed 0.15: fetch the road and route stills ahead of time. */
  warm: boolean;
}

const LADDER = HERO_STILLS.slice(1); // S1 is the poster, rendered by the server.

/**
 * The ladder of stills captured at the styleframe checkpoints. Each layer
 * fades in (opacity only — valid under reduced motion) once loaded and
 * reached; nothing downloads before it is useful.
 */
export function HeroStillLadder({ index, mode, warm }: HeroStillLadderProps) {
  const [requested, setRequested] = useState<ReadonlySet<HeroStillId>>(new Set());
  const [loaded, setLoaded] = useState<ReadonlySet<HeroStillId>>(new Set());

  // Stills needed now (reached, or warmed ahead) — accumulated during render.
  const needed = LADDER.filter((_, k) => index >= k + 1).map((still) => still.id);
  if (mode === "primary" && warm) needed.push("S3", "S4");
  if (needed.some((id) => !requested.has(id))) setRequested(new Set([...requested, ...needed]));

  // S2 is prefetched when the browser is idle.
  useEffect(() => {
    if (mode !== "primary") return;
    return onIdle(
      () => setRequested((current) => (current.has("S2") ? current : new Set([...current, "S2"]))),
      2000,
    );
  }, [mode]);

  return LADDER.map((still, k) =>
    requested.has(still.id) ? (
      <HeroPicture
        key={still.id}
        still={still}
        className="transition-opacity duration-(--duration-normal) ease-ui"
        style={{ opacity: index >= k + 1 && loaded.has(still.id) ? 1 : 0 }}
        onLoad={() => setLoaded((current) => new Set([...current, still.id]))}
      />
    ) : null,
  );
}
