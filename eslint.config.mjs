import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

/*
 * Architectural guardrails, expressed as import restrictions:
 *   1. GSAP is only imported via @/lib/animation/gsap (single registration
 *      point, single animation authority).
 *   2. Dependencies point downwards:
 *        app → features / experiences → components → hooks / stores → lib / config / constants / types
 *   3. The site below the hero (features) is independent of the WebGL hero:
 *      no hero modules, no Three.js / R3F. The hero can then be replaced (e.g.
 *      by pre-rendered video) without touching anything below it.
 */
const GSAP_MESSAGE = "Import GSAP from '@/lib/animation/gsap' so plugins and eases are registered.";
const gsapRestriction = {
  paths: [{ name: "gsap", message: GSAP_MESSAGE }],
  patterns: [{ group: ["gsap/*", "@gsap/react"], message: GSAP_MESSAGE }],
};

const layer = (forbidden) => ({
  group: forbidden.map((dir) => `@/${dir}/*`),
  message: "Layer boundary: lower layers must not import from higher layers.",
});

const HERO_INDEPENDENCE = {
  group: ["@/experiences/*", "@/lib/three/*", "three", "three/*", "@react-three/*"],
  message:
    "The site below the hero must not depend on the WebGL hero or on Three.js (see docs/hero-baseline.md).",
};

const restrictImports = ({ gsap = true, forbidden = [], extra = [] }) => ({
  "no-restricted-imports": [
    "error",
    {
      paths: gsap ? gsapRestriction.paths : [],
      patterns: [
        ...(gsap ? gsapRestriction.patterns : []),
        ...(forbidden.length ? [layer(forbidden)] : []),
        ...extra,
      ],
    },
  ],
});

const ABOVE_FOUNDATION = [
  "app",
  "features",
  "experiences",
  "components",
  "providers",
  "stores",
  "hooks",
];
const ABOVE_STATE = ["app", "features", "experiences", "components", "providers"];
const ABOVE_COMPONENTS = ["app", "features", "experiences", "providers"];

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ["src/**/*.{ts,tsx}"],
    rules: restrictImports({}),
  },
  {
    files: ["src/experiences/**"],
    rules: restrictImports({ forbidden: ["app"] }),
  },
  {
    files: ["src/features/**"],
    rules: restrictImports({ forbidden: ["app"], extra: [HERO_INDEPENDENCE] }),
  },
  {
    files: ["src/components/**"],
    rules: restrictImports({ forbidden: ABOVE_COMPONENTS, extra: [HERO_INDEPENDENCE] }),
  },
  {
    files: ["src/hooks/**", "src/stores/**"],
    rules: restrictImports({ forbidden: ABOVE_STATE }),
  },
  {
    files: ["src/lib/**", "src/config/**", "src/constants/**", "src/types/**"],
    rules: restrictImports({ forbidden: ABOVE_FOUNDATION }),
  },
  {
    files: ["src/lib/animation/**"],
    rules: restrictImports({ gsap: false, forbidden: ABOVE_FOUNDATION }),
  },
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "playwright-report/**",
    "test-results/**",
    // Vendored decoder copied verbatim from three (pnpm assets:decoders).
    "public/assets/decoders/**",
    "archive/**",
  ]),
]);

export default eslintConfig;
