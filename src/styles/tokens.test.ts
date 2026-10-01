import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { siteConfig } from "@/config/site";
import { BREAKPOINTS } from "@/constants/breakpoints";
import { MOTION_DURATION, MOTION_EASE_CURVES } from "@/lib/animation/motion-tokens";
import { SCENE_COLOR_TOKENS, SCENE_COLORS } from "@/lib/three/brand-colors";

/**
 * CSS custom properties are the source of truth for design tokens; a few are
 * mirrored in TypeScript for GSAP and Next.js metadata. These tests keep the
 * two in sync.
 */
const css = readFileSync(new URL("./tokens.css", import.meta.url), "utf8");

function readToken(name: string): string {
  const match = css.match(new RegExp(`--${name}:\\s*([^;]+);`));
  if (!match?.[1]) throw new Error(`Token --${name} not found in tokens.css`);
  return match[1].trim();
}

describe("design token parity", () => {
  it.each(Object.entries(MOTION_DURATION))("duration %s", (name, seconds) => {
    expect(readToken(`duration-${name}`)).toBe(`${Math.round(seconds * 1000)}ms`);
  });

  it.each(Object.entries(MOTION_EASE_CURVES))("ease %s", (name, curve) => {
    expect(readToken(`ease-${name}`)).toBe(`cubic-bezier(${curve.join(", ")})`);
  });

  it.each(Object.entries(BREAKPOINTS))("breakpoint %s", (name, value) => {
    expect(readToken(`breakpoint-${name}`)).toBe(value);
  });

  it("theme colour matches the carbon background", () => {
    expect(readToken("color-carbon")).toBe(siteConfig.themeColor);
  });

  it.each(Object.entries(SCENE_COLORS))("scene colour %s matches its CSS token", (name, hex) => {
    expect(readToken(SCENE_COLOR_TOKENS[name as keyof typeof SCENE_COLORS])).toBe(hex);
  });
});
