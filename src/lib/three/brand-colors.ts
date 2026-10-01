/**
 * Scene colours mirrored from the CSS design tokens (the source of truth), so
 * WebGL and the DOM never drift apart. Only colours the scene needs are
 * mirrored; parity is enforced by src/styles/tokens.test.ts.
 */
export const SCENE_COLORS = {
  carbon: "#090b0b",
  graphite: "#121615",
  softWhite: "#f7f7f2",
  /** Tail/brake lights — the only red light source in the scene. */
  red500: "#b32025",
  /** Route line on dark surfaces (success-graphic). */
  green500: "#1a9a63",
  green600: "#128453",
} as const;

/** Token name for each mirrored colour (used by the parity test). */
export const SCENE_COLOR_TOKENS: Record<keyof typeof SCENE_COLORS, string> = {
  carbon: "color-carbon",
  graphite: "color-graphite",
  softWhite: "color-soft-white",
  red500: "color-red-500",
  green500: "color-green-500",
  green600: "color-green-600",
};
