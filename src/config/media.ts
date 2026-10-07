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
  return sceneIn(SITE_LIVERY, id, alt, position);
}

/**
 * A scene in a named livery — for a deliberate, documented exception to the
 * site livery (none is in use at present). Falls back to
 * "final" for scenes the set does not include.
 */
export function sceneIn(
  livery: Livery,
  id: SceneId,
  alt: string,
  position?: FocalPoint,
): SlotMedia {
  const asset = SCENES[livery][id] ?? SCENES.final[id];
  if (!asset) throw new Error(`Scene "${id}" is missing from the media manifest.`);
  return { kind: "image", alt, position, ...asset };
}
