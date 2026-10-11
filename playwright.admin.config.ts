import { defineConfig, devices } from "@playwright/test";

import { stackEnv } from "./tests/e2e-admin/stack";

/**
 * Admin panel end-to-end tests against a REAL Supabase backend: the local
 * stack (`pnpm supabase:local start`, Auth + PostgREST + Storage + Edge
 * Functions) or any project given by NEXT_PUBLIC_SUPABASE_URL /
 * NEXT_PUBLIC_SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY / SUPABASE_DB_URL.
 * Global setup resets the local database (set BSR_E2E_RESET=0 to skip) and
 * creates the test administrators. Tests share one database, so they run
 * serially.
 */
const PORT = 3200;
const baseURL = `http://localhost:${PORT}`;
const isCI = Boolean(process.env.CI);
const stack = stackEnv();

export default defineConfig({
  testDir: "./tests/e2e-admin",
  fullyParallel: false,
  workers: 1,
  forbidOnly: isCI,
  retries: 0,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: isCI ? "github" : "list",
  globalSetup: "./tests/e2e-admin/global-setup.ts",
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    viewport: { width: 1440, height: 900 },
  },
  projects: [
    {
      name: "admin-chromium",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } },
    },
  ],
  webServer: {
    command: `pnpm build && pnpm start --port ${PORT}`,
    url: `${baseURL}/admin/login`,
    reuseExistingServer: !isCI,
    timeout: 400_000,
    env: {
      NEXT_PUBLIC_SUPABASE_URL: stack.url,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: stack.anonKey,
      // Same test hooks as the public suite, so one build serves both.
      BSR_DESIGN_PREVIEW: "true",
      NEXT_PUBLIC_BSR_HERO_TEST_HOOKS: "true",
    },
  },
});
