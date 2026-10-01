"use client";

import { useEffect } from "react";

import { readDeviceSignals } from "@/lib/performance/device-signals";
import { resolveInitialQuality } from "@/lib/performance/quality";
import { usePerformanceStore } from "@/stores/performance-store";

/**
 * Detects device capabilities once after hydration and publishes the result
 * to the performance store. Also mirrors the tier onto
 * `<html data-experience-quality>` so CSS can style fallback media.
 */
export function CapabilityDetector() {
  const setCapabilities = usePerformanceStore((state) => state.setCapabilities);

  useEffect(() => {
    const signals = readDeviceSignals();
    const quality = resolveInitialQuality(signals);

    setCapabilities({ webgl: signals.webgl2 ? "supported" : "unsupported", quality });
    document.documentElement.dataset.experienceQuality = quality;
  }, [setCapabilities]);

  return null;
}
