import { defineConfig } from "vitest/config";

export default defineConfig({
  // Path aliases come from tsconfig.json — the single source for Next.js,
  // TypeScript and Vitest.
  resolve: { tsconfigPaths: true },
  test: {
    include: ["src/**/*.test.ts", "supabase/functions/**/*.test.ts"],
    environment: "node",
  },
});
