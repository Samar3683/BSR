"use client";

import { useEffect } from "react";

const TARGETS = "[data-reveal]";

/** Enough to count as "entered": its top above the lowest 12% of the viewport. */
const ENTER_MARGIN = "0px 0px -12% 0px";

interface NavigatorHints {
  deviceMemory?: number;
  connection?: { saveData?: boolean };
}

/** A low-power device or a data-saving reader: no parallax (see styles/motion.css). */
function isLite() {
  const hints = navigator as Navigator & NavigatorHints;
  return (
    (hints.deviceMemory ?? 8) < 4 ||
    (navigator.hardwareConcurrency ?? 8) < 4 ||
    hints.connection?.saveData === true
  );
}

const inViewport = (element: Element) => {
  const box = element.getBoundingClientRect();
  return box.top < window.innerHeight && box.bottom > 0;
};

/**
 * Drives the page's entry motion (styles/motion.css): one IntersectionObserver
 * marks each `[data-reveal]` element `data-inview` as it enters, and clears
 * it once the element has left through the bottom of the viewport (unless
 * `data-reveal-once`), so reveals replay on the way back down.
 *
 * First paint is safe: whatever is already on screen is marked shown before
 * the hidden states are switched on (html[data-reveal-ready]), so nothing
 * visible ever blinks out. Elements added later (client components swapping
 * their markup) are picked up by a MutationObserver the same way.
 * Renders nothing; mount it once per page tree (the site layout does).
 */
export function RevealController() {
  useEffect(() => {
    const root = document.documentElement;
    if (isLite()) root.setAttribute("data-motion-lite", "");

    const enter = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) entry.target.setAttribute("data-inview", "");
        }
      },
      { rootMargin: ENTER_MARGIN },
    );
    // Cleared only when entirely below the viewport: never while still visible.
    const leave = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        const { target } = entry;
        if (
          !entry.isIntersecting &&
          entry.boundingClientRect.top > 0 &&
          !target.hasAttribute("data-reveal-once")
        ) {
          target.removeAttribute("data-inview");
        }
      }
    });

    const track = (element: Element) => {
      if (inViewport(element)) element.setAttribute("data-inview", "");
      enter.observe(element);
      leave.observe(element);
    };
    const trackWithin = (node: Node) => {
      if (!(node instanceof Element)) return;
      if (node.matches(TARGETS)) track(node);
      node.querySelectorAll(TARGETS).forEach(track);
    };

    document.querySelectorAll(TARGETS).forEach(track);
    root.setAttribute("data-reveal-ready", "");

    const added = new MutationObserver((records) => {
      for (const record of records) record.addedNodes.forEach(trackWithin);
    });
    added.observe(document.body, { childList: true, subtree: true });

    return () => {
      added.disconnect();
      enter.disconnect();
      leave.disconnect();
      root.removeAttribute("data-reveal-ready");
    };
  }, []);

  return null;
}
