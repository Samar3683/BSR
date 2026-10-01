/**
 * Builds the hero's Italy geometry from Natural Earth (public domain).
 *
 *   node tools/geo/build-italy-geo.mjs
 *
 * Source: assets/source/geo/ne_10m_admin_0_countries.geojson
 *   (Natural Earth 1:10m Admin 0 – Countries, v5.x, nvkelso/natural-earth-vector,
 *   public domain — https://www.naturalearthdata.com/about/terms-of-use/)
 *
 * Output: src/experiences/home/scenes/italy-geo.ts
 *   - ITALY_RINGS: Italy's outer rings (mainland, Sicily, Sardinia and the larger
 *     islands; enclaves filled), Douglas–Peucker simplified to ≈ 0.5 km;
 *   - CONTEXT_RINGS: neighbouring land around Italy (no borders are drawn; the
 *     fills merge into one faint landmass), simplified to ≈ 4 km.
 * Rings are flat [lon, lat, lon, lat, …] arrays, rounded to 0.001° (≈ 100 m).
 * The script prints a self-check: area of mainland/Sicily/Sardinia vs published figures.
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "../..");
const source = path.join(root, "assets/source/geo/ne_10m_admin_0_countries.geojson");
const out = path.join(root, "src/experiences/home/scenes/italy-geo.ts");
const countries = JSON.parse(readFileSync(source, "utf8")).features;

const LAT0 = 42;
const KX = 111.32 * Math.cos((LAT0 * Math.PI) / 180);
const KY = 110.57;
const km = ([lon, lat]) => [lon * KX, lat * KY];

/** Ring area (km²) on the sphere, via a projection local to the ring's own latitude. */
function areaKm2(ring) {
  const lat = ring.reduce((s, p) => s + p[1], 0) / ring.length;
  const kx = 111.32 * Math.cos((lat * Math.PI) / 180);
  let a = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    a += (ring[j][0] + ring[i][0]) * kx * (ring[i][1] - ring[j][1]) * KY;
  }
  return Math.abs(a / 2);
}

function simplify(ring, toleranceKm) {
  const pts = ring.map(km);
  const keep = new Uint8Array(pts.length);
  // A closed ring starts and ends on the same point: split it at the point
  // farthest from the start so both halves have a real baseline.
  let far = 0;
  pts.forEach(([x, y], i) => {
    if (Math.hypot(x - pts[0][0], y - pts[0][1]) > Math.hypot(pts[far][0] - pts[0][0], pts[far][1] - pts[0][1])) far = i;
  });
  keep[0] = keep[far] = keep[pts.length - 1] = 1;
  const stack = [
    [0, far],
    [far, pts.length - 1],
  ];
  while (stack.length) {
    const [a, b] = stack.pop();
    let max = 0;
    let index = -1;
    const [ax, ay] = pts[a];
    const [bx, by] = pts[b];
    const len = Math.hypot(bx - ax, by - ay) || 1e-9;
    for (let i = a + 1; i < b; i++) {
      const [px, py] = pts[i];
      const d = Math.abs((bx - ax) * (ay - py) - (ax - px) * (by - ay)) / len;
      if (d > max) {
        max = d;
        index = i;
      }
    }
    if (max > toleranceKm) {
      keep[index] = 1;
      stack.push([a, index], [index, b]);
    }
  }
  return ring.filter((_, i) => keep[i]);
}

const polygons = (feature) =>
  feature.geometry.type === "Polygon" ? [feature.geometry.coordinates] : feature.geometry.coordinates;
const flat = (ring) => ring.flatMap(([lon, lat]) => [+lon.toFixed(3), +lat.toFixed(3)]);

// ---------------------------------------------------------------- Italy
const italy = countries.find((f) => f.properties.ADM0_A3 === "ITA");
const italyRings = polygons(italy)
  .map((polygon) => polygon[0]) // outer ring only: San Marino / Vatican enclaves are filled
  .filter((ring) => areaKm2(ring) > 40)
  .sort((a, b) => areaKm2(b) - areaKm2(a))
  .map((ring) => simplify(ring, 0.5));

// ---------------------------------------------------------------- context land
const CONTEXT = new Set([
  "FRA", "ESP", "PRT", "AND", "MCO", "CHE", "LIE", "AUT", "DEU", "CZE", "SVK", "POL",
  "SVN", "HRV", "BIH", "MNE", "SRB", "KOS", "ALB", "MKD", "GRC", "BGR", "ROU", "HUN",
  "MDA", "UKR", "TUR", "CYP", "MLT", "TUN", "DZA", "LBY", "MAR", "SMR", "VAT", "BEL",
  "LUX", "NLD", "GBR", "IRL", "DNK", "SYR", "EGY", "N. Cyprus", "CYN", "BLR", "LTU",
]);
const BOX = { lon: [-12, 36], lat: [30, 56] };
const inBox = (ring) =>
  ring.some(([lon, lat]) => lon > BOX.lon[0] && lon < BOX.lon[1] && lat > BOX.lat[0] && lat < BOX.lat[1]);
const contextRings = countries
  .filter((f) => CONTEXT.has(f.properties.ADM0_A3))
  .flatMap((f) => polygons(f).map((p) => p[0]))
  .filter((ring) => inBox(ring) && areaKm2(ring) > 300)
  .map((ring) => simplify(ring, 4));

// ---------------------------------------------------------------- self-check
function contains(ring, [lon, lat]) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
const CHECK = [
  ["Mainland (Roma)", [12.496, 41.903], "≈ 251 000 km² (peninsula + north, excl. islands)"],
  ["Sicily (Palermo)", [13.361, 38.116], "25 711 km² (main island)"],
  ["Sardinia (Cagliari)", [9.122, 39.224], "23 813 km² (main island)"],
];
for (const [label, point, published] of CHECK) {
  const ring = italyRings.find((r) => contains(r, point));
  console.log(`${label}: ${ring ? `${Math.round(areaKm2(ring))} km², ${ring.length} points` : "NOT FOUND"} — published ${published}`);
}
const lons = italyRings.flat().map((p) => p[0]);
const lats = italyRings.flat().map((p) => p[1]);
console.log(
  `Italy: ${italyRings.length} rings, ${italyRings.reduce((n, r) => n + r.length, 0)} points; lon ${Math.min(...lons)}…${Math.max(...lons)}, lat ${Math.min(...lats)}…${Math.max(...lats)}`,
);
console.log(`Context: ${contextRings.length} rings, ${contextRings.reduce((n, r) => n + r.length, 0)} points`);

const format = (rings) => `[\n${rings.map((r) => `  [${flat(r).join(",")}],`).join("\n")}\n]`;
writeFileSync(
  out,
  `/*
 * GENERATED by tools/geo/build-italy-geo.mjs — do not edit by hand.
 *
 * Source: Natural Earth 1:10m Admin 0 – Countries (public domain,
 * https://www.naturalearthdata.com). Rings are flat [lon, lat, …] arrays (degrees,
 * rounded to 0.001°). ITALY_RINGS: mainland, Sicily, Sardinia and the larger islands,
 * simplified to ≈ 0.5 km. CONTEXT_RINGS: surrounding land (no borders), ≈ 4 km.
 */

export const ITALY_RINGS: readonly (readonly number[])[] = ${format(italyRings)};

export const CONTEXT_RINGS: readonly (readonly number[])[] = ${format(contextRings)};
`,
);
console.log(`wrote ${path.relative(root, out)}`);
