import type { HeroClipId, HeroStillId } from "../config/hero-assets";

/*
 * Phone media path: two chapters, each with one short clip triggered by
 * scroll position (never scrubbed). Pure reducer, so the rules are testable:
 *
 *   - at most one clip active; nothing ever queues
 *   - scrolling past a chapter before/while its clip plays cancels it and
 *     shows the chapter's final still
 *   - each clip plays at most once per page view; returning never replays
 *   - playback stops when the hero is mostly offscreen and does not resume
 *   - autoplay refusal (or data saver) → stills only
 */

export const CHAPTER_B_START = 0.35;
export const CLIP_A_START_BEFORE = 0.2;
export const CLIP_B_START_BEFORE = 0.75;
export const CLIP_B_CANCEL_AT = 0.9;
export const START_VISIBILITY = 0.5;
export const STOP_VISIBILITY = 0.25;

export interface MediaState {
  progress: number;
  visibility: number;
  ready: Record<HeroClipId, boolean>;
  /** Started, skipped or cancelled — either way it will not play (again). */
  played: Record<HeroClipId, boolean>;
  active: { clip: HeroClipId; userPaused: boolean } | null;
  autoplay: "unknown" | "allowed" | "refused";
}

export const INITIAL_MEDIA_STATE: MediaState = {
  progress: 0,
  visibility: 1,
  ready: { A: false, B: false },
  played: { A: false, B: false },
  active: null,
  autoplay: "unknown",
};

export type MediaEvent =
  | { type: "progress"; progress: number }
  | { type: "visibility"; ratio: number }
  | { type: "ready"; clip: HeroClipId }
  | { type: "ended"; clip: HeroClipId }
  | { type: "autoplayRefused" }
  | { type: "autoplayAllowed" }
  | { type: "userPause" }
  | { type: "userResume" };

export function mediaReducer(state: MediaState, event: MediaEvent): MediaState {
  return normalize(applyEvent(state, event));
}

function applyEvent(state: MediaState, event: MediaEvent): MediaState {
  switch (event.type) {
    case "progress":
      return { ...state, progress: event.progress };
    case "visibility":
      return { ...state, visibility: event.ratio };
    case "ready":
      return { ...state, ready: { ...state.ready, [event.clip]: true } };
    case "ended":
      return state.active?.clip === event.clip ? { ...state, active: null } : state;
    case "autoplayRefused":
      return { ...state, autoplay: "refused", active: null };
    case "autoplayAllowed":
      return state.autoplay === "refused" ? state : { ...state, autoplay: "allowed" };
    case "userPause":
      return state.active ? { ...state, active: { ...state.active, userPaused: true } } : state;
    case "userResume":
      return state.active ? { ...state, active: { ...state.active, userPaused: false } } : state;
  }
}

function normalize(state: MediaState): MediaState {
  const p = state.progress;
  let { active } = state;
  const played = { ...state.played };

  // Cancel an active clip that no longer belongs on screen.
  if (active) {
    const outOfChapter =
      active.clip === "A" ? p >= CHAPTER_B_START : p < CHAPTER_B_START || p >= CLIP_B_CANCEL_AT;
    if (outOfChapter || state.visibility < STOP_VISIBILITY) active = null;
  }

  // Chapters passed before their clip started are skipped for this page view.
  if (!active || active.clip !== "A") {
    if (!played.A && p >= CHAPTER_B_START) played.A = true;
  }
  if (!active || active.clip !== "B") {
    if (!played.B && p >= CLIP_B_START_BEFORE) played.B = true;
  }

  // Start at most one clip, never queued.
  if (!active && state.autoplay !== "refused" && state.visibility >= START_VISIBILITY) {
    if (!played.A && state.ready.A && p < CLIP_A_START_BEFORE) {
      active = { clip: "A", userPaused: false };
      played.A = true;
    } else if (!played.B && state.ready.B && p >= CHAPTER_B_START && p < CLIP_B_START_BEFORE) {
      active = { clip: "B", userPaused: false };
      played.B = true;
    }
  }

  return { ...state, active, played };
}

/** The still under (or instead of) the clips. */
export function mediaStill(state: MediaState): HeroStillId {
  if (state.progress < CHAPTER_B_START) return state.played.A ? "S2" : "S1";
  return state.played.B ? "S4" : "S2";
}
