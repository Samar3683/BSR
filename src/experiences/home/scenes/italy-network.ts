/*
 * The Italy network (Beats 5–6) as plain data and math — no Three.js, so the
 * shot configuration and tests can share it.
 *
 * Scale and placement: the map lies on the road world's ground plane at
 * 1 : 100 (10 world units = 1 km), rotated so the first corridor (Carpi →
 * Verona, the A22) runs straight up the road ahead (+Z), with Carpi exactly
 * under the lane line the truck drives beside. The road's lane line therefore
 * *is* the start of the route: nothing cuts, the camera only rises.
 *
 * Geography: an orthographic projection centred on Italy (accurate to < 1 %
 * across the country). Corridors are drawn through real towns on the major
 * motorway corridors (A1, A4, A14, A2, A22 …) — schematic curves, not road
 * geometry. Sea legs are ferry crossings (drawn dashed, never as bridges).
 */

/** World units per kilometre. */
export const MAP_SCALE = 10;
/** World X of the lane divider the route line grows from (placeholder-worlds DIVIDER). */
export const ROUTE_ORIGIN_X = 1.875;

const DEG = Math.PI / 180;
const R = 6371;
const CENTRE = { lon: 12.6, lat: 42.3 };

type LonLat = readonly [number, number];

/** Orthographic projection → east/north kilometres from the map centre. */
function project([lon, lat]: LonLat): [number, number] {
  const phi = lat * DEG;
  const phi0 = CENTRE.lat * DEG;
  const dl = (lon - CENTRE.lon) * DEG;
  return [
    R * Math.cos(phi) * Math.sin(dl),
    R * (Math.cos(phi0) * Math.sin(phi) - Math.sin(phi0) * Math.cos(phi) * Math.cos(dl)),
  ];
}

/** Real places (WGS84 lon/lat). Only hubs are drawn as nodes; the rest shape corridors. */
export const PLACES = {
  carpi: [10.885, 44.7836],
  modena: [10.9252, 44.6471],
  verona: [10.9916, 45.4384],
  brescia: [10.2118, 45.5416],
  milano: [9.19, 45.4642],
  novara: [8.6219, 45.4469],
  torino: [7.6869, 45.0703],
  piacenza: [9.693, 45.0526],
  parma: [10.3279, 44.8015],
  genova: [8.9463, 44.4056],
  laSpezia: [9.8241, 44.1025],
  livorno: [10.3106, 43.5485],
  padova: [11.8768, 45.4064],
  venezia: [12.242, 45.4904],
  trieste: [13.7768, 45.6495],
  bologna: [11.3426, 44.4949],
  firenze: [11.2558, 43.7696],
  arezzo: [11.8797, 43.4633],
  orvieto: [12.1106, 42.7185],
  roma: [12.4964, 41.9028],
  frosinone: [13.3499, 41.6396],
  caserta: [14.3328, 41.0747],
  napoli: [14.2681, 40.8518],
  salerno: [14.7681, 40.6824],
  lagonegro: [15.765, 40.123],
  cosenza: [16.2537, 39.2983],
  lameziaTerme: [16.309, 38.964],
  reggioCalabria: [15.6473, 38.1113],
  messina: [15.554, 38.1938],
  catania: [15.083, 37.5079],
  enna: [14.2795, 37.5669],
  palermo: [13.3615, 38.1157],
  rimini: [12.5695, 44.0678],
  ancona: [13.5189, 43.6158],
  pescara: [14.2161, 42.4618],
  termoli: [14.9954, 42.0016],
  foggia: [15.5446, 41.4622],
  avellino: [14.7906, 40.9146],
  bari: [16.8719, 41.1171],
  brindisi: [17.9418, 40.6327],
  civitavecchia: [11.7954, 42.0924],
  olbia: [9.4964, 40.9239],
  nuoro: [9.3308, 40.3209],
  oristano: [8.5886, 39.9036],
  cagliari: [9.1217, 39.2238],
  // Europe hints (unlabelled; toward the confirmed corridors only).
  frejus: [6.69, 45.11],
  lyon: [4.8357, 45.764],
  ventimiglia: [7.6077, 43.7903],
  marseille: [5.3698, 43.2965],
  montpellier: [3.8767, 43.6108],
  barcelona: [2.1734, 41.3851],
  ljubljana: [14.5058, 46.0569],
  zagreb: [15.9819, 45.815],
  budapest: [19.0402, 47.4979],
  arad: [21.3129, 46.1866],
  igoumenitsa: [20.2663, 39.5061],
  ioannina: [20.8537, 39.665],
  thessaloniki: [22.9444, 40.6401],
  alexandroupoli: [25.8744, 40.8457],
} as const satisfies Record<string, LonLat>;

export type PlaceId = keyof typeof PLACES;

/** Nodes drawn on the map (small, restrained). */
export const HUBS: readonly PlaceId[] = [
  "carpi",
  "verona",
  "milano",
  "torino",
  "genova",
  "venezia",
  "trieste",
  "bologna",
  "firenze",
  "roma",
  "napoli",
  "bari",
  "reggioCalabria",
  "palermo",
  "catania",
  "cagliari",
  "olbia",
];

/** The four labels (fewer is stronger). */
export const LABELS: ReadonlyArray<{ place: PlaceId; text: string; origin?: boolean }> = [
  { place: "carpi", text: "Carpi · Modena", origin: true },
  { place: "milano", text: "Milano" },
  { place: "roma", text: "Roma" },
  { place: "napoli", text: "Napoli" },
];

export type CorridorKind = "primary" | "secondary" | "sea";

/** A named place, or an inland shaping point (keeps coastal corridors on land). */
export type Waypoint = PlaceId | LonLat;

export interface Corridor {
  kind: CorridorKind;
  /** Starts at a place already reached by an earlier corridor (growth order). */
  via: readonly Waypoint[];
}

export const lonLatOf = (waypoint: Waypoint): LonLat =>
  typeof waypoint === "string" ? PLACES[waypoint] : waypoint;

/** Growth order: outward from Carpi. The first corridor is the road ahead. */
export const CORRIDORS: readonly Corridor[] = [
  { kind: "primary", via: ["carpi", "verona"] }, // A22 — the road the truck is on
  { kind: "primary", via: ["carpi", "modena", "bologna"] },
  { kind: "primary", via: ["verona", "brescia", "milano"] }, // A4
  { kind: "primary", via: ["verona", "padova", "venezia", [12.3736, 45.5795], [12.5647, 45.6297], [12.8367, 45.7775], [13.3102, 45.9054], [13.5333, 45.8074], [13.64, 45.77], "trieste"] }, // A4
  { kind: "primary", via: ["bologna", "firenze", "arezzo", "orvieto", "roma"] }, // A1
  { kind: "primary", via: ["bologna", "rimini", [12.85, 43.88], [13.18, 43.68], "ancona", [13.62, 43.4], [13.78, 43.05], [13.98, 42.7], "pescara", [14.45, 42.25], [14.75, 42.08], "termoli", "foggia", "bari"] }, // A14
  { kind: "primary", via: ["roma", "frosinone", "caserta", "napoli"] }, // A1
  { kind: "secondary", via: ["milano", "novara", "torino"] }, // A4
  { kind: "secondary", via: ["carpi", "parma", "piacenza", "milano"] }, // A1
  { kind: "secondary", via: ["milano", "genova"] }, // A7
  { kind: "secondary", via: ["genova", [9.25, 44.4], [9.6, 44.27], "laSpezia", [10.0977, 44.0793], [10.1417, 44.0354], [10.2273, 43.9588], [10.4017, 43.7228], "livorno"] }, // A12
  { kind: "secondary", via: ["napoli", "avellino", "foggia"] }, // A16
  { kind: "secondary", via: ["bari", [17.35, 40.8], "brindisi"] },
  { kind: "primary", via: ["napoli", "salerno", "lagonegro", "cosenza", "lameziaTerme", [16.1, 38.65], [15.95, 38.35], "reggioCalabria"] }, // A2
  { kind: "sea", via: ["reggioCalabria", "messina"] }, // Strait of Messina ferry
  { kind: "secondary", via: ["messina", [15.33, 37.95], [15.2, 37.85], "catania"] }, // A18
  { kind: "secondary", via: ["catania", "enna", "palermo"] }, // A19
  { kind: "secondary", via: ["roma", "civitavecchia"] },
  { kind: "sea", via: ["civitavecchia", "olbia"] }, // Tyrrhenian ferry
  { kind: "secondary", via: ["olbia", "nuoro", "oristano", "cagliari"] }, // SS131 DCN / SS131
];

/** "And beyond": faint continuations toward the confirmed European corridors only. */
export const EUROPE_HINTS: readonly Corridor[] = [
  { kind: "secondary", via: ["torino", "frejus", "lyon"] }, // France
  { kind: "secondary", via: ["genova", "ventimiglia", "marseille", "montpellier", "barcelona"] }, // France → Spain / Portugal
  { kind: "secondary", via: ["trieste", "ljubljana", "zagreb", "budapest", "arad"] }, // Hungary → Romania
  { kind: "sea", via: ["brindisi", "igoumenitsa"] }, // Adriatic ferry
  { kind: "secondary", via: ["igoumenitsa", "ioannina", "thessaloniki", "alexandroupoli"] }, // Greece → Türkiye
];

// ---------------------------------------------------------------- placement
const origin = project(PLACES.carpi);
const ahead = project(PLACES.verona);
/** Rotation that puts Carpi → Verona on +Z (the road ahead). */
const BEARING = Math.atan2(ahead[0] - origin[0], ahead[1] - origin[1]);
const COS = Math.cos(BEARING);
const SIN = Math.sin(BEARING);

/**
 * Longitude/latitude → road-world ground position [x, z]. Truck left is +X,
 * so east maps towards −X (before the bearing rotation).
 */
export function geoToWorld(lonLat: LonLat): [number, number] {
  const [e0, n0] = project(lonLat);
  const e = e0 - origin[0];
  const n = n0 - origin[1];
  const z = (n * COS + e * SIN) * MAP_SCALE;
  const x = -(e * COS - n * SIN) * MAP_SCALE;
  return [x + ROUTE_ORIGIN_X, z];
}

/** Map north as a world direction (x, z) — for the overview camera. */
export const MAP_NORTH: readonly [number, number] = [SIN, COS];
/** Overview camera azimuth (degrees): from the south, so the map reads north-up. */
export const ITALY_VIEW_AZIMUTH_DEG = 180 + BEARING / DEG;
/** Visual centre of Italy + islands for the overview (world x, z). */
export const ITALY_VIEW_CENTRE: readonly [number, number] = geoToWorld([12.35, 41.75]);
