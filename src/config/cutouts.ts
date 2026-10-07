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
 * from `pnpm assets:truck-cutouts` (scripts/render-truck-cutouts.mjs) —
 * re-render all layers together if the model changes, and copy the printed
 * placements here.
 *
 * Replace with photographic cut-outs of the real truck, same views, when they
 * exist (manifest C-01 … C-04).
 */
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

export const truckSide = {
  /** The whole truck with its wheels, one image (static uses, small sizes). */
  src: `${DIR}/truck-side.webp`,
  width: 3154,
  height: 768,
  alt: "Autoarticolato BSR, vista laterale: trattore bianco e semirimorchio telonato con il marchio BSR.",
  tractor: { src: `${DIR}/truck-side-tractor.webp`, x: 65.694, y: 3.776, w: 34.306, h: 88.542 },
  trailer: { src: `${DIR}/truck-side-trailer.webp`, x: 0, y: 0, w: 82.752, h: 97.005 },
  wheels: [
    {
      src: `${DIR}/truck-wheel-front.webp`,
      part: "tractor",
      x: 87.484,
      y: 72.991,
      w: 6.658,
      h: 27.344,
    },
    {
      src: `${DIR}/truck-wheel-drive.webp`,
      part: "tractor",
      x: 66.771,
      y: 73.409,
      w: 6.531,
      h: 26.823,
    },
    {
      src: `${DIR}/truck-wheel-trailer.webp`,
      part: "trailer",
      x: 30.727,
      y: 72.587,
      w: 6.785,
      h: 27.865,
    },
    {
      src: `${DIR}/truck-wheel-trailer.webp`,
      part: "trailer",
      x: 22.765,
      y: 72.587,
      w: 6.785,
      h: 27.865,
    },
    {
      src: `${DIR}/truck-wheel-trailer.webp`,
      part: "trailer",
      x: 14.802,
      y: 72.587,
      w: 6.785,
      h: 27.865,
    },
  ] as CutoutWheel[],
} as const;

export const truckFront34 = {
  src: `${DIR}/truck-front34.webp`,
  width: 1938,
  height: 830,
  alt: "Autoarticolato BSR visto di tre quarti dal davanti, con il marchio BSR sul semirimorchio.",
} as const;

export const truckTop = {
  src: `${DIR}/truck-top.webp`,
  width: 1748,
  height: 302,
  alt: "",
} as const;
