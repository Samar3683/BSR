/**
 * Cut-out renders of the BSR truck — the protagonist of the film below the
 * hero. Rendered from the hero's own production models
 * (public/assets/models/truck/bsr-tractor-high.glb + bsr-trailer-high.glb), so
 * the livery, proportions and wheels are exactly the truck of the opening
 * scene: transparent WebP, studio light from the front left.
 *
 * The side view is split into registered layers so the scroll can move them:
 * the tractor and the trailer (each without its wheels) and the wheels, each
 * placed in percentages of the whole truck's box. Images and positions come
 * from `pnpm assets:truck-cutouts` (scripts/render-truck-cutouts.mjs), which
 * also writes the placements module read here (./cutouts-placements.ts) — the
 * images and their registration always come from the same render.
 *
 * Replace with photographic cut-outs of the real truck, same views, when they
 * exist (manifest C-01 … C-04).
 */
import { CUTOUT_PLACEMENTS } from "./cutouts-placements";

const DIR = "/assets/images/content/cutouts";

export interface CutoutBox {
  /** Left, top, width, height — percentages of the truck's box. */
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface CutoutWheel extends CutoutBox {
  src: string;
  part: "tractor" | "trailer";
}

const { files, side, front34, top } = CUTOUT_PLACEMENTS;

export const truckSide = {
  /** The whole truck with its wheels, one image (static uses, small sizes). */
  src: `${DIR}/${files["truck-side.webp"]}`,
  width: side.width,
  height: side.height,
  alt: "Autoarticolato BSR, vista laterale: trattore bianco e semirimorchio telonato con il marchio BSR.",
  tractor: { src: `${DIR}/${files["truck-side-tractor.webp"]}`, ...side.tractor },
  trailer: { src: `${DIR}/${files["truck-side-trailer.webp"]}`, ...side.trailer },
  wheels: side.wheels.map((wheel) => ({ ...wheel, src: `${DIR}/${wheel.src}` })) as CutoutWheel[],
} as const;

export const truckFront34 = {
  src: `${DIR}/${files["truck-front34.webp"]}`,
  width: front34.width,
  height: front34.height,
  alt: "Autoarticolato BSR visto di tre quarti dal davanti, con il marchio BSR sul semirimorchio.",
} as const;

export const truckTop = {
  src: `${DIR}/${files["truck-top.webp"]}`,
  width: top.width,
  height: top.height,
  alt: "",
} as const;
