import Image from "next/image";
import type { CSSProperties } from "react";

import { type CutoutBox, truckFront34, truckSide, truckTop } from "@/config/cutouts";
import { cx } from "@/lib/utils/cx";

const place = (box: CutoutBox): CSSProperties => ({
  left: `${box.x}%`,
  top: `${box.y}%`,
  width: `${box.w}%`,
  height: `${box.h}%`,
});

interface TruckProps {
  className?: string;
  /** `sizes` for the images: the truck's rendered width. */
  sizes: string;
  /** Named for assistive technology; decorative by default. */
  label?: string;
  style?: CSSProperties;
}

/**
 * The BSR truck from the side, facing right — the film's protagonist, in
 * registered layers (config/cutouts.ts): the trailer and the tractor move as
 * groups (`--trailer-x`, `--tractor-x`: the coupling), and the wheels turn
 * with the scene (`--turns` per scene, styles/cinematic.css `wheel-spin`).
 * A soft contact shadow sits under the wheels. Size it by width; the box
 * keeps the render's proportion.
 */
export function TruckSide({ className, sizes, label, style }: TruckProps) {
  const group = (part: "tractor" | "trailer") => (
    <div
      className="absolute inset-0"
      style={{ translate: `var(--${part}-x, 0) 0` } as CSSProperties}
    >
      <div className="absolute" style={place(truckSide[part])}>
        <Image src={truckSide[part].src} alt="" fill sizes={sizes} className="object-contain" />
      </div>
      {truckSide.wheels
        .filter((wheel) => wheel.part === part)
        .map((wheel) => (
          <div key={wheel.x} className="absolute wheel-spin" style={place(wheel)}>
            <Image src={wheel.src} alt="" fill sizes="10vw" className="object-contain" />
          </div>
        ))}
    </div>
  );
  return (
    <div
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={cx("relative aspect-[3154/768]", className)}
      style={style}
    >
      <span className="absolute inset-x-[2%] -bottom-[3%] h-[9%] rounded-[50%] bg-carbon/25 blur-md" />
      {group("trailer")}
      {group("tractor")}
    </div>
  );
}

/** The BSR truck in three-quarter view from the front, facing right. */
export function TruckFront34({ className, sizes, label, style }: TruckProps) {
  return (
    <div
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={cx("relative aspect-[1938/830]", className)}
      style={style}
    >
      <Image src={truckFront34.src} alt="" fill sizes={sizes} className="object-contain" />
    </div>
  );
}

/** The BSR truck seen from above, facing right (map and road scenes). */
export function TruckTop({ className, sizes, style }: Omit<TruckProps, "label">) {
  return (
    <div aria-hidden="true" className={cx("relative aspect-[1748/302]", className)} style={style}>
      <Image src={truckTop.src} alt="" fill sizes={sizes} className="object-contain" />
    </div>
  );
}
