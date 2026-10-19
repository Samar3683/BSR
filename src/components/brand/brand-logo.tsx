import Image from "next/image";

import { cx } from "@/lib/utils/cx";

export const LOGO_SRC = "/assets/images/content/logos/bsr-logo.webp";

interface BrandLogoProps {
  /** On a dark surface the dark logo sits on a light plate. */
  plate?: boolean;
  /** Load at once (header, above the fold). */
  priority?: boolean;
  className?: string;
  /** Height class of the image. */
  heightClass?: string;
}

/** The supplied BSR Trasporti logo. Decorative: the link around it carries the name. */
export function BrandLogo({
  plate = false,
  priority = false,
  className,
  heightClass = "h-11",
}: BrandLogoProps) {
  return (
    <span
      className={cx(
        "inline-flex rounded-sm transition-colors duration-200",
        plate && "bg-white/90 px-2 py-1",
        className,
      )}
    >
      <Image
        src={LOGO_SRC}
        alt=""
        width={397}
        height={160}
        priority={priority}
        className={cx(heightClass, "w-auto")}
      />
    </span>
  );
}
