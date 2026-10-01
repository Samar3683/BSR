import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;
// `localhost`, not 127.0.0.1: the Next.js dev server only serves its dev
// resources to the origin it was started with.
const baseURL = `http://localhost:${PORT}`;
const isCI = Boolean(process.env.CI);
const REALTIME_SPEC = /hero-realtime\.spec\.ts/;

/**
 * Browser tests run against a production build: dev-only overlays and
 * unminified bundles would distort accessibility and performance results.
 */
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  reporter: isCI ? "github" : "list",
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  // The software-WebGL spec (CPU rasterisation, which can saturate every core)
  // runs in its own projects after the others, so it never starves unrelated
  // tests of CPU. If the first projects fail, these are skipped.
  projects: [
    {
      name: "desktop-chromium",
      use: { ...devices["Desktop Chrome"] },
      testIgnore: REALTIME_SPEC,
    },
    { name: "mobile-chromium", use: { ...devices["Pixel 7"] }, testIgnore: REALTIME_SPEC },
    {
      name: "desktop-chromium-webgl",
      use: { ...devices["Desktop Chrome"] },
      testMatch: REALTIME_SPEC,
      dependencies: ["desktop-chromium", "mobile-chromium"],
    },
    {
      name: "mobile-chromium-webgl",
      use: { ...devices["Pixel 7"] },
      testMatch: REALTIME_SPEC,
      dependencies: ["desktop-chromium", "mobile-chromium"],
    },
  ],
  webServer: {
    command: `pnpm build && pnpm start --port ${PORT}`,
    url: baseURL,
    reuseExistingServer: !isCI,
    timeout: 240_000,
    // Test build: exposes the design-system preview and the hero test hooks
    // (overrides + window.__BSR_HERO__). Normal production builds have neither.
    env: { BSR_DESIGN_PREVIEW: "true", NEXT_PUBLIC_BSR_HERO_TEST_HOOKS: "true" },
  },
});
