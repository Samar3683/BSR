import { HERO_MARKS } from "../config/hero-states";

/*
 * Story control: which world is active, and the scroll-back "return mode".
 *
 * The truck never drives backwards. When the visitor scrolls back through the
 * departure, the truck brakes and holds, the camera takes the return path
 * (along the trailer side, towards the cab) and — only while the trailer
 * covers ≥ 92% of the frame — the truck is re-based to the loading bay.
 */

/** Trailer coverage required for any concealed change. */
export const COVERAGE_THRESHOLD = 0.92;
/** Progress must fall this far below its peak before return mode starts. */
export const RETURN_TRIGGER_DROP = 0.01;
/** Minimum dock distance for return mode (below this the truck is still parked). */
export const RETURN_MIN_DISTANCE = 0.05;

export type HeroWorld = "dock" | "road";

export interface StoryControlState {
  world: HeroWorld;
  mode: "forward" | "return";
  /** Highest progress reached in forward mode since the last return. */
  peak: number;
  /** Progress at which return mode began (p_rev). */
  returnFrom: number;
  /** Progress at which the return path reaches the occluding trailer pass. */
  returnOcclusionAt: number;
  /** The concealed re-base has happened for this return. */
  rebased: boolean;
  /** Where the return began: scrolling back in the dock, or back through the wipe. */
  returnEntry: HeroWorld;
}

export const INITIAL_STORY_CONTROL: StoryControlState = {
  world: "dock",
  mode: "forward",
  peak: 0,
  returnFrom: 0,
  returnOcclusionAt: 0,
  rebased: false,
  returnEntry: "dock",
};

export interface StoryControlInput {
  progress: number;
  dockDistance: number;
  /** Current trailer coverage of the frame (0–1). */
  coverage: number;
}

export interface StoryControlResult {
  state: StoryControlState;
  /** Reset the truck to the loading bay (D = 0, speed = 0) — always concealed. */
  rebase: boolean;
  /** The active world changed this step (dock → road snaps D to the wipe pose). */
  switchedTo: HeroWorld | null;
}

/** Return-path occlusion point for a return that started at `returnFrom`. */
export function returnOcclusionProgress(returnFrom: number): number {
  return returnFrom - 0.4 * (returnFrom - HERO_MARKS.returnExit);
}

export function stepStoryControl(
  state: StoryControlState,
  input: StoryControlInput,
): StoryControlResult {
  const { progress: p, dockDistance, coverage } = input;
  const covered = coverage >= COVERAGE_THRESHOLD;

  // Dock → road (forward, through the trailer wipe).
  if (
    state.world === "dock" &&
    state.mode === "forward" &&
    p >= HERO_MARKS.wipeSwitchForward &&
    covered
  ) {
    return {
      state: { ...state, world: "road", peak: Math.max(state.peak, p) },
      rebase: false,
      switchedTo: "road",
    };
  }

  // Road → dock (reverse, back through the wipe): re-base under the same cover.
  if (state.world === "road") {
    if (p <= HERO_MARKS.wipeSwitchBack && covered) {
      return {
        state: {
          world: "dock",
          mode: "return",
          peak: p,
          returnFrom: p,
          returnOcclusionAt: p,
          rebased: true,
          returnEntry: "road",
        },
        rebase: true,
        switchedTo: "dock",
      };
    }
    return { state: { ...state, peak: Math.max(state.peak, p) }, rebase: false, switchedTo: null };
  }

  // Dock world.
  if (state.mode === "forward") {
    if (p < state.peak - RETURN_TRIGGER_DROP && dockDistance > RETURN_MIN_DISTANCE) {
      return {
        state: {
          ...state,
          mode: "return",
          returnFrom: p,
          returnOcclusionAt: returnOcclusionProgress(p),
          rebased: false,
          returnEntry: "dock",
        },
        rebase: false,
        switchedTo: null,
      };
    }
    return { state: { ...state, peak: Math.max(state.peak, p) }, rebase: false, switchedTo: null };
  }

  // Return mode. Leaves when the paths coincide again: at the return exit, or
  // once the visitor scrolls forward past the point where the return began.
  if (p <= HERO_MARKS.returnExit || p > state.returnFrom) {
    return {
      state: { ...state, mode: "forward", peak: p },
      rebase: false,
      switchedTo: null,
    };
  }
  if (!state.rebased && covered) {
    return { state: { ...state, rebased: true }, rebase: true, switchedTo: null };
  }
  return { state, rebase: false, switchedTo: null };
}

/**
 * Occlusion gates. If a single frame would carry the story across a point
 * where a concealed change must happen, the story is held at that point for
 * one frame (the camera is then in its occluding pose), so the change always
 * happens under cover — even on fast scrolls.
 */
export function gateProgress(state: StoryControlState, previous: number, next: number): number {
  const { wipeSwitchForward, wipeSwitchBack } = HERO_MARKS;

  if (
    state.world === "dock" &&
    state.mode === "forward" &&
    previous < wipeSwitchForward &&
    next > wipeSwitchForward
  ) {
    return wipeSwitchForward;
  }
  if (state.world === "road" && previous > wipeSwitchBack && next < wipeSwitchBack) {
    return wipeSwitchBack;
  }
  if (
    state.world === "dock" &&
    state.mode === "return" &&
    !state.rebased &&
    previous > state.returnOcclusionAt &&
    next < state.returnOcclusionAt
  ) {
    return state.returnOcclusionAt;
  }
  return next;
}
