import Image from "next/image";
import type { CSSProperties, ReactNode } from "react";

import { cx } from "@/lib/utils/cx";
import type { FocalPoint, SlotMedia } from "@/types/media";

export type { SlotMedia } from "@/types/media";

export type SlotAspect = "16/9" | "3/2" | "4/3" | "4/5" | "1/1" | "fill";

const ASPECT: Record<SlotAspect, string> = {
  "16/9": "aspect-video",
  "3/2": "aspect-[3/2]",
  "4/3": "aspect-[4/3]",
  "4/5": "aspect-[4/5]",
  "1/1": "aspect-square",
  // Fills a positioned parent: background layers behind a composition.
  fill: "absolute inset-0",
};

interface MediaSlotProps {
  /** Stable name, e.g. "service-espresso" — the hook a later media pass looks for. */
  name: string;
  media?: SlotMedia;
  aspect: SlotAspect;
  /** `sizes` for the responsive image, matching the slot's rendered width. */
  sizes?: string;
  /**
   * Designed artwork that holds the slot until media exists (e.g. a technical
   * schematic). Without it an empty slot collapses to nothing.
   */
  fallback?: ReactNode;
  className?: string;
}

/** object-position per breakpoint, from the focal point's CSS variables. */
const FOCAL =
  "object-cover object-[var(--focal,center)] md:object-[var(--focal-md,var(--focal,center))] lg:object-[var(--focal-lg,var(--focal-md,var(--focal,center)))]";

function focalStyle(position?: FocalPoint): CSSProperties | undefined {
  if (!position) return undefined;
  const { base, md, lg } = typeof position === "string" ? { base: position } : position;
  return {
    "--focal": base,
    ...(md && { "--focal-md": md }),
    ...(lg && { "--focal-lg": lg }),
  } as CSSProperties;
}

/**
 * A reserved position for photography or video. Empty, it renders an empty
 * element that `:empty` hides, so the composition around it stands on its own
 * and nothing shifts — or, given a `fallback`, it shows that designed artwork
 * at the slot's proportion. Populated (through content config, not by editing
 * the section), it fills its fixed proportion: the layout never depends on the
 * media, and images load lazily behind a blurred placeholder at the final size.
 */
export function MediaSlot({
  name,
  media,
  aspect,
  sizes = "100vw",
  fallback,
  className,
}: MediaSlotProps) {
  const objectPosition = focalStyle(media?.position);
  return (
    <div
      data-slot={name}
      className={cx(
        "overflow-clip empty:hidden",
        // A fill slot is positioned by its parent; the others size themselves.
        aspect !== "fill" && "relative",
        ASPECT[aspect],
        className,
      )}
    >
      {!media && fallback}
      {media?.kind === "image" && (
        <Image
          src={media.src}
          alt={media.alt}
          fill
          sizes={sizes}
          placeholder={media.blurDataURL ? "blur" : "empty"}
          blurDataURL={media.blurDataURL}
          className={FOCAL}
          style={objectPosition}
        />
      )}
      {media?.kind === "video" && (
        <>
          <Image
            src={media.poster}
            alt=""
            fill
            sizes={sizes}
            className={FOCAL}
            style={objectPosition}
          />
          <video
            aria-hidden="true"
            src={media.src}
            poster={media.poster}
            autoPlay
            muted
            loop
            playsInline
            preload="none"
            className={`absolute inset-0 h-full w-full motion-reduce:hidden ${FOCAL}`}
            style={objectPosition}
          />
        </>
      )}
    </div>
  );
}
