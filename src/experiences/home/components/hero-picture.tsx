import { getImageProps } from "next/image";
import type { CSSProperties } from "react";

import { cx } from "@/lib/utils/cx";

import { COMPACT_MEDIA_QUERY, type HeroStill } from "../config/hero-assets";

interface HeroPictureProps {
  still: HeroStill;
  /** The poster: eager, high fetch priority (the LCP candidate). */
  priority?: boolean;
  className?: string;
  style?: CSSProperties;
  onLoad?: () => void;
}

/**
 * Art-directed hero still: portrait crop on compact layouts, landscape crop
 * otherwise, each positioned so the truck stays in its safe zone under
 * cover-cropping. Decorative (empty alt): meaning lives in the hero HTML.
 * Works in Server and Client Components.
 */
export function HeroPicture({
  still,
  priority = false,
  className,
  style,
  onLoad,
}: HeroPictureProps) {
  const common = { alt: "", sizes: "100vw" };
  const {
    props: { srcSet: compactSrcSet },
  } = getImageProps({
    ...common,
    src: still.compact.src,
    width: still.compact.width,
    height: still.compact.height,
  });
  const { props: wide } = getImageProps({
    ...common,
    src: still.wide.src,
    width: still.wide.width,
    height: still.wide.height,
    fetchPriority: priority ? "high" : undefined,
    loading: priority ? "eager" : "lazy",
  });

  return (
    <picture>
      <source media={COMPACT_MEDIA_QUERY} srcSet={compactSrcSet} />
      {/* getImageProps + <img> is Next's documented art-direction pattern. */}
      <img
        {...wide}
        alt=""
        decoding="async"
        onLoad={onLoad}
        data-still={still.id}
        className={cx(
          "absolute inset-0 h-full w-full object-cover object-(--still-position) max-md:object-(--still-position-compact)",
          className,
        )}
        style={
          {
            "--still-position": still.wide.objectPosition,
            "--still-position-compact": still.compact.objectPosition,
            ...style,
          } as CSSProperties
        }
      />
    </picture>
  );
}
