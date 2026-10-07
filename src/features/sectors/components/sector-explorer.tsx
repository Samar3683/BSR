"use client";

import { ArrowRight, Plus } from "lucide-react";
import Link from "next/link";
import { type CSSProperties, useState } from "react";

import { MediaSlot } from "@/components/media/media-slot";
import { cx } from "@/lib/utils/cx";
import type { SlotMedia } from "@/types/media";

import type { Sector } from "../config/sectors-content";

/**
 * Where the stage's camera sits for each sector while the sectors share one
 * photograph: a different crop window of the same scene (scale, then a shift),
 * so the stage still answers the row. A sector with its own picture
 * (`siteMedia.sectors[id]`) shows that picture instead.
 */
const CROPS = [
  { scale: 1, x: "0%", y: "0%" },
  { scale: 1.14, x: "-5%", y: "3%" },
  { scale: 1.12, x: "5%", y: "-3%" },
  { scale: 1.1, x: "-2%", y: "-4%" },
] as const;

/**
 * The sectors as a large list beside one photographic stage.
 *
 * - From `lg`: each row is a link (index, sector, one line, arrow) to the
 *   request with its sector noted. Hovering or focusing a row puts it in play:
 *   a green line draws along its top, its index turns green, its title moves
 *   a few pixels, the arrow moves on — and the stage reframes (or changes
 *   picture) with the sector named in its caption. Nothing changes height.
 * - Below `lg`: the stage above a compact accordion (native <details>, one
 *   open at a time); each answer holds the line and the link.
 * React state changes only when the row in play changes.
 */
export function SectorExplorer({
  sectors,
  stage,
  link,
}: {
  sectors: readonly Sector[];
  stage?: SlotMedia;
  link: { label: string; for: string };
}) {
  const [active, setActive] = useState(0);
  const current = sectors[active]!;
  const crop = CROPS[active % CROPS.length]!;

  return (
    <div className="ed-grid gap-y-6">
      <div
        aria-hidden="true"
        data-reveal="right"
        className="relative col-span-4 aspect-[16/10] md:col-span-8 lg:col-span-7 lg:col-start-10 lg:row-start-1 lg:ed-bleed-r lg:aspect-auto lg:h-[min(30rem,58svh)]"
      >
        <div className="absolute inset-0 overflow-clip bg-surface-secondary">
          <div
            className="absolute inset-0 transition-transform duration-[900ms] ease-cinematic motion-reduce:transition-none"
            style={
              {
                transform: `translate(${crop.x}, ${crop.y}) scale(${crop.scale})`,
              } as CSSProperties
            }
          >
            <MediaSlot name="sectors-stage" media={stage} aspect="fill" sizes="(min-width: 64rem) 45vw, 100vw" />
          </div>
          {sectors.map((sector, i) =>
            sector.media ? (
              <MediaSlot
                key={sector.id}
                name={`sector-${sector.id}`}
                media={sector.media}
                aspect="fill"
                sizes="(min-width: 64rem) 45vw, 100vw"
                className={cx(
                  "transition-opacity duration-500 ease-enter motion-reduce:transition-none",
                  i === active ? "opacity-100" : "opacity-0",
                )}
              />
            ) : null,
          )}
          <p
            data-surface="white"
            className="absolute bottom-0 left-0 flex items-center gap-3 bg-background-primary px-4 py-3 ed-meta text-text-secondary"
          >
            <span className="text-success tabular-nums">{current.code}</span>
            <span key={current.id} className="panel-in">
              {current.title}
            </span>
          </p>
        </div>
      </div>

      <ol className="hidden border-b border-hairline lg:col-span-8 lg:row-start-1 lg:flex lg:flex-col lg:self-center">
        {sectors.map((sector, i) => {
          const on = i === active;
          return (
            <li key={sector.id} className="relative border-t border-hairline">
              <span
                aria-hidden="true"
                className={cx(
                  "absolute inset-x-0 -top-px h-px origin-left bg-success-graphic transition-[scale] duration-500 ease-enter motion-reduce:transition-none",
                  on ? "scale-x-100" : "scale-x-0",
                )}
              />
              <Link
                href={sector.href}
                onMouseEnter={() => setActive(i)}
                onFocus={() => setActive(i)}
                className="group/row flex items-center gap-6 py-4 outline-offset-[-2px] xl:gap-10"
              >
                <span
                  aria-hidden="true"
                  className={cx(
                    "w-6 ed-label tabular-nums transition-colors duration-300",
                    on ? "text-success" : "text-text-secondary",
                  )}
                >
                  {sector.code}
                </span>
                <span
                  className={cx(
                    "flex flex-1 flex-col gap-1 transition-[translate] duration-[400ms] ease-enter motion-reduce:transition-none",
                    on && "translate-x-2",
                  )}
                >
                  <h3 className="ed-h3 whitespace-nowrap">{sector.title}</h3>
                  <span className="max-w-[40ch] ed-small text-text-secondary">{sector.body}</span>
                </span>
                <ArrowRight
                  aria-hidden="true"
                  strokeWidth={1.75}
                  className={cx(
                    "size-5 shrink-0 transition-[translate,color] duration-300 ease-enter motion-reduce:transition-none",
                    on ? "translate-x-1 text-success" : "text-text-secondary",
                  )}
                />
                <span className="sr-only">
                  — {link.label} {link.for} {sector.title}
                </span>
              </Link>
            </li>
          );
        })}
      </ol>

      <div className="col-span-4 border-t border-hairline md:col-span-8 lg:hidden">
        {sectors.map((sector, i) => (
          <details
            key={sector.id}
            name="settori"
            open={i === 0}
            onToggle={(event) => {
              if (event.currentTarget.open) setActive(i);
            }}
            className="group disclosure border-b border-hairline"
          >
            <summary className="flex min-h-14 cursor-pointer list-none items-center gap-4 py-3 [&::-webkit-details-marker]:hidden">
              <span aria-hidden="true" className="w-6 ed-label text-text-secondary tabular-nums group-open:text-success">
                {sector.code}
              </span>
              <h3 className="flex-1 ed-h4">{sector.title}</h3>
              <Plus
                aria-hidden="true"
                strokeWidth={1.75}
                className="size-5 text-success-graphic transition-transform duration-300 group-open:rotate-45 motion-reduce:transition-none"
              />
            </summary>
            <div className="flex flex-col gap-2 pb-5 pl-10">
              <p className="ed-body text-text-secondary">{sector.body}</p>
              <Link
                href={sector.href}
                className="inline-flex min-h-(--target-min) items-center gap-2 self-start ed-action text-text-primary"
              >
                <span>
                  {link.label}
                  <span className="sr-only">
                    {" "}
                    {link.for} {sector.title}
                  </span>
                </span>
                <ArrowRight aria-hidden="true" className="size-4 text-success" strokeWidth={1.75} />
              </Link>
            </div>
          </details>
        ))}
      </div>
    </div>
  );
}
