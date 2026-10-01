/**
 * Where the subject sits in the picture (CSS object-position), per breakpoint:
 * the crop follows the layout, so a truck's cab or a person's face stays in
 * frame from a portrait phone to a wide desktop. A string is one position for
 * every width; `md` and `lg` default to the step below.
 */
export type FocalPoint = string | { base: string; md?: string; lg?: string };

/**
 * Media for a slot (see components/media/media-slot), declared in the site's
 * media configuration (src/config/site-media.ts) — replacing a picture, or
 * later a picture with a video, is a content edit, never a layout change.
 */
export type SlotMedia =
  | {
      kind: "image";
      src: string;
      /** Meaningful description, or "" when the image is purely decorative. */
      alt: string;
      width: number;
      height: number;
      blurDataURL?: string;
      /** Keeps the subject in frame when the slot crops. */
      position?: FocalPoint;
    }
  /**
   * Decorative loop (no audio, no information): autoplay, muted, loop,
   * playsInline. The poster is what reduced motion shows. Not used yet.
   */
  | { kind: "video"; src: string; poster: string; position?: FocalPoint };
