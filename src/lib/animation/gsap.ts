/**
 * The single entry point for GSAP. Import `gsap`, `ScrollTrigger` and
 * `useGSAP` from here, never from "gsap" directly (enforced by ESLint), so
 * plugins and project eases are always registered exactly once before use.
 *
 * Registration only runs in the browser; on the server this module is inert.
 */
import { useGSAP } from "@gsap/react";
import { gsap } from "gsap";
import { CustomEase } from "gsap/CustomEase";
import { ScrollTrigger } from "gsap/ScrollTrigger";

import {
  MOTION_DURATION,
  MOTION_EASE,
  MOTION_EASE_CURVES,
  type MotionEaseName,
} from "./motion-tokens";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger, CustomEase, useGSAP);

  for (const name of Object.keys(MOTION_EASE) as MotionEaseName[]) {
    CustomEase.create(MOTION_EASE[name], MOTION_EASE_CURVES[name].join(","));
  }

  gsap.defaults({ duration: MOTION_DURATION.normal, ease: MOTION_EASE.ui });

  // Mobile browsers resize the viewport when the address bar shows/hides;
  // refreshing every trigger on that would cause visible jumps mid-scroll.
  ScrollTrigger.config({ ignoreMobileResize: true });
}

export { gsap, ScrollTrigger, useGSAP };
