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
      /**
       * Moving media laid over the picture once it exists (the picture stays
       * underneath: poster, fallback if the motion fails, reduced motion).
       */
      motion?: SceneMotion;
    }
  /**
   * Decorative loop (no audio, no information): autoplay, muted, loop,
   * playsInline. The poster is what reduced motion shows. Not used yet.
   */
  | { kind: "video"; src: string; poster: string; position?: FocalPoint };

/**
 * Moving media for a scene (components/media: VideoScene, MediaSequence) —
 * declared on a picture's slot, never instead of it:
 *
 * - `video`: a muted loop, played only while on screen (paused off screen),
 *   never under reduced motion; `mobileSrc` for a lighter 9:16 or 4:5 cut.
 * - `sequence`: numbered frames drawn on a canvas, the frame chosen by the
 *   scene's scroll progress (or played once as a loop when `scrub` is
 *   false). `pattern` holds the frame number's place as `{0000}` (padding
 *   by the braces' width), e.g. "/assets/video/sequences/departure/{0000}.webp";
 *   `mobilePattern` / `mobileFrames` for a lighter set on phones.
 *
 * Every frame or clip covers the slot like the picture (same focal point).
 */
export type SceneMotion =
  | { kind: "video"; src: string; mobileSrc?: string; type?: string }
  | {
      kind: "sequence";
      pattern: string;
      frames: number;
      mobilePattern?: string;
      mobileFrames?: number;
      /** Scroll-scrubbed (default) or a timed loop. */
      scrub?: boolean;
    };
