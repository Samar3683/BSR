import { defineConfig } from "vitest/config";

/**
 * Database integration tests (tests/db): migrations, RLS, privileges,
 * triggers and RPCs against a running PostgreSQL (`pnpm db:start`, then
 * `pnpm db:reset`). Connection: DATABASE_ADMIN_URL
 * (default postgresql://postgres@localhost:54320/bsr).
 */
export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    include: ["tests/db/**/*.test.ts"],
    environment: "node",
    testTimeout: 30_000,
    hookTimeout: 60_000,
    fileParallelism: false,
  },
});
