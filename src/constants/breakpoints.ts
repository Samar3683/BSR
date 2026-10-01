/**
 * Layout breakpoints, mirroring `--breakpoint-*` in src/styles/tokens.css
 * (parity is enforced by src/styles/tokens.test.ts). For JS media queries such
 * as `gsap.matchMedia()`.
 *
 * Breakpoints describe layout only — never infer device capability from them;
 * that belongs to src/lib/performance.
 */
export const BREAKPOINTS = {
  sm: "40rem",
  md: "48rem",
  lg: "64rem",
  xl: "80rem",
  "2xl": "96rem",
} as const;

export type Breakpoint = keyof typeof BREAKPOINTS;

export function minWidthQuery(breakpoint: Breakpoint): string {
  return `(min-width: ${BREAKPOINTS[breakpoint]})`;
}
