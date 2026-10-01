import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
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
