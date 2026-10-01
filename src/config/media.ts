import type { FocalPoint, SlotMedia } from "@/types/media";

import { type Livery, SCENES, type SceneId } from "./media-manifest";

/**
 * The livery shown across the site. The supplied package's final choice is the
 * simple white BSR livery with the green-white-red stripe ("final"); the
 * alternative sets ("custom-wrap", "black", "blue", "green", "red") are the
 * same scenes in other liveries — switch here to show one site-wide, review
 * them all at /dev/media. Only ever show the livery the real fleet carries.
 */
export const SITE_LIVERY: Livery = "final";

/**
 * A scene photograph from the supplied package, in the site livery (falling
 * back to "final" for scenes an alternative set does not include).
 */
export function scene(id: SceneId, alt: string, position?: FocalPoint): SlotMedia {
  const asset = SCENES[SITE_LIVERY][id] ?? SCENES.final[id];
  if (!asset) throw new Error(`Scene "${id}" is missing from the media manifest.`);
  return { kind: "image", alt, position, ...asset };
}
