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
 *   4. The admin area (src/admin, app/admin) is a separate product: public
 *      code never imports it, and it never imports the public site's
 *      features, components, providers, stores or the hero.
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

const ADMIN_ONLY = {
  group: ["@/admin", "@/admin/*"],
  message: "The public site must not depend on the admin area (src/admin).",
};

const PUBLIC_ONLY = {
  group: [
    "@/features/*",
    "@/experiences/*",
    "@/components/*",
    "@/providers/*",
    "@/stores/*",
    "@/hooks/*",
    "@/lib/three/*",
    "three",
    "three/*",
    "@react-three/*",
  ],
  message: "The admin area is isolated from the public site: use src/admin modules.",
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
    rules: restrictImports({ extra: [ADMIN_ONLY] }),
  },
  {
    files: ["src/experiences/**"],
    rules: restrictImports({ forbidden: ["app"], extra: [ADMIN_ONLY] }),
  },
  {
    files: ["src/features/**"],
    rules: restrictImports({ forbidden: ["app"], extra: [HERO_INDEPENDENCE, ADMIN_ONLY] }),
  },
  {
    files: ["src/components/**"],
    rules: restrictImports({ forbidden: ABOVE_COMPONENTS, extra: [HERO_INDEPENDENCE, ADMIN_ONLY] }),
  },
  {
    files: ["src/hooks/**", "src/stores/**"],
    rules: restrictImports({ forbidden: ABOVE_STATE, extra: [ADMIN_ONLY] }),
  },
  {
    files: ["src/lib/**", "src/config/**", "src/constants/**", "src/types/**"],
    rules: restrictImports({ forbidden: ABOVE_FOUNDATION, extra: [ADMIN_ONLY] }),
  },
  {
    files: ["src/lib/animation/**"],
    rules: restrictImports({ gsap: false, forbidden: ABOVE_FOUNDATION, extra: [ADMIN_ONLY] }),
  },
  {
    // The admin area and its routes (and the /admin request proxy).
    files: ["src/admin/**", "src/app/admin/**", "src/proxy.ts"],
    rules: restrictImports({ extra: [PUBLIC_ONLY] }),
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
    // Local PostgreSQL cluster and mail sink.
    ".postgres-local/**",
    ".supabase-local/**",
  ]),
]);

export default eslintConfig;
