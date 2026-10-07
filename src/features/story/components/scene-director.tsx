"use client";

import { useEffect } from "react";

import { SCENE_PROGRESS_EVENT } from "@/lib/animation/scene-events";

import {
  parseRange,
  pinnedProgress,
  readingStep,
  scrollForStep,
  stepAt,
  viewProgress,
} from "../lib/progress";

/** Scenes this far outside the viewport still update, so they arrive already in place. */
const NEAR = "60% 0px 60% 0px";
/** In a plain list, a step becomes current once its top passes this share of the viewport. */
const READING_LINE = 0.6;

const REDUCED = "(prefers-reduced-motion: reduce)";

/**
 * Drives the film below the hero (styles/cinematic.css). Mounted once by the
 * home page; renders nothing.
 *
 * Every `[data-scene]` gets its progress as a CSS variable `--p` (0 → 1):
 *
 * - `data-scene="pin"`: a pinned scene — a tall track whose `[data-stage]`
 *   sticks while the track scrolls past. Progress runs from the stage
 *   pinning to the stage releasing. Whether it pins is decided by CSS (the
 *   `pin:` variants: motion allowed, screen large enough); the director reads
 *   the result and marks the scene `data-pinned` while it does.
 * - `data-scene="view"`: a scene that scrolls normally; progress runs from its
 *   top entering to its bottom leaving.
 *
 * With `data-steps="n"` the scene also has a current step: from the progress
 * (over `data-step-range`, default the whole scene) when pinned, else from
 * the reading position of its items. Every `[data-step-item="i"]` of the
 * scene is marked `data-state` past / active / future; items with
 * `data-step-aria` also carry `aria-current="step"` when current.
 * `[data-scene-jump="i"]` controls scroll the window to step i.
 *
 * State is a pure function of the scroll position (lib/progress.ts): any
 * scroll — fast, reversed, a jump, a reload mid-page — lands on a complete
 * frame. Work is per frame, only for scenes near the viewport, and never
 * touches React state. The progress CSS variables are written even under
 * reduced motion (styles ignore them there), so steps stay current for
 * assistive technology.
 */
export function SceneDirector() {
  useEffect(() => {
    const root = document.documentElement;
    const scenes = [...document.querySelectorAll<HTMLElement>("[data-scene]")];
    if (scenes.length === 0) return;

    const pinned = new WeakMap<HTMLElement, boolean>();
    const near = new Set<HTMLElement>();
    let frame = 0;

    const itemsOf = (scene: HTMLElement) =>
      [...scene.querySelectorAll<HTMLElement>("[data-step-item]")].filter(
        (item) => item.closest("[data-scene]") === scene,
      );

    const measurePinning = () => {
      for (const scene of scenes) {
        const stage = scene.querySelector<HTMLElement>("[data-stage]");
        const isPinned =
          scene.dataset.scene === "pin" &&
          Boolean(stage) &&
          getComputedStyle(stage!).position === "sticky";
        pinned.set(scene, isPinned);
        scene.toggleAttribute("data-pinned", isPinned);
      }
    };

    const setStep = (scene: HTMLElement, step: number) => {
      if (scene.dataset.step === String(step)) return;
      scene.dataset.step = String(step);
      for (const item of itemsOf(scene)) {
        const index = Number(item.dataset.stepItem);
        item.dataset.state = index < step ? "past" : index === step ? "active" : "future";
        if (item.hasAttribute("data-step-aria")) {
          if (index === step) item.setAttribute("aria-current", "step");
          else item.removeAttribute("aria-current");
        }
      }
    };

    const apply = (scene: HTMLElement, viewport: number) => {
      const box = scene.getBoundingClientRect();
      const isPinned = pinned.get(scene) ?? false;
      const p = isPinned
        ? pinnedProgress(box.top, box.height, viewport)
        : viewProgress(box.top, box.height, viewport);
      const value = p.toFixed(4);
      if (scene.style.getPropertyValue("--p") !== value) {
        scene.style.setProperty("--p", value);
        scene.dispatchEvent(new CustomEvent(SCENE_PROGRESS_EVENT, { detail: p }));
      }

      const count = Number(scene.dataset.steps ?? 0);
      if (!count) return;
      if (isPinned) {
        const [from, to] = parseRange(scene.dataset.stepRange);
        setStep(scene, stepAt(p, count, from, to));
      } else {
        // The first laid-out item of each step marks where that step starts in
        // the list (items not rendered in this layout — a pinned-only readout —
        // have no box and are skipped).
        const tops: number[] = [];
        for (const item of itemsOf(scene)) {
          const index = Number(item.dataset.stepItem);
          if (tops[index] !== undefined || item.getClientRects().length === 0) continue;
          tops[index] = item.getBoundingClientRect().top;
        }
        setStep(scene, readingStep(tops, viewport * READING_LINE));
      }
    };

    const update = () => {
      frame = 0;
      const viewport = window.innerHeight;
      for (const scene of near) apply(scene, viewport);
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    const refresh = () => {
      measurePinning();
      const viewport = window.innerHeight;
      for (const scene of scenes) apply(scene, viewport);
    };

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const scene = entry.target as HTMLElement;
          if (entry.isIntersecting) near.add(scene);
          else near.delete(scene);
        }
        schedule();
      },
      { rootMargin: NEAR },
    );

    // A step control: scroll to the middle of that step (a plain list: to the item).
    const onClick = (event: MouseEvent) => {
      const control = (event.target as Element | null)?.closest<HTMLElement>("[data-scene-jump]");
      const scene = control?.closest<HTMLElement>("[data-scene]");
      if (!control || !scene) return;
      const index = Number(control.dataset.sceneJump);
      const smooth = !window.matchMedia(REDUCED).matches;
      if (pinned.get(scene)) {
        const box = scene.getBoundingClientRect();
        const [from, to] = parseRange(scene.dataset.stepRange);
        const top = scrollForStep(
          box.top + window.scrollY,
          box.height,
          window.innerHeight,
          index,
          Number(scene.dataset.steps ?? 1),
          from,
          to,
        );
        window.scrollTo({ top, behavior: smooth ? "smooth" : "auto" });
      } else {
        itemsOf(scene)
          .find((item) => Number(item.dataset.stepItem) === index)
          ?.scrollIntoView({ block: "center", behavior: smooth ? "smooth" : "auto" });
      }
    };

    const motion = window.matchMedia(REDUCED);
    root.setAttribute("data-scenes", "");
    refresh();
    for (const scene of scenes) observer.observe(scene);
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", refresh);
    motion.addEventListener("change", refresh);
    document.addEventListener("click", onClick);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", refresh);
      motion.removeEventListener("change", refresh);
      document.removeEventListener("click", onClick);
      root.removeAttribute("data-scenes");
    };
  }, []);

  return null;
}
