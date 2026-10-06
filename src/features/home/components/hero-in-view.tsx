"use client";

import { useEffect } from "react";

/**
 * Marks `html[data-hero-in-view]` while the hero is on screen (one
 * IntersectionObserver, no per-scroll work). styles/motion.css pauses the
 * below-hero parallax meanwhile: those pictures are below the fold then, and
 * composited layers moving with every scroll would compete with the
 * real-time hero for frames. Mounted by the home page only; without
 * JavaScript the attribute is never set and nothing changes.
 */
export function HeroInView() {
  useEffect(() => {
    const root = document.documentElement;
    const hero = document.querySelector("[data-hero]");
    if (!hero) return;
    const observer = new IntersectionObserver(([entry]) => {
      root.toggleAttribute("data-hero-in-view", Boolean(entry?.isIntersecting));
    });
    observer.observe(hero);
    return () => {
      observer.disconnect();
      root.removeAttribute("data-hero-in-view");
    };
  }, []);

  return null;
}
