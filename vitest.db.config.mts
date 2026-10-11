import { defineConfig } from "vitest/config";

/**
 * Database integration tests (tests/db): migrations, RLS, privileges,
 * triggers and RPCs against a running Supabase database — the local stack
 * (`node tools/supabase-local/cli.mjs start`) or `supabase start`.
 * Connection: SUPABASE_DB_URL (default postgresql://postgres@localhost:54322/postgres).
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
