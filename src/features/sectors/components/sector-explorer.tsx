"use client";

import { ArrowRight, Plus } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { MediaSlot } from "@/components/media/media-slot";
import { cx } from "@/lib/utils/cx";
import type { SlotMedia } from "@/types/media";

import type { Sector } from "../config/sectors-content";

/**
 * The sectors as horizontal rows beside one preview stage.
 *
 * - From `lg`: each row is a link (number, sector, line, arrow) to the
 *   request with its sector noted. Hovering or focusing a row expands it in
 *   place — a white panel slides in behind it, a green line draws along its
 *   top, the arrow moves on — and brings its picture onto the stage (its own
 *   if it has one, else the shared one) with its name as the caption. Nothing
 *   changes height: the layout never jumps.
 * - Below `lg`: the stage sits above a compact accordion (native <details>,
 *   one open at a time); each answer holds the line and the link. No
 *   hover-only content anywhere.
 * React state changes only when the previewed row changes.
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

  return (
    <div className="grid gap-6 lg:grid-cols-12 lg:gap-x-(--spacing-grid-gap) lg:gap-y-0">
      <div
        aria-hidden="true"
        data-reveal="right"
        className="relative aspect-[16/9] overflow-clip bg-surface-secondary lg:col-span-5 lg:col-start-8 lg:row-start-1 lg:aspect-auto"
      >
        {/* One layer for the entry wipe; the previews change inside it. */}
        <div className="absolute inset-0">
          <MediaSlot
            name="sectors-stage"
            media={stage}
            aspect="fill"
            sizes="(min-width: 64rem) 40vw, 100vw"
            className={cx(
              "transition-[scale] duration-700 ease-enter motion-reduce:transition-none",
              active % 2 === 1 ? "scale-[1.03]" : "scale-100",
            )}
          />
          {sectors.map((sector, i) =>
            sector.media ? (
              <MediaSlot
                key={sector.id}
                name={`sector-${sector.id}`}
                media={sector.media}
                aspect="fill"
                sizes="(min-width: 64rem) 40vw, 100vw"
                className={cx(
                  "transition-[opacity,clip-path] duration-500 ease-enter motion-reduce:transition-none",
                  i === active
                    ? "opacity-100 [clip-path:inset(0)]"
                    : "opacity-0 [clip-path:inset(0_0_0_100%)]",
                )}
              />
            ) : null,
          )}
          <p className="absolute bottom-0 left-0 hidden items-center gap-3 bg-background-primary px-4 py-3 type-label-sm lg:flex">
            <span className="h-0.5 w-6 bg-success-graphic" />
            <span key={current.id} className="flex panel-in gap-2">
              <span className="text-success tabular-nums">{current.code}</span>
              {current.title}
            </span>
          </p>
        </div>
      </div>

      <ol className="hidden border-t border-border-default lg:col-span-7 lg:row-start-1 lg:flex lg:flex-col">
        {sectors.map((sector, i) => {
          const on = i === active;
          return (
            <li key={sector.id} className="border-b border-border-default">
              <Link
                href={sector.href}
                onMouseEnter={() => setActive(i)}
                onFocus={() => setActive(i)}
                data-active={on || undefined}
                className="group/row relative flex items-center gap-8 px-5 py-5 outline-offset-[-2px] xl:py-6"
              >
                <span
                  aria-hidden="true"
                  className="absolute inset-0 origin-left scale-x-0 bg-surface-secondary transition-[scale] duration-[400ms] ease-enter group-data-active/row:scale-x-100 motion-reduce:transition-none"
                />
                <span
                  aria-hidden="true"
                  className="absolute inset-x-0 -top-px h-0.5 origin-left scale-x-0 bg-success-graphic transition-[scale] duration-500 ease-enter group-data-active/row:scale-x-100 motion-reduce:transition-none"
                />
                <span
                  aria-hidden="true"
                  className="relative type-metadata text-text-muted tabular-nums transition-colors duration-300 group-data-active/row:text-success"
                >
                  {sector.code}
                </span>
                {/* Name and line side by side from `xl`; stacked below it, so a name never breaks. */}
                <span className="relative flex flex-1 flex-col gap-1 transition-[translate] duration-[400ms] ease-enter group-data-active/row:translate-x-2 motion-reduce:transition-none xl:flex-row xl:items-baseline xl:justify-between xl:gap-6">
                  <h3 className="type-heading-lg whitespace-nowrap">{sector.title}</h3>
                  <span className="type-body-md text-text-secondary xl:max-w-[26ch] xl:text-right">
                    {sector.body}
                  </span>
                </span>
                <ArrowRight
                  aria-hidden="true"
                  strokeWidth={1.75}
                  className="relative size-5 text-text-muted transition-[translate,color] duration-300 ease-enter group-data-active/row:translate-x-1 group-data-active/row:text-success motion-reduce:transition-none"
                />
                <span className="sr-only">
                  — {link.label} {link.for} {sector.title}
                </span>
              </Link>
            </li>
          );
        })}
      </ol>

      <div className="border-t border-border-default lg:hidden">
        {sectors.map((sector, i) => (
          <details
            key={sector.id}
            name="settori"
            open={i === 0}
            className="group disclosure border-b border-border-default"
          >
            <summary className="flex min-h-14 cursor-pointer list-none items-center gap-4 py-3 [&::-webkit-details-marker]:hidden">
              <span
                aria-hidden="true"
                className="type-metadata text-text-muted tabular-nums group-open:text-success"
              >
                {sector.code}
              </span>
              <h3 className="flex-1 type-heading-md">{sector.title}</h3>
              <Plus
                aria-hidden="true"
                strokeWidth={2}
                className="size-5 text-success-graphic transition-transform duration-300 group-open:rotate-45 motion-reduce:transition-none"
              />
            </summary>
            <div className="flex flex-col gap-3 pb-5 pl-9">
              <p className="type-body-md text-text-secondary">{sector.body}</p>
              <Link
                href={sector.href}
                className="inline-flex min-h-(--target-min) items-center gap-2 self-start type-label-md text-text-primary"
              >
                <span>
                  {link.label}
                  <span className="sr-only">
                    {" "}
                    {link.for} {sector.title}
                  </span>
                </span>
                <ArrowRight aria-hidden="true" className="size-4 text-success" strokeWidth={2} />
              </Link>
            </div>
          </details>
        ))}
      </div>
    </div>
  );
}
