import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;
// `localhost`, not 127.0.0.1: the Next.js dev server only serves its dev
// resources to the origin it was started with.
const baseURL = `http://localhost:${PORT}`;
const isCI = Boolean(process.env.CI);

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
  projects: [
    { name: "desktop-chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile-chromium", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    command: `pnpm build && pnpm start --port ${PORT}`,
    url: baseURL,
    reuseExistingServer: !isCI,
    timeout: 240_000,
    // Test build: exposes the design-system preview and the hero test hook
    // (window.__BSR_HERO_VIDEO__). Normal production builds have neither.
    env: { BSR_DESIGN_PREVIEW: "true", NEXT_PUBLIC_BSR_HERO_TEST_HOOKS: "true" },
  },
});
