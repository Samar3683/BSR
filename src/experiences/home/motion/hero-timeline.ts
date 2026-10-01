import { gsap } from "@/lib/animation/gsap";
import { MOTION_EASE } from "@/lib/animation/motion-tokens";

import { HERO_MARKS, HERO_STATES } from "../config/hero-states";
import { HERO_RIG } from "../config/hero-rig";
import { SHOT_INDEX } from "../config/hero-shots";

/**
 * Story values written by the ONE master timeline. Plain numbers, read by the
 * runtime each frame — never React state. Continuous motion (wheels, road,
 * springs) is not here: it belongs to the forward-only simulation.
 */
export interface StoryValues {
  /** Forward camera path position (integer = exact shot, see FORWARD_SHOTS). */
  shotT: number;
  headlights: number;
  markers: number;
  tailLights: number;
  dockLight: number;
  exposure: number;
  /** 0 = pre-dawn blue hour … 1 = early daylight. */
  dawn: number;
  /** Target dock distance D* (m). The simulation approaches it forward-only. */
  dockTarget: number;
  /** Road cruise speed target (m/s). */
  cruiseTarget: number;
  /** 0 = physical road … 1 = route language (Beat 5, Reach). */
  routeBlend: number;
  /** 0 = road-level route … 1 = the Italy network overview (Beat 6). */
  mapBlend: number;
  /** 0 … 1: the restrained "and beyond" Europe continuation at the very end. */
  europeBlend: number;
  /**
   * Journey chapter coordinate (Beat 4): 0–1 industrial outskirts, 1–2 service
   * corridor, 2–3 open road. Scenery reads it when slots respawn far ahead.
   */
  journey: number;
  /** Rises to 1 when the brakes release (the simulation reads the edge). */
  brakeRelease: number;
}

export function createStoryValues(): StoryValues {
  return {
    shotT: 0,
    headlights: 0,
    markers: 1,
    tailLights: 0.25,
    dockLight: 1,
    exposure: 1,
    dawn: 0,
    dockTarget: 0,
    cruiseTarget: 0,
    routeBlend: 0,
    mapBlend: 0,
    europeBlend: 0,
    journey: 0,
    brakeRelease: 0,
  };
}

const shot = (name: string) => SHOT_INDEX[name]!;

/**
 * Builds the master narrative timeline over `values`. Duration is exactly 1,
 * so `timeline.progress(p)` maps story progress directly. Paused: the frame
 * driver is its only clock.
 */
export function buildHeroTimeline(values: StoryValues): gsap.core.Timeline {
  const cinematic = MOTION_EASE.cinematic;
  const mechanical = MOTION_EASE.mechanical;
  const ui = MOTION_EASE.ui;
  const timeline = gsap.timeline({ paused: true, defaults: { ease: "none" } });

  for (const state of HERO_STATES) timeline.addLabel(state.name, state.start);

  timeline.set(values, { ...createStoryValues() }, 0);

  // Camera: detail → brand → full reveal (hold) → departure arc → trailer side.
  timeline
    .to(values, { shotT: shot("headlight"), duration: 0.08, ease: cinematic }, 0.12)
    .to(values, { shotT: shot("raking"), duration: 0.07, ease: cinematic }, 0.2)
    .to(
      values,
      { shotT: shot("hero"), duration: HERO_MARKS.holdStart - 0.27, ease: cinematic },
      0.27,
    )
    .to(
      values,
      {
        shotT: shot("rear-three-quarter"),
        duration: HERO_MARKS.rollStart - HERO_MARKS.holdEnd,
        ease: cinematic,
      },
      HERO_MARKS.holdEnd,
    )
    .to(
      values,
      {
        shotT: shot("trailer-side"),
        duration: HERO_MARKS.wipeStart - HERO_MARKS.rollStart,
        ease: cinematic,
      },
      HERO_MARKS.rollStart,
    )
    .to(
      values,
      { shotT: shot("road-tracking"), duration: 0.05, ease: cinematic },
      HERO_MARKS.wipeEnd,
    )
    // Reach: the camera rises over the truck as the lane line becomes the route,
    // then keeps rising until the route is seen running across Italy.
    .to(values, { shotT: shot("reach"), duration: 0.08, ease: cinematic }, 0.8)
    .to(values, { shotT: shot("italy"), duration: 0.1, ease: cinematic }, 0.88);

  // Vehicle lights: the truck wakes; departure brings the tail lights up.
  timeline
    .to(values, { headlights: 1, duration: 0.03, ease: ui }, 0.12)
    .to(values, { tailLights: 1, duration: 0.06, ease: ui }, 0.42)
    .to(values, { brakeRelease: 1, duration: 0.01 }, 0.43);

  // Light story: blue hour → first light → sunrise → early daylight.
  timeline
    .to(values, { exposure: 1, dawn: 0.25, duration: 0.15 }, 0.27)
    .to(values, { exposure: 1, dawn: 0.5, duration: 0.15 }, 0.42)
    .to(values, { exposure: 1, dawn: 0.8, duration: 0.09 }, HERO_MARKS.wipeEnd)
    .to(values, { exposure: 1.05, dawn: 1, duration: 0.18 }, 0.82);

  // Departure target (the simulation follows it forward-only) and road cruise.
  timeline
    .to(
      values,
      {
        dockTarget: HERO_RIG.wipeDistance,
        duration: HERO_MARKS.wipeStart - HERO_MARKS.rollStart,
        ease: mechanical,
      },
      HERO_MARKS.rollStart,
    )
    .to(values, { cruiseTarget: HERO_RIG.cruiseSpeed, duration: 0.03 }, HERO_MARKS.wipeStart);

  // Journey chapters: industrial outskirts → service corridor → open road → Reach.
  timeline
    .to(values, { journey: 1, duration: 0.05 }, HERO_MARKS.wipeEnd)
    .to(values, { journey: 2, duration: 0.055 }, 0.68)
    .to(values, { journey: 3, duration: 0.065 }, 0.735);

  // Road → route (Reach) → Italy network → "and beyond".
  timeline
    .to(values, { routeBlend: 1, duration: 0.08, ease: cinematic }, 0.8)
    .to(values, { mapBlend: 1, duration: 0.1, ease: cinematic }, 0.865)
    .to(values, { europeBlend: 1, duration: 0.03, ease: cinematic }, 0.97);

  // Pin the total duration to exactly 1.
  timeline.set({}, {}, 1);
  return timeline;
}
