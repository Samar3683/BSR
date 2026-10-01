/**
 * Imports the supplied BSR image package into the site.
 *
 *   node tools/media/import-site-media.mjs
 *
 * Source: assets/source/BSR-All-Images-WebP-SVG (see its README.txt). Every file
 * in the package is imported and has a role:
 *   - root photographs          → the live scenes (livery "final");
 *   - custom-bsr-wrap/, color-variants/<colour>/
 *                               → alternative livery sets, selectable with one
 *                                 constant (src/config/media.ts), reviewed at /dev/media;
 *   - alternate-blue-render/, design-references/, earlier-drafts/
 *                               → archive, reviewed at /dev/media, never on public pages;
 *   - the coverage map (four SVG variants)
 *                               → coverage chapter (dark geography + animated routes),
 *                                 quote-request page (light), not-found page (geography).
 *
 * Output:
 *   public/assets/images/content/{scenes,archive,maps}/…   (web-weight WebP, original
 *     pixel dimensions — never upscaled; SVGs copied, one dark geography derived)
 *   src/app/opengraph-image.jpg (+ .alt.txt)               (1200×630 social card)
 *   src/config/media-manifest.ts                           (generated: paths, sizes, blur)
 *   src/features/routes/graphics/coverage-network.ts       (generated: route layer data)
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "../..");
const require = createRequire(path.join(root, "package.json"));
const sharp = require(
  require.resolve("sharp", { paths: [path.dirname(require.resolve("next/package.json"))] }),
);

const SRC = path.join(root, "assets/source/BSR-All-Images-WebP-SVG");
const PUBLIC_DIR = path.join(root, "public/assets/images/content");
const URL_ROOT = "/assets/images/content";
const QUALITY = 86;

const SCENES = {
  "01-services-express-sunrise-motorway": "express-motorway",
  "02-services-dedicated-loading-dock": "dedicated-dock",
  "03-coverage-northern-italy-aerial": "coverage-aerial",
  "04-process-direct-contact": "direct-contact",
  "05-vehicles-van": "van",
  "06-vehicles-rigid-truck": "rigid-truck",
  "07-vehicles-articulated-truck": "articulated-truck",
  "08-protection-secured-cargo": "secured-cargo",
  "09-protection-wrapped-pallet-detail": "wrapped-pallet",
  "10-final-cta-truck-departure": "truck-departure",
  "11-loading-forklift-threshold": "forklift-loading",
  "13-cargo-ready-for-dispatch": "cargo-dispatch",
};
const LIVERY_DIRS = {
  final: ".",
  "custom-wrap": "custom-bsr-wrap",
  black: "color-variants/black",
  blue: "color-variants/blue",
  green: "color-variants/green",
  red: "color-variants/red",
};
const ARCHIVE = [
  ["alternate-blue-render", "alternate-blue-render/05-vehicles-van.webp", "van"],
  ["alternate-blue-render", "alternate-blue-render/06-vehicles-rigid-truck.webp", "rigid-truck"],
  [
    "alternate-blue-render",
    "alternate-blue-render/07-vehicles-articulated-truck.webp",
    "articulated-truck",
  ],
  [
    "design-references",
    "design-references/front-three-quarter/07-vehicles-articulated-truck.webp",
    "articulated-front-three-quarter",
  ],
  [
    "design-references",
    "design-references/rear/07-vehicles-articulated-truck.webp",
    "articulated-rear",
  ],
  [
    "design-references",
    "design-references/side/07-vehicles-articulated-truck.webp",
    "articulated-side",
  ],
  [
    "earlier-drafts",
    "earlier-drafts/articulated-before-wheel-correction/07-vehicles-articulated-truck.webp",
    "articulated-before-wheel-correction",
  ],
  [
    "earlier-drafts",
    "earlier-drafts/dock-before-white-stripe/02-services-dedicated-loading-dock.webp",
    "dock-before-white-stripe",
  ],
  [
    "earlier-drafts",
    "earlier-drafts/dock-first-render/02-services-dedicated-loading-dock.webp",
    "dock-first-render",
  ],
  [
    "earlier-drafts",
    "earlier-drafts/motorway-before-white-stripe/01-services-express-sunrise-motorway.webp",
    "motorway-before-white-stripe",
  ],
  [
    "earlier-drafts",
    "earlier-drafts/motorway-first-render/01-services-express-sunrise-motorway.webp",
    "motorway-first-render",
  ],
];

async function importPhoto(srcRel, destRel) {
  const input = path.join(SRC, srcRel);
  const dest = path.join(PUBLIC_DIR, destRel);
  mkdirSync(path.dirname(dest), { recursive: true });
  const image = sharp(input);
  const { width, height } = await image.metadata();
  await image.webp({ quality: QUALITY, effort: 5 }).toFile(dest);
  const blur = await sharp(input).resize(16).webp({ quality: 50 }).toBuffer();
  return {
    src: `${URL_ROOT}/${destRel}`,
    width,
    height,
    blurDataURL: `data:image/webp;base64,${blur.toString("base64")}`,
  };
}

// --- Photographs -------------------------------------------------------------
const scenes = {};
for (const [livery, dir] of Object.entries(LIVERY_DIRS)) {
  scenes[livery] = {};
  for (const [file, id] of Object.entries(SCENES)) {
    const srcRel = path.join(dir, `${file}.webp`);
    try {
      readFileSync(path.join(SRC, srcRel));
    } catch {
      continue; // this livery set does not include the scene
    }
    scenes[livery][id] = await importPhoto(srcRel, `scenes/${livery}/${id}.webp`);
  }
}
const archive = [];
for (const [group, srcRel, name] of ARCHIVE) {
  archive.push({ group, name, ...(await importPhoto(srcRel, `archive/${group}/${name}.webp`)) });
}

// --- Maps ------------------------------------------------------------------------
const mapsDir = path.join(PUBLIC_DIR, "maps");
mkdirSync(mapsDir, { recursive: true });
const readMap = (rel) => readFileSync(path.join(SRC, rel), "utf8");
const light = readMap("12-bsr-coverage-network-map.svg");
const dark = readMap("map-variants/dark/12-bsr-coverage-network-map.svg");
const geography = readMap("map-variants/geography-only/12-bsr-coverage-network-map.svg");
const routes = readMap("map-variants/routes-only/12-bsr-coverage-network-map.svg");
writeFileSync(path.join(mapsDir, "coverage-light.svg"), light);
writeFileSync(path.join(mapsDir, "coverage-dark.svg"), dark);
writeFileSync(path.join(mapsDir, "coverage-geography.svg"), geography);
writeFileSync(path.join(mapsDir, "coverage-routes.svg"), routes);

// Dark geography only: the dark variant up to its network layer, without the
// opaque background (the section's own surface shows through). Italy is lifted
// one material step so it stays dominant over the context countries.
const networkAt = dark.indexOf('<g id="network"');
if (networkAt < 0) throw new Error("dark map: no network layer");
const darkGeography =
  dark
    .slice(0, networkAt)
    .replace(/<rect id="background"[^>]*\/>/, "")
    .replace("BSR coverage — dark", "BSR coverage — dark geography")
    .replace(/(id="italy-mainland-sicily-sardinia" fill=")#121615/, "$1#2E3431") + "</svg>\n";
writeFileSync(path.join(mapsDir, "coverage-geography-dark.svg"), darkGeography);

// Route layer data (from routes-only) and labels (from the dark variant).
const group = (svg, id) => {
  const start = svg.indexOf(`<g id="${id}"`);
  if (start < 0) throw new Error(`routes map: no group ${id}`);
  return svg.slice(start, svg.indexOf("</g>", start));
};
const paths = (svg, id) =>
  [...group(svg, id).matchAll(/<path id="([^"]+)" d="([^"]+)"/g)].map(([, pid, d]) => ({
    id: pid,
    d,
  }));
const points = [
  ...group(routes, "city-points").matchAll(/<circle id="([^"]+)" cx="([\d.]+)" cy="([\d.]+)"/g),
].map(([, id, cx, cy]) => ({ id, x: Number(cx), y: Number(cy) }));
const labels = [
  ...dark.matchAll(
    /<text id="label-([^"]+)" x="([\d.]+)" y="([\d.]+)" text-anchor="(\w+)"[^>]*>([^<]+)<\/text>/g,
  ),
].map(([, id, x, y, anchor, text]) => ({ id, text, x: Number(x), y: Number(y), anchor }));
const clip = routes.match(
  /<clipPath id="map-clip"><rect x="(\d+)" y="(\d+)" width="(\d+)" height="(\d+)"/,
);
const origin = points.find((p) => p.id === "carpi-origin");
const cities = points
  .filter((p) => p.id.startsWith("point-"))
  .map((p) => ({ ...p, id: p.id.replace("point-", "") }));

const network = {
  italyRoutes: paths(routes, "italy-primary-routes"),
  italyFerries: paths(routes, "italy-ferry-routes"),
  europeCorridors: paths(routes, "europe-corridors"),
  europeFerries: paths(routes, "europe-ferry"),
};

const json = (value) => JSON.stringify(value, null, 2);
const header = (what) => `/*
 * GENERATED by tools/media/import-site-media.mjs — do not edit by hand.
 * ${what}
 */
`;

writeFileSync(
  path.join(root, "src/features/routes/graphics/coverage-network.ts"),
  `${header("Route layer of the supplied BSR coverage map (map-variants/routes-only; labels from\n * map-variants/dark). Natural Earth 1:50m, equirectangular at 43°N — the same viewBox as\n * the geography layer it is drawn over. Corridors are schematic, not driving directions;\n * the supplier's dashed segments are sea (ferry) connections.")}
export const NETWORK_VIEWBOX = "0 0 1800 1000";
export const NETWORK_CLIP = ${json({ x: +clip[1], y: +clip[2], width: +clip[3], height: +clip[4] })} as const;

export interface RoutePath {
  id: string;
  d: string;
}

export const ITALY_ROUTES: readonly RoutePath[] = ${json(network.italyRoutes)};
export const ITALY_FERRIES: readonly RoutePath[] = ${json(network.italyFerries)};
export const EUROPE_CORRIDORS: readonly RoutePath[] = ${json(network.europeCorridors)};
export const EUROPE_FERRIES: readonly RoutePath[] = ${json(network.europeFerries)};

/** Carpi, the origin of every route. */
export const ORIGIN = ${json({ x: origin.x, y: origin.y })} as const;
/** Representative emphasis points — not an exhaustive service list. */
export const CITIES = ${json(cities)} as const;
export const LABELS = ${json(labels)} as const;
`,
);

const assetEntry = (a) =>
  `{ src: "${a.src}", width: ${a.width}, height: ${a.height}, blurDataURL: "${a.blurDataURL}" }`;
const sceneBlock = Object.entries(scenes)
  .map(
    ([livery, set]) =>
      `  "${livery}": {\n${Object.entries(set)
        .map(([id, a]) => `    "${id}": ${assetEntry(a)},`)
        .join("\n")}\n  },`,
  )
  .join("\n");
const archiveBlock = archive
  .map((a) => `  { group: "${a.group}", name: "${a.name}", ...${assetEntry(a)} },`)
  .join("\n");

writeFileSync(
  path.join(root, "src/config/media-manifest.ts"),
  `${header("Every image of the supplied package (assets/source/BSR-All-Images-WebP-SVG), as served\n * from public/: path, original pixel size (never upscaled) and a tiny blur placeholder.")}
export interface MediaAsset {
  src: string;
  width: number;
  height: number;
  blurDataURL: string;
}

export type SceneId = ${Object.values(SCENES)
    .map((id) => `"${id}"`)
    .join(" | ")};
export type Livery = ${Object.keys(LIVERY_DIRS)
    .map((l) => `"${l}"`)
    .join(" | ")};

/** Scene photographs per livery set. "final" is complete; the others cover the scenes with vehicles. */
export const SCENES: Record<Livery, Partial<Record<SceneId, MediaAsset>>> = {
${sceneBlock}
};

/** Superseded and reference images: review only, never on public pages. */
export const ARCHIVE: readonly (MediaAsset & { group: string; name: string })[] = [
${archiveBlock}
];

/** The supplied coverage map, all variants sharing one viewBox (1800 × 1000). */
export const MAPS = {
  light: "${URL_ROOT}/maps/coverage-light.svg",
  dark: "${URL_ROOT}/maps/coverage-dark.svg",
  geography: "${URL_ROOT}/maps/coverage-geography.svg",
  routes: "${URL_ROOT}/maps/coverage-routes.svg",
  /** Derived: the dark variant's geography only (transparent), under the animated route layer. */
  geographyDark: "${URL_ROOT}/maps/coverage-geography-dark.svg",
} as const;
`,
);

// --- Social card -------------------------------------------------------------------
await sharp(path.join(SRC, "01-services-express-sunrise-motorway.webp"))
  .resize(1200, 630, { fit: "cover", position: "centre" })
  .jpeg({ quality: 84, mozjpeg: true })
  .toFile(path.join(root, "src/app/opengraph-image.jpg"));
writeFileSync(
  path.join(root, "src/app/opengraph-image.alt.txt"),
  "Autoarticolato BSR su un'autostrada all'alba.",
);

const count = Object.values(scenes).reduce((n, s) => n + Object.keys(s).length, 0);
console.log(
  `Imported ${count} scene photographs, ${archive.length} archive images, 5 map files, 1 social card.`,
);
