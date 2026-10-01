import type { LenisOptions } from "lenis";

/**
 * Lenis configuration. Kept close to native behaviour: touch scrolling stays
 * native, anchors are left to the browser (so skip links move focus), and
 * Lenis never starts under reduced motion.
 */
export const smoothScrollConfig = {
  enabled: true,
  options: {
    lerp: 0.1,
    smoothWheel: true,
    syncTouch: false,
    anchors: false,
  },
} as const satisfies { enabled: boolean; options: LenisOptions };
