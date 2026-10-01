import type { RealtimeQuality } from "@/lib/performance/quality";
import type { HeroRenderPath } from "@/lib/performance/tier-decision";

/*
 * Development / test tooling is enabled in `next dev`, and in production
 * builds made for the browser test suite (NEXT_PUBLIC_BSR_HERO_TEST_HOOKS=true,
 * always defined at build time via next.config.ts).
 *
 * Each guard spells out the build-time expression inline, in the module that
 * uses it: the bundler does not fold an imported constant, so an exported
 * flag would leave dead tooling code (and the debug chunk) in production.
 */

export interface HeroOverrides {
  path: HeroRenderPath | null;
  tier: RealtimeQuality | null;
  /** Show the development debug panel. */
  debug: boolean;
  /** Treat software WebGL (headless CI) as available; relaxes frame limits. */
  allowSoftware: boolean;
  /** Simulate a real-time asset failure. */
  failAssets: boolean;
  /** Delay the real-time load (ms) — simulates late readiness. */
  delayRealtimeMs: number;
}

export const NO_OVERRIDES: HeroOverrides = {
  path: null,
  tier: null,
  debug: false,
  allowSoftware: false,
  failAssets: false,
  delayRealtimeMs: 0,
};

const PATHS = new Set<HeroRenderPath>(["realtime", "media", "reduced", "fallback"]);
const TIERS = new Set<RealtimeQuality>(["high", "medium", "low"]);

/** Reads `?hero-*` URL overrides. Always the defaults outside dev/test builds. */
export function readHeroOverrides(search: string): HeroOverrides {
  if (
    process.env.NODE_ENV === "production" &&
    process.env.NEXT_PUBLIC_BSR_HERO_TEST_HOOKS !== "true"
  ) {
    return NO_OVERRIDES;
  }
  const params = new URLSearchParams(search);
  const path = params.get("hero-path") as HeroRenderPath | null;
  const tier = params.get("hero-tier") as RealtimeQuality | null;
  return {
    path: path && PATHS.has(path) ? path : null,
    tier: tier && TIERS.has(tier) ? tier : null,
    debug: params.has("hero-debug"),
    allowSoftware: params.has("hero-allow-software"),
    failAssets: params.get("hero-fail") === "assets",
    delayRealtimeMs: Math.max(0, Number(params.get("hero-delay")) || 0),
  };
}
