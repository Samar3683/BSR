import type { FocalPoint, SlotMedia } from "@/types/media";

/**
 * The cinematic background set (assets/source/BSR-Website-Backgrounds: 22
 * generated photographs, 1672 × 941, one white BSR truck in the same dawn
 * light), converted to WebP under /assets/images/content/backgrounds/. They
 * are illustrative renders, not photographs of BSR's fleet or people: alt
 * text says what is shown, never who. Replace a slot's picture with real
 * photography in site-media.ts — same key, no layout change.
 */
const DIR = "/assets/images/content/backgrounds";

const SIZES = {
  "fleet-van": [1600, 1000],
  "fleet-rigid": [1600, 1000],
  "fleet-articulated": [1600, 1000],
  "predeparture-inspection": [1672, 940],
} as const satisfies Record<string, readonly [number, number]>;

export function background(
  name: string,
  alt: string,
  position?: FocalPoint,
): Extract<SlotMedia, { kind: "image" }> {
  const [width, height] = (SIZES as Record<string, readonly [number, number]>)[name] ?? [1672, 941];
  return { kind: "image", src: `${DIR}/${name}.webp`, alt, width, height, position };
}
