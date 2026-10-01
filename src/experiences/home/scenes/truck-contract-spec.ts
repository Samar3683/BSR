/*
 * The production model contract as plain data (hero technical specification,
 * section J). No imports: the runtime binding (truck-contract.ts) and the
 * offline asset validator (scripts/validate-hero-model.mjs) share it.
 *
 * Units: metres. Axes: +Y up, +Z forward, truck left side = +X.
 * Tractor origin: ground level under the rear drive axle.
 * Trailer origin (Trailer_Root): the kingpin.
 * Every rotating wheel node ends in "_Spin" (spin axis = local X).
 */

export const TRACTOR_REQUIRED_NODES = [
  "Tractor",
  "Tractor_Body",
  "Wheel_FL",
  "Wheel_FR",
  "Wheel_FL_Spin",
  "Wheel_FR_Spin",
  "Hitch_FifthWheel",
  "Lights_Head_L",
  "Lights_Head_R",
] as const;

export const TRAILER_REQUIRED_NODES = [
  "Trailer",
  "Trailer_Root",
  "Trailer_Body",
  "Livery_Wordmark",
  "Livery_Accent",
] as const;

export const SPIN_SUFFIX = "_Spin";

export const LIGHT_MATERIAL_NAMES = {
  head: "MAT_Light_Head",
  marker: "MAT_Light_Marker",
  tail: "MAT_Light_Tail",
  brake: "MAT_Light_Brake",
  /** Optional in assets; never driven — scroll reversal never shows reverse lights. */
  reverse: "MAT_Light_Reverse",
} as const;

export const LIVERY_MATERIAL_NAME = "MAT_Livery_Mark";

/**
 * Material slots: every truck material is named from this vocabulary, so the
 * runtime can tune each class separately (no universal glossy material).
 */
export const MATERIAL_SLOTS = {
  paintBody: "MAT_Paint_Body",
  paintGraphite: "MAT_Paint_Graphite",
  plasticGrille: "MAT_Plastic_Grille",
  rubber: "MAT_Rubber",
  metalDark: "MAT_Metal_Dark",
  metalSteel: "MAT_Metal_Steel",
  glass: "MAT_Glass",
  curtain: "MAT_Curtain",
  /** Box-trailer alternative to the curtain. */
  boxPanel: "MAT_Box_Panel",
  reflective: "MAT_Reflective",
  interior: "MAT_Interior",
  liveryMark: LIVERY_MATERIAL_NAME,
  liveryAccentRed: "MAT_Livery_Accent_Red",
  liveryAccentGreen: "MAT_Livery_Accent_Green",
  lightHead: LIGHT_MATERIAL_NAMES.head,
  lightMarker: LIGHT_MATERIAL_NAMES.marker,
  lightTail: LIGHT_MATERIAL_NAMES.tail,
  lightBrake: LIGHT_MATERIAL_NAMES.brake,
  lightReverse: LIGHT_MATERIAL_NAMES.reverse,
} as const;

export const KNOWN_MATERIAL_NAMES: ReadonlySet<string> = new Set(Object.values(MATERIAL_SLOTS));

/** Each entry is a set of alternatives: at least one must be present. */
export const TRACTOR_REQUIRED_MATERIALS: ReadonlyArray<readonly string[]> = [
  [MATERIAL_SLOTS.paintBody],
  [MATERIAL_SLOTS.glass],
  [MATERIAL_SLOTS.rubber],
  [MATERIAL_SLOTS.lightHead],
  [MATERIAL_SLOTS.lightMarker],
];

export const TRAILER_REQUIRED_MATERIALS: ReadonlyArray<readonly string[]> = [
  [MATERIAL_SLOTS.curtain, MATERIAL_SLOTS.boxPanel],
  [MATERIAL_SLOTS.rubber],
  [MATERIAL_SLOTS.reflective],
  [MATERIAL_SLOTS.lightTail],
  [MATERIAL_SLOTS.lightBrake],
  [MATERIAL_SLOTS.liveryMark],
];

/** Required-material groups not satisfied by `present` (reported by their names). */
export function missingMaterials(
  present: ReadonlySet<string>,
  required: ReadonlyArray<readonly string[]>,
): string[] {
  return required
    .filter((alternatives) => !alternatives.some((name) => present.has(name)))
    .map((alternatives) => alternatives.join(" | "));
}
