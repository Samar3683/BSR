/**
 * Hero story structure, as normalized progress (0–1) over the hero's story
 * scroll distance. Values come from the approved hero technical specification
 * (and its amendments); change them only with a matching spec change.
 */

export const HERO_STATES = [
  { name: "clarity", start: 0, end: 0.12 },
  { name: "detail", start: 0.12, end: 0.27 },
  { name: "reveal", start: 0.27, end: 0.42 },
  { name: "departure", start: 0.42, end: 0.6 },
  { name: "road", start: 0.6, end: 0.82 },
  { name: "route", start: 0.82, end: 1 },
] as const;

export type HeroStateName = (typeof HERO_STATES)[number]["name"];

export function heroStateAt(progress: number): HeroStateName {
  const p = clamp01(progress);
  for (const state of HERO_STATES) {
    if (p < state.end) return state.name;
  }
  return "route";
}

export function heroStateStart(name: HeroStateName): number {
  return HERO_STATES.find((state) => state.name === name)!.start;
}

/** Key progress positions inside the story. */
export const HERO_MARKS = {
  /** The full-truck composition holds still between these. */
  holdStart: 0.36,
  holdEnd: 0.42,
  /** The truck starts rolling; before this, dock distance D is always 0. */
  rollStart: 0.5,
  /** Trailer-wipe window. */
  wipeStart: 0.57,
  wipeEnd: 0.63,
  /** Dock → road switch (forward) and road → dock switch (reverse). */
  wipeSwitchForward: 0.6,
  wipeSwitchBack: 0.595,
  /** Return mode always ends here (return path and forward path coincide). */
  returnExit: 0.44,
} as const;

/**
 * Deterministic checkpoints, shared by the still captures, the styleframe
 * review workflow and visual tests.
 */
export const HERO_CHECKPOINTS = {
  opening: 0.04,
  hold: 0.39,
  /** Open road (Styleframe 03): the journey's third chapter. */
  road: 0.77,
  route: 0.97,
} as const;

export type HeroCheckpoint = keyof typeof HERO_CHECKPOINTS;

export function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}
