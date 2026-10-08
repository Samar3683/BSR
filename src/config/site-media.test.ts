import { existsSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import type { SlotMedia } from "@/types/media";

import { siteMedia } from "./site-media";

type Slot = [name: string, media: SlotMedia];

const filled: Slot[] = Object.entries(siteMedia).flatMap(([section, group]) =>
  Object.entries(group as Record<string, SlotMedia | undefined>).flatMap(([slot, media]): Slot[] =>
    media ? [[`${section}.${slot}`, media]] : [],
  ),
);
const srcOf = (media: SlotMedia) => (media.kind === "image" ? media.src : media.poster);

describe("site media", () => {
  it("shows each photograph once on the page", () => {
    const seen = new Map<string, string>();
    for (const [slot, media] of filled) {
      const src = srcOf(media);
      expect(seen.get(src), `${slot} repeats ${seen.get(src)}`).toBeUndefined();
      seen.set(src, slot);
    }
  });

  it("uses only the background set", () => {
    for (const [slot, media] of filled) {
      expect(srcOf(media), slot).toContain("/content/backgrounds/");
    }
  });

  it("ships every picture it names", () => {
    for (const [slot, media] of filled) {
      expect(existsSync(join("public", srcOf(media))), slot).toBe(true);
    }
  });

  it("describes every photograph shown as content", () => {
    for (const [slot, media] of filled) {
      if (media.kind !== "image" || slot.endsWith(".background")) continue;
      expect(media.alt.length, slot).toBeGreaterThan(20);
    }
  });
});
