/**
 * Developer-only surfaces (e.g. /dev/design-system). Always available in
 * development; in production builds only when BSR_DESIGN_PREVIEW=true (used
 * by the browser test suite). Never linked from public navigation.
 */
export function isDesignPreviewEnabled(env: {
  NODE_ENV?: string;
  BSR_DESIGN_PREVIEW?: string;
}): boolean {
  return env.NODE_ENV !== "production" || env.BSR_DESIGN_PREVIEW === "true";
}
