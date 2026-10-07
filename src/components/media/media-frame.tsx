import type { ReactNode } from "react";

import { cx } from "@/lib/utils/cx";
import type { SlotMedia } from "@/types/media";

import { MediaSlot } from "./media-slot";

export type RevealDirection = "left" | "right" | "bottom";

interface MediaFrameProps {
  /** Stable slot name, e.g. "service-espresso" (see MediaSlot). */
  name: string;
  media?: SlotMedia;
  /** `sizes` for the responsive image, matching the frame's rendered width. */
  sizes: string;
  /** Size and shape of the frame (aspect ratio or height per breakpoint). */
  className?: string;
  /** The edge the picture opens from as it enters (styles/motion.css). One per section. */
  reveal?: RevealDirection;
  /** Drift ±3% with the scroll (large screens only, never under reduced motion). */
  parallax?: boolean;
  /**
   * Scale 1 → 1.03 while an ancestor `group/media` is hovered or holds focus —
   * restrained: the picture answers, the text beside it stays still.
   */
  zoom?: boolean;
  /** Settle from 1.03 to rest as it enters. */
  settle?: boolean;
  /** Scroll-linked scale: `settle` eases in from 1.07 (the load), `push` pushes in slowly (the finale). */
  scrollScale?: "settle" | "push";
  caption?: ReactNode;
  /** Decorative background layers: no figure semantics. */
  decorative?: boolean;
}

/**
 * The site's one photograph component. Layers, each on its own element so no
 * two motions ever fight over a property: the frame (clipping, the reveal) →
 * parallax → hover zoom → the image (MediaSlot: focal point per breakpoint,
 * responsive srcset, lazy loading, blur placeholder). Replacing the picture —
 * or later a video (SlotMedia `kind: "video"`) — is a change in
 * src/config/site-media.ts, never here.
 */
export function MediaFrame({
  name,
  media,
  sizes,
  className,
  reveal,
  parallax = false,
  zoom = false,
  settle = false,
  scrollScale,
  caption,
  decorative = false,
}: MediaFrameProps) {
  const Frame = decorative ? "div" : "figure";
  return (
    <Frame
      data-reveal={reveal}
      aria-hidden={decorative || undefined}
      className={cx("relative overflow-clip bg-surface-secondary", className)}
    >
      {/* The picture fades in with the reveal (its layer only — never the caption). */}
      <div
        className={cx(
          "absolute inset-x-0",
          reveal && "pending:opacity-0",
          parallax ? "-inset-y-[4%] parallax" : "inset-y-0",
        )}
      >
        <div
          className={cx(
            "absolute inset-0",
            zoom &&
              "transition-[scale] duration-500 ease-enter motion-safe:group-focus-within/media:scale-[1.03] motion-safe:group-hover/media:scale-[1.03]",
            settle && "transition-[scale] duration-[900ms] ease-enter pending:scale-[1.03]",
            scrollScale === "settle" && "scroll-settle",
            scrollScale === "push" && "scroll-push",
          )}
        >
          <MediaSlot name={name} media={media} aspect="fill" sizes={sizes} />
        </div>
      </div>
      {caption && !decorative && (
        <figcaption className="absolute bottom-3 left-3 bg-background-primary/80 px-2 py-1 type-caption text-text-secondary">
          {caption}
        </figcaption>
      )}
    </Frame>
  );
}
