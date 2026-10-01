import type { WebGLRendererParameters } from "three";

import type { QualityProfile } from "@/lib/performance/quality";

/**
 * WebGL renderer parameters derived from a quality profile.
 *
 * Defaults: `alpha` keeps the canvas transparent so it composes with the HTML
 * layer beneath it; the stencil buffer is off until a scene needs it.
 * Full-bleed scenes (e.g. the hero) pass `{ alpha: false }` — cheaper, and no
 * premultiplied-alpha edges.
 */
export function createRendererParameters(
  profile: QualityProfile,
  overrides: Partial<WebGLRendererParameters> = {},
): WebGLRendererParameters {
  return {
    alpha: true,
    antialias: profile.antialias,
    powerPreference: profile.powerPreference,
    stencil: false,
    ...overrides,
  };
}
