"use client";

import { REDUCED_MOTION_QUERY } from "@/lib/accessibility/reduced-motion";

import { useMediaQuery } from "./use-media-query";

/**
 * `true` when the user prefers reduced motion. Reports `true` until the
 * preference is known on the client, so motion never starts before it has
 * been confirmed as acceptable.
 */
export function useReducedMotion(): boolean {
  return useMediaQuery(REDUCED_MOTION_QUERY, true);
}
