"use client";

import "lenis/dist/lenis.css";

import Lenis from "lenis";
import { useEffect, type ReactNode } from "react";

import { smoothScrollConfig } from "@/config/scroll";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { gsap, ScrollTrigger } from "@/lib/animation/gsap";

// GSAP's default lag smoothing, restored when Lenis is torn down.
const DEFAULT_LAG_THRESHOLD_MS = 500;
const DEFAULT_LAG_ADJUSTED_MS = 33;

const KEYBOARD_SCROLL_KEYS = new Set([
  "ArrowUp",
  "ArrowDown",
  "PageUp",
  "PageDown",
  "Home",
  "End",
  " ",
]);

/**
 * Runs Lenis on GSAP's ticker so smooth scroll, ScrollTrigger and every GSAP
 * timeline advance on the same frame. Under reduced motion Lenis is never
 * created and the page uses native scrolling.
 */
export function SmoothScrollProvider({ children }: { children: ReactNode }) {
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    if (reducedMotion || !smoothScrollConfig.enabled) return;

    const lenis = new Lenis({ ...smoothScrollConfig.options, autoRaf: false });
    const onTick = (time: number) => lenis.raf(time * 1000);

    lenis.on("scroll", ScrollTrigger.update);
    gsap.ticker.add(onTick);
    // Lenis interpolates towards the target itself; GSAP's lag compensation
    // would make scroll-linked animation stutter after a dropped frame.
    gsap.ticker.lagSmoothing(0);

    // Lenis ignores native scroll events while interpolating a wheel gesture,
    // so a keyboard scroll pressed mid-animation would be overridden. Settle
    // the animation where it is and let the native keyboard scroll win.
    const onKeyDown = (event: KeyboardEvent) => {
      if (lenis.isScrolling === "smooth" && KEYBOARD_SCROLL_KEYS.has(event.key)) {
        lenis.scrollTo(lenis.actualScroll, { immediate: true, force: true });
      }
    };
    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      gsap.ticker.remove(onTick);
      gsap.ticker.lagSmoothing(DEFAULT_LAG_THRESHOLD_MS, DEFAULT_LAG_ADJUSTED_MS);
      lenis.destroy();
    };
  }, [reducedMotion]);

  return children;
}
