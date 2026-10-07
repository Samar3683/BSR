import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import type { SurfaceTone } from "@/components/layout/surface";

/**
 * Resolves every semantic colour role for each surface directly from the
 * CSS source and checks WCAG 2.x contrast minimums:
 *   4.5:1 for text, 3:1 for UI graphics (borders, focus, status graphics).
 * Translucent values (subtle borders, overlays) are decorative and skipped.
 */
const tokensCss = readFileSync(new URL("./tokens.css", import.meta.url), "utf8");
const themesCss = readFileSync(new URL("./themes.css", import.meta.url), "utf8");

type Declarations = Map<string, string>;

function parseDeclarations(body: string): Declarations {
  const declarations: Declarations = new Map();
  for (const match of body.matchAll(/(--[\w-]+):\s*([^;]+);/g)) {
    declarations.set(match[1]!, match[2]!.trim());
  }
  return declarations;
}

function parseBlocks(css: string) {
  const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, "");
  return [...withoutComments.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((match) => ({
    selectors: match[1]!.split(",").map((selector) => selector.trim()),
    declarations: parseDeclarations(match[2]!),
  }));
}

const primitives = parseDeclarations(tokensCss);
const themeBlocks = parseBlocks(themesCss).filter(
  (block) => !block.selectors.some((selector) => selector.startsWith("@theme")),
);

function resolveSurface(tone: SurfaceTone): Declarations {
  const resolved: Declarations = new Map();
  for (const block of themeBlocks) {
    if (block.selectors.includes(`[data-surface="${tone}"]`)) {
      for (const [name, value] of block.declarations) resolved.set(name, value);
    }
  }
  return resolved;
}

function resolveHex(value: string, scope: Declarations): string | null {
  const reference = value.match(/^var\((--[\w-]+)\)$/);
  if (reference) {
    const name = reference[1]!;
    const next = scope.get(name) ?? primitives.get(name);
    return next ? resolveHex(next, scope) : null;
  }
  return /^#[0-9a-f]{6}$/i.test(value) ? value : null;
}

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((index) => {
    const channel = parseInt(hex.slice(index, index + 2), 16) / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

function contrast(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light! + 0.05) / (dark! + 0.05);
}

const SURFACES: SurfaceTone[] = [
  "carbon",
  "graphite",
  "asphalt",
  "white",
  "soft-white",
  "warm-white",
  "green",
];

const BACKGROUNDS = [
  "background-primary",
  "surface-secondary",
  "surface-elevated",
  "surface-field",
];
const TEXT_ROLES = ["text-primary", "text-secondary", "text-muted", "danger", "success"];
const GRAPHIC_ROLES = ["border-strong", "focus", "danger-graphic", "success-graphic"];
/** Display-size text only (≥ 24px, or 19px bold): the inked title's waiting line. */
const LARGE_TEXT_ROLES = ["ink-muted"];

/** [foreground, background, minimum] pairs that don't depend on the backdrop. */
const FILL_PAIRS: Array<[string, string, number]> = [
  ["on-action-primary", "action-primary", 4.5],
  ["on-action-primary", "action-primary-hover", 4.5],
  ["on-action-primary", "action-primary-active", 4.5],
  ["on-success-strong", "success-strong", 4.5],
  ["on-danger-strong", "danger-strong", 4.5],
  ["text-inverse", "background-inverse", 4.5],
  ["text-inverse", "background-inverse-hover", 4.5],
  ["danger", "danger-surface", 4.5],
  ["success", "success-surface", 4.5],
  ["text-primary", "danger-surface", 4.5],
  ["text-primary", "success-surface", 4.5],
];

describe.each(SURFACES)("surface %s", (tone) => {
  const scope = resolveSurface(tone);
  const color = (role: string) => {
    const value = scope.get(`--color-${role}`);
    const hex = value ? resolveHex(value, scope) : null;
    if (!hex) throw new Error(`--color-${role} does not resolve to a solid colour on ${tone}`);
    return hex;
  };

  const cases = [
    ...BACKGROUNDS.flatMap((bg) => TEXT_ROLES.map((fg) => [fg, bg, 4.5] as const)),
    ...BACKGROUNDS.flatMap((bg) => GRAPHIC_ROLES.map((fg) => [fg, bg, 3] as const)),
    ...BACKGROUNDS.flatMap((bg) => LARGE_TEXT_ROLES.map((fg) => [fg, bg, 3] as const)),
    ...FILL_PAIRS,
  ];

  it.each(cases)("%s on %s ≥ %s:1", (foreground, background, minimum) => {
    expect(contrast(color(foreground), color(background))).toBeGreaterThanOrEqual(minimum);
  });
});
