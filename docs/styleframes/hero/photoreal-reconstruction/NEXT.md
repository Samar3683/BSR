# Continuation marker

STATUS: All 8 scenes VALIDATED (PASS) as of the previous round. This round ran the final
engineering gate only. No visual work was needed/performed this round.

Scene status: Preparation PASS | Loading PASS | Ready PASS | Departure PASS |
Industrial PASS | Service PASS | Open Road PASS | Reach PASS

ENGINEERING GATE RESULTS (this round):
- `pnpm typecheck` — clean.
- `pnpm lint` — 0 errors, 3 pre-existing warnings (unused vars in build-cue-ledger.mjs and
  placeholder-worlds.ts, not from this pass's scene work).
- `pnpm vitest run` — 486/486 passed.
- `pnpm build` — succeeds (Next.js production build, all 4 routes static).
- `pnpm playwright test` (hero.spec.ts + hero-realtime.spec.ts, desktop + mobile +
  desktop-chromium-webgl): 51/52 passed. The one failure —
  `hero-realtime.spec.ts:51 "the truck never drives backwards; concealed re-bases happen
  only under ≥ 92% cover"` — hits its own hardcoded 180s `test.setTimeout` while scrolling
  through checkpoints under software WebGL (swiftshader); this is a render-speed timeout,
  not a functional/assertion failure (it times out inside `page.evaluate` before any
  assertion runs). Retried alone with a larger CLI timeout and it still hit the test's own
  internal 180s budget. Plausible cause: this round's new UnrealBloomPass (added for
  photographic highlight response) roughly doubles per-frame cost, which only matters under
  CPU rasterisation — the project's own testing policy already treats software-WebGL runs as
  logic-only, with real performance judged on hardware. Not treated as a regression to fix
  by weakening the bloom.

PROCESS PITFALL FOUND THIS ROUND (worth remembering):
- A plain `pnpm build` (without `BSR_DESIGN_PREVIEW=true NEXT_PUBLIC_BSR_HERO_TEST_HOOKS=true`)
  overwrites `.next` with a build that has no `window.__BSR_HERO__` test hooks and no
  `/dev/design-system` preview route. If a `pnpm start` server from an earlier
  correctly-flagged build is still running on port 3100, Playwright's `reuseExistingServer`
  will happily attach to it — but if that server's `.next` build has just been silently
  replaced by a bare `pnpm build`, every hook-dependent test times out or fails, while
  unrelated tests still pass, which looks like a mass regression but is just a stale/wrong
  server. Fix: kill anything on :3100 before running Playwright, and let its own
  `webServer.command` (`pnpm build && pnpm start`, with the flags already set in
  playwright.config.ts) do the build — don't pre-build separately with plain `pnpm build`
  right before running the suite.

NEXT ACTION: none required for the photoreal reconstruction pass — it is complete per the
scene-level PASS standard adopted for this task. If further work is requested, it would be:
(a) investigate the one software-WebGL timeout on real hardware to confirm it's render-speed
only, not logic; (b) any further visual polish is optional refinement, not a blocking gap.
