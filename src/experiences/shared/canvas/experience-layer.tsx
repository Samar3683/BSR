"use client";

import dynamic from "next/dynamic";
import type { ReactNode } from "react";

import { ErrorBoundary } from "@/components/feedback/error-boundary";
import { QUALITY_PROFILES } from "@/config/performance";
import { cx } from "@/lib/utils/cx";
import { isRealtimeQuality } from "@/lib/performance/quality";
import { useExperienceStore } from "@/stores/experience-store";
import { usePerformanceStore } from "@/stores/performance-store";

const ExperienceCanvas = dynamic(
  () => import("./experience-canvas").then((module) => module.ExperienceCanvas),
  { ssr: false },
);

const PLACEMENT = {
  /** A viewport-wide layer beneath the page (default). */
  fixed: "fixed inset-0",
  /** Fills its positioned parent, e.g. a section's sticky stage. */
  contained: "absolute inset-0",
} as const;

/**
 * Progressive-enhancement boundary for real-time WebGL driven by the global
 * quality tier.
 *
 * - Renders nothing until capabilities are known, and nothing on the
 *   `fallback` tier — page content never depends on this layer.
 * - Lazy-loads the Three.js bundle only when it will actually be used.
 * - Contains render failures and context loss, degrading to HTML only.
 * - Decorative: hidden from assistive technology and pointer input.
 *
 * (The home hero has its own path/tier decisions and uses ExperienceCanvas
 * directly — see experiences/home/components/hero-realtime.tsx.)
 */
export function ExperienceLayer({
  children,
  placement = "fixed",
}: {
  children?: ReactNode;
  placement?: keyof typeof PLACEMENT;
}) {
  const quality = usePerformanceStore((state) => state.quality);
  const canvasStatus = useExperienceStore((state) => state.canvasStatus);
  const setCanvasStatus = useExperienceStore((state) => state.setCanvasStatus);

  if (!isRealtimeQuality(quality) || canvasStatus === "failed") return null;

  return (
    <div
      aria-hidden="true"
      className={cx("pointer-events-none z-(--z-canvas)", PLACEMENT[placement])}
    >
      <ErrorBoundary onError={() => setCanvasStatus("failed")}>
        <ExperienceCanvas profile={QUALITY_PROFILES[quality]}>{children}</ExperienceCanvas>
      </ErrorBoundary>
    </div>
  );
}
