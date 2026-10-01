"use client";

import type { ReactNode } from "react";

import { CapabilityDetector } from "./capability-detector";
import { SmoothScrollProvider } from "./smooth-scroll-provider";

/**
 * The single client boundary for app-wide providers. Server-rendered
 * children pass through untouched; add new global providers here rather than
 * nesting them in layouts.
 */
export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <SmoothScrollProvider>
      <CapabilityDetector />
      {children}
    </SmoothScrollProvider>
  );
}
