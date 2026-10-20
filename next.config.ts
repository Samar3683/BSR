import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // The Docker image (Dockerfile) runs a self-contained server from .next/standalone.
  ...(process.env.BUILD_STANDALONE === "1" ? { output: "standalone" as const } : {}),
  env: {
    // Always defined at build time, so hero dev/test tooling guarded by it is
    // compiled out of normal production builds ("true" only for test builds).
    NEXT_PUBLIC_BSR_HERO_TEST_HOOKS: process.env.NEXT_PUBLIC_BSR_HERO_TEST_HOOKS ?? "false",
  },
  images: {
    // Cinematic imagery is heavy; prefer the most efficient formats first.
    formats: ["image/avif", "image/webp"],
  },
};

export default nextConfig;
