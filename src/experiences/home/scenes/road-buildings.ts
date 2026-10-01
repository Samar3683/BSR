import {
  BoxGeometry,
  BufferGeometry,
  CylinderGeometry,
  DataTexture,
  Group,
  LinearFilter,
  LinearMipmapLinearFilter,
  Material,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  RepeatWrapping,
  SRGBColorSpace,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

import { createCladdingMaps, createSlatTexture, valueNoise } from "./world-details";

/*
 * Real proxy geometry for the road journey's near/mid-ground set pieces (replaces the flat
 * Blender impostor cards for buildings): dimensional facades with panel seams and rain
 * streaks, plinths, parapet coping, gutters + downpipes, recessed dock openings with
 * shelters, levellers, bumpers, wall-pack lanterns, personnel doors, roof plant, glazed
 * offices/shop fronts with interior depth, a full service station (canopy with underside
 * lights, columns on bases, pump islands with bollards, shop, kerbs, drainage, bay markings),
 * cascina/farm buildings with tiled/rusted roofs, fences and lamp columns.
 *
 * Convention (matches the card renders): local origin at the road-facing facade plane, the
 * facade faces −X (towards the road), the building extends +X (depth) and along Z (length);
 * the yard/apron lies in front (−X). Each builder returns one Group merged per material
 * (a handful of draw calls); instances share geometry and materials via clone().
 */

// ---------------------------------------------------------------- materials
interface Kit {
  cladGrey: MeshStandardMaterial;
  cladLight: MeshStandardMaterial;
  cladCream: MeshStandardMaterial;
  cladDark: MeshStandardMaterial;
  concrete: MeshStandardMaterial;
  roof: MeshStandardMaterial;
  galv: MeshStandardMaterial;
  dark: MeshStandardMaterial;
  door: MeshStandardMaterial;
  shelter: MeshStandardMaterial;
  glass: MeshStandardMaterial;
  glassLit: MeshStandardMaterial;
  plaster: MeshStandardMaterial[];
  terracotta: MeshStandardMaterial;
  rust: MeshStandardMaterial;
  yard: MeshStandardMaterial;
  line: MeshStandardMaterial;
  yellow: MeshStandardMaterial;
  canopy: MeshStandardMaterial;
  canopyLight: MeshStandardMaterial;
  rubber: MeshStandardMaterial;
  cabinet: MeshStandardMaterial;
  pump: MeshStandardMaterial;
  trailer: MeshStandardMaterial[];
  container: MeshStandardMaterial[];
  brick: MeshStandardMaterial;
  hay: MeshStandardMaterial;
}

function tex(data: Uint8Array, size: number, srgb = true, repeat = 1): DataTexture {
  const t = new DataTexture(data, size, size);
  t.wrapS = t.wrapT = RepeatWrapping;
  t.magFilter = LinearFilter;
  t.minFilter = LinearMipmapLinearFilter;
  t.generateMipmaps = true;
  t.anisotropy = 8;
  t.repeat.set(repeat, repeat);
  if (srgb) t.colorSpace = SRGBColorSpace;
  t.needsUpdate = true;
  return t;
}

function noiseTexture(base: [number, number, number], variation: number, seed: number, streak = 0): DataTexture {
  const size = 128;
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const n = 0.6 * valueNoise(x / 12, y / 12, 32, seed) + 0.4 * valueNoise(x / 3, y / 3, 32, seed + 1);
      const s = streak ? 1 - streak * valueNoise(x / 2, y / 40, 64, seed + 2) : 1;
      const k = (1 - variation + variation * 2 * n) * s;
      const i = (y * size + x) * 4;
      data[i] = Math.min(255, base[0] * k);
      data[i + 1] = Math.min(255, base[1] * k);
      data[i + 2] = Math.min(255, base[2] * k);
      data[i + 3] = 255;
    }
  }
  return tex(data, size);
}

function tileTexture(): DataTexture {
  const size = 128;
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const row = (y / size) * 10;
      const inRow = row % 1;
      const col = ((x / size) * 8 + (Math.floor(row) % 2) * 0.5) % 1;
      let k = 0.85 + 0.25 * valueNoise(x / 4, y / 4, 32, 70) + 0.1 * (Math.sin(Math.floor(row) * 5.1 + Math.floor((x / size) * 8) * 2.3) * 0.5);
      if (inRow < 0.08 || col < 0.04) k *= 0.55;
      const i = (y * size + x) * 4;
      data[i] = Math.min(255, 158 * k);
      data[i + 1] = Math.min(255, 82 * k);
      data[i + 2] = Math.min(255, 52 * k);
      data[i + 3] = 255;
    }
  }
  return tex(data, size);
}

let cachedKit: Kit | null = null;
function kit(): Kit {
  if (cachedKit) return cachedKit;
  const clad = (color: string, seed: number) => {
    const maps = createCladdingMaps();
    maps.color.repeat.set(1 / 6, 1 / 6);
    maps.roughness.repeat.set(1 / 6, 1 / 6);
    void seed;
    return new MeshStandardMaterial({ color, map: maps.color, roughnessMap: maps.roughness, roughness: 0.62, metalness: 0.08 });
  };
  const std = (color: string, roughness = 0.7, metalness = 0, map?: DataTexture) =>
    new MeshStandardMaterial({ color, roughness, metalness, ...(map ? { map } : {}) });
  const concreteMap = noiseTexture([200, 198, 190], 0.22, 11, 0.25);
  const plaster = ([
    [[214, 186, 140], 21],
    [[224, 214, 190], 23],
    [[206, 152, 128], 25],
    [[218, 205, 176], 27],
  ] as const).map(([c, seed]) => std("#ffffff", 0.9, 0, noiseTexture([...c] as [number, number, number], 0.14, seed, 0.3)));
  const yardMap = noiseTexture([120, 120, 118], 0.28, 31);
  yardMap.repeat.set(1 / 4, 1 / 4);
  const roofMap = noiseTexture([150, 152, 150], 0.18, 41);
  roofMap.repeat.set(1 / 5, 1 / 5);
  const rustMap = noiseTexture([150, 96, 70], 0.3, 51, 0.4);
  const tile = tileTexture();
  const trailerMap = (seed: number, tone: [number, number, number]) => noiseTexture(tone, 0.1, seed, 0.3);
  cachedKit = {
    cladGrey: clad("#8e959b", 1),
    cladLight: clad("#c4c6c2", 2),
    cladCream: clad("#c9c0a8", 3),
    cladDark: clad("#33383d", 4),
    concrete: std("#ffffff", 0.88, 0, concreteMap),
    roof: std("#ffffff", 0.75, 0.1, roofMap),
    galv: std("#a3a7aa", 0.45, 0.75),
    dark: std("#25282b", 0.6, 0.3),
    door: (() => {
      const m = std("#c1c6ca", 0.5, 0.3);
      m.map = createSlatTexture();
      return m;
    })(),
    shelter: std("#101214", 0.85),
    glass: new MeshStandardMaterial({ color: "#1f2a33", roughness: 0.04, metalness: 0.0, envMapIntensity: 1.6 }),
    glassLit: new MeshStandardMaterial({ color: "#2a2620", emissive: "#ffb872", emissiveIntensity: 1.1, roughness: 0.2 }),
    plaster,
    terracotta: std("#ffffff", 0.8, 0, tile),
    rust: std("#ffffff", 0.75, 0.3, rustMap),
    yard: std("#ffffff", 0.9, 0, yardMap),
    line: std("#e4e4dc", 0.6),
    yellow: std("#c99a10", 0.4, 0.1),
    canopy: std("#eceae4", 0.45, 0.1),
    canopyLight: new MeshStandardMaterial({ color: "#f4f2ea", emissive: "#fff3dc", emissiveIntensity: 1.6, roughness: 0.3 }),
    rubber: std("#0d0d0e", 0.9),
    cabinet: std("#6d7377", 0.55, 0.3),
    pump: std("#d8d8d4", 0.4, 0.2),
    trailer: [trailerMap(61, [230, 230, 226]), trailerMap(62, [176, 184, 190]), trailerMap(63, [205, 205, 200])].map((m) => std("#ffffff", 0.5, 0, m)),
    container: [
      std("#7a2a1c", 0.55, 0.3),
      std("#1f3a5c", 0.55, 0.3),
      std("#6a6f73", 0.55, 0.3),
    ],
    brick: std("#9c5a40", 0.85),
    hay: std("#b08a3c", 0.95),
  };
  return cachedKit;
}

// ---------------------------------------------------------------- assembler
/** World-scaled UVs (1 uv unit = 1 m per face) so tiled textures keep real scale. */
function box(w: number, h: number, d: number): BoxGeometry {
  const g = new BoxGeometry(w, h, d);
  const uv = g.attributes.uv!;
  const dims: Array<[number, number]> = [
    [d, h],
    [d, h],
    [w, d],
    [w, d],
    [w, h],
    [w, h],
  ];
  for (let face = 0; face < 6; face++) {
    for (let v = 0; v < 4; v++) {
      const i = face * 4 + v;
      uv.setXY(i, uv.getX(i) * dims[face]![0], uv.getY(i) * dims[face]![1]);
    }
  }
  return g;
}

class Assembler {
  private parts = new Map<Material, BufferGeometry[]>();
  private m = new Matrix4();

  add(geometry: BufferGeometry, material: Material, x: number, y: number, z: number, rotY = 0) {
    const g = geometry.clone();
    if (rotY) g.rotateY(rotY);
    g.applyMatrix4(this.m.makeTranslation(x, y, z));
    const list = this.parts.get(material) ?? [];
    list.push(g);
    this.parts.set(material, list);
  }

  /** Box centred at (x, y, z). */
  box(w: number, h: number, d: number, material: Material, x: number, y: number, z: number, rotY = 0) {
    this.add(box(w, h, d), material, x, y, z, rotY);
  }

  cyl(radius: number, height: number, material: Material, x: number, y: number, z: number, segments = 10) {
    this.add(new CylinderGeometry(radius, radius, height, segments), material, x, y, z);
  }

  /** Gable roof prism over [x0,x1] × [z0,z1], ridge along Z, eave at y. */
  gable(x0: number, x1: number, z0: number, z1: number, y: number, rise: number, material: Material, overhang = 0.5) {
    const w = x1 - x0 + overhang * 2;
    const half = w / 2;
    const slope = Math.hypot(half, rise);
    const angle = Math.atan2(rise, half);
    const cx = (x0 + x1) / 2;
    const length = z1 - z0 + overhang * 2;
    for (const s of [-1, 1]) {
      const g = box(slope, 0.16, length);
      g.rotateZ(s * angle);
      this.add(g, material, cx - (s * half) / 2, y + rise / 2, (z0 + z1) / 2);
    }
    // Gable ends (triangular infill as a stack of thin slabs is overkill: a box under the ridge).
    this.box(x1 - x0, rise * 0.98, z1 - z0, material, cx, y + rise / 2, (z0 + z1) / 2);
  }

  build(name: string): Group {
    const group = new Group();
    group.name = name;
    for (const [material, geometries] of this.parts) {
      const merged = mergeGeometries(geometries, false);
      if (!merged) continue;
      const mesh = new Mesh(merged, material);
      mesh.castShadow = mesh.receiveShadow = false;
      group.add(mesh);
      for (const g of geometries) g.dispose();
    }
    return group;
  }
}

// ---------------------------------------------------------------- shared assemblies
function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 100000) / 100000;
  };
}

/** Lamp column (tapered pole, base plate, hatch, arm, luminaire housing + lens). */
function lampColumn(a: Assembler, k: Kit, x: number, z: number, h = 10, facing = -1) {
  a.cyl(0.11, h, k.galv, x, h / 2, z, 8);
  a.cyl(0.22, 0.05, k.galv, x, 0.025, z, 10);
  a.box(0.06, 0.5, 0.18, k.dark, x, 0.8, z);
  a.box(1.7, 0.08, 0.08, k.galv, x + (facing * 1.7) / 2, h - 0.15, z);
  a.box(0.95, 0.15, 0.4, k.dark, x + facing * 1.65, h - 0.2, z);
  a.box(0.8, 0.02, 0.3, k.canopyLight, x + facing * 1.65, h - 0.3, z);
}

/** Wire-mesh security fence with posts and rails along Z at x. */
function fence(a: Assembler, k: Kit, x: number, z0: number, z1: number, h = 2.2) {
  for (let z = z0; z <= z1; z += 3) {
    a.box(0.08, h, 0.08, k.galv, x, h / 2, z);
    a.box(0.3, 0.2, 0.3, k.concrete, x, 0.1, z);
  }
  a.box(0.04, 0.04, z1 - z0, k.galv, x, h - 0.05, (z0 + z1) / 2);
  a.box(0.04, 0.04, z1 - z0, k.galv, x, 0.2, (z0 + z1) / 2);
  a.box(0.02, h - 0.4, z1 - z0, k.dark, x, h / 2 + 0.05, (z0 + z1) / 2); // mesh reads as a dark see-through band
}

function hall(a: Assembler, k: Kit, opts: { L: number; D: number; H: number; body: Material; doorEvery: number; seed: number; open?: number[] }) {
  const { L, D, H, body, seed } = opts;
  const r = rng(seed);
  a.box(D, H, L, body, D / 2, H / 2, 0);
  a.box(D + 0.2, 0.9, L + 0.2, k.cladDark, D / 2, H - 0.45, 0); // fascia band
  a.box(D + 0.5, 0.16, L + 0.5, k.galv, D / 2, H + 0.05, 0); // coping
  a.box(D + 0.05, 1.2, L + 0.05, k.concrete, D / 2, 0.6, 0); // plinth
  a.box(D - 0.4, 0.1, L - 0.4, k.roof, D / 2, H + 0.16, 0); // roof membrane
  a.box(0.26, 0.18, L, k.galv, -0.15, H - 1.3, 0); // eaves gutter
  // Downpipes with brackets and drain feet.
  for (let z = -L / 2 + 9; z < L / 2 - 5; z += 24) {
    a.cyl(0.06, H - 1.4, k.galv, -0.2, (H - 1.4) / 2, z, 8);
    a.box(0.16, 0.06, 0.16, k.dark, -0.12, H * 0.35, z);
    a.box(0.16, 0.06, 0.16, k.dark, -0.12, H * 0.7, z);
  }
  // Dock openings with shelters, levellers, bumpers, wall-packs, bay plates.
  const doors: number[] = [];
  for (let z = -L / 2 + 8; z < L / 2 - 6; z += opts.doorEvery) doors.push(z);
  doors.forEach((z, i) => {
    const open = (opts.open ?? []).includes(i);
    a.box(0.14, open ? 0.5 : 3.2, 3.0, k.door, -0.06, open ? 1.2 + 2.9 : 2.8, z);
    if (open) a.box(0.5, 3.0, 2.9, k.shelter, 0.3, 2.7, z); // dark bay behind the raised door
    a.box(0.7, 3.8, 0.35, k.shelter, -0.35, 3.1, z - 1.75);
    a.box(0.7, 3.8, 0.35, k.shelter, -0.35, 3.1, z + 1.75);
    a.box(0.7, 0.45, 3.85, k.shelter, -0.35, 4.8, z);
    a.box(1.0, 1.2, 3.0, k.concrete, -0.55, 0.6, z); // dock leveller pad
    for (const dz of [-1.6, 1.6]) a.box(0.22, 0.5, 0.2, k.rubber, -0.12, 1.1, z + dz);
    a.box(0.34, 0.3, 0.95, k.cabinet, -0.32, 5.6, z);
    a.box(0.05, 0.17, 0.82, k.canopyLight, -0.5, 5.53, z);
    a.box(0.05, 0.36, 0.55, k.line, -0.04, 5.05, z + 0.05);
    for (const dz of [-1.9, 1.9]) {
      a.cyl(0.13, 1.1, k.yellow, -1.5, 0.55, z + dz, 10);
      a.cyl(0.24, 0.04, k.galv, -1.5, 0.02, z + dz, 10);
    }
  });
  // End details: personnel door, cabinets, conduit.
  a.box(0.1, 2.1, 1.0, k.dark, -0.05, 1.05, -L / 2 + 4);
  a.box(0.06, 0.06, 0.2, k.galv, -0.12, 1.05, -L / 2 + 4.35);
  a.box(0.5, 1.8, 1.1, k.cabinet, -0.3, 0.9, L / 2 - 3);
  a.box(0.4, 1.2, 0.8, k.cabinet, -0.25, 0.6, -L / 2 + 8);
  a.cyl(0.035, 4.2, k.dark, -0.06, 2.3, L / 2 - 3.6, 6);
  // Roof plant: HVAC boxes with fans, vents, skylight strips, a hatch and a ladder.
  const nPlant = Math.max(4, Math.round(L / 14));
  for (let i = 0; i < nPlant; i++) {
    const w = 2 + r() * 3;
    const d = 1.5 + r() * 2;
    const h = 1 + r() * 1.2;
    const x = 3 + r() * (D - 6);
    const z = (r() - 0.5) * (L - 8);
    a.box(w, h, d, k.cladLight, x, H + 0.2 + h / 2, z);
    if (r() > 0.4) a.cyl(Math.min(w, d) * 0.3, 0.25, k.dark, x, H + 0.35 + h, z, 14);
  }
  for (let i = 0; i < nPlant; i++) a.cyl(0.35, 1.7, k.galv, 2 + r() * (D - 4), H + 1.05, (r() - 0.5) * (L - 6), 10);
  for (let z = -L / 2 + 10; z < L / 2 - 10; z += 22) a.box(D * 0.5, 0.25, 2.2, k.glassLit, D * 0.55, H + 0.3, z);
  // Yard: apron with joints, kerb, lamp columns, fence.
  a.box(30, 0.05, L + 12, k.yard, -15, 0.02, 0);
  for (let z = -L / 2; z <= L / 2; z += 6) a.box(30, 0.01, 0.05, k.dark, -15, 0.05, z);
  lampColumn(a, k, -22, -L / 4, 11, 1);
  lampColumn(a, k, -22, L / 4, 11, 1);
  fence(a, k, -32, -L / 2 - 4, L / 2 + 4);
}

// ---------------------------------------------------------------- builders
function warehouseLong(): Group {
  const a = new Assembler();
  hall(a, kit(), { L: 120, D: 48, H: 12, body: kit().cladGrey, doorEvery: 5, seed: 3, open: [4, 11] });
  return a.build("Estate_WarehouseLong");
}

function distributionCenter(): Group {
  const a = new Assembler();
  const k = kit();
  hall(a, k, { L: 90, D: 60, H: 14, body: k.cladLight, doorEvery: 5.5, seed: 8, open: [3] });
  // Two-storey office block on the near corner with a glazed ribbon and entrance.
  a.box(24, 8.4, 12, k.cladGrey, 12, 4.2, -51);
  a.box(24.4, 0.3, 12.4, k.cladDark, 12, 8.55, -51);
  for (let z = -56; z <= -46; z += 2.6) for (const y of [2.2, 5.6]) a.box(0.1, 1.6, 2.2, k.glass, -0.05, y, z);
  a.box(0.1, 3.0, 5, k.glassLit, -0.05, 1.6, -51);
  return a.build("Estate_Distribution");
}

function lowShed(): Group {
  const a = new Assembler();
  const k = kit();
  a.box(30, 7, 45, k.cladCream, 15, 3.5, 0);
  a.gable(0, 30, -22.5, 22.5, 7, 1.8, k.cladGrey, 0.4);
  for (const z of [-12, 0, 12]) {
    a.box(0.14, 4.8, 4.5, k.door, -0.06, 2.4, z);
    a.box(0.5, 0.2, 5.0, k.shelter, -0.25, 4.9, z);
  }
  a.box(0.26, 0.18, 45, k.galv, -0.15, 6.7, 0);
  a.box(16, 0.05, 50, k.yard, -8, 0.02, 0);
  return a.build("Estate_LowShed");
}

function truckParking(): Group {
  const a = new Assembler();
  const k = kit();
  a.box(40, 0.05, 70, k.yard, 0, 0.02, 0);
  for (let z = -24; z <= 26; z += 8) {
    a.box(18, 0.01, 0.12, k.line, 0, 0.06, z - 3.4);
    a.box(18, 0.01, 0.12, k.line, 0, 0.06, z + 3.4);
  }
  lampColumn(a, k, -14, -20, 11, 1);
  lampColumn(a, k, -14, 20, 11, 1);
  return a.build("Estate_TruckParking");
}

/** Trailers on landing legs (no tractors) and stacked containers in a fenced yard. */
function yardTrailers(): Group {
  const a = new Assembler();
  const k = kit();
  const r = rng(5);
  a.box(40, 0.05, 70, k.yard, 0, 0.02, 0);
  for (let z = -28; z < 30; z += 4.2) {
    if (r() < 0.2) continue;
    const m = k.trailer[Math.floor(r() * 3)]!;
    const x = 4 + r() * 1.2;
    a.box(13.6, 2.9, 2.55, m, x, 2.6, z);
    a.box(13.4, 0.35, 2.3, k.dark, x, 0.95, z);
    a.box(0.2, 1.2, 2.0, k.dark, x - 4.5, 0.6, z);
    for (const wx of [x + 4.2, x + 5.5]) for (const wz of [z - 1.05, z + 1.05]) a.cyl(0.52, 0.4, k.rubber, wx, 0.52, wz, 14);
  }
  for (let i = 0; i < 4; i++) a.box(12.2, 2.6, 2.44, k.container[i % 3]!, -10, 1.3 + (i > 1 ? 2.6 : 0), -40 + (i % 2) * 3.4);
  fence(a, k, -18, -45, 38);
  lampColumn(a, k, -16, -30, 12, 1);
  lampColumn(a, k, -16, 0, 12, 1);
  lampColumn(a, k, -16, 30, 12, 1);
  return a.build("Estate_YardTrailers");
}

/** Motorway service area: canopy + columns + underside lights + pumps + shop + kerbs + drainage. */
function serviceStation(): Group {
  const a = new Assembler();
  const k = kit();
  a.box(70, 0.05, 90, k.concrete, 10, 0.02, 0);
  // Canopy: thick slab, fascia band, underside light panels, six columns on bases.
  a.box(16, 0.9, 34, k.canopy, 0, 5.85, 0);
  a.box(16.1, 0.28, 34.1, k.cladDark, 0, 5.32, 0);
  a.box(16.4, 0.4, 0.3, k.cladDark, 0, 5.85, 17.1);
  for (const y of [-11, 0, 11]) for (const x of [-3.5, 3.5]) a.box(4.6, 0.04, 5.6, k.canopyLight, x, 5.36, y);
  for (const z of [-14, 0, 14]) {
    for (const x of [-5, 5]) {
      a.box(0.45, 5.2, 0.45, k.canopy, x, 2.6, z);
      a.box(0.7, 1.0, 0.7, k.yellow, x, 0.5, z);
      a.box(0.75, 0.06, 0.75, k.galv, x, 0.03, z);
    }
  }
  a.box(0.12, 0.7, 34, k.galv, -8.05, 5.3, 0); // canopy gutter
  // Pump islands: kerbed island, two pumps each with screen, hose and bollards.
  for (const z of [-11, 0, 11]) {
    a.box(1.6, 0.24, 7.5, k.concrete, 0, 0.12, z);
    for (const dz of [-2.2, 2.2]) {
      a.box(0.8, 1.9, 1.1, k.pump, 0, 1.05, z + dz);
      a.box(0.06, 0.4, 0.6, k.glassLit, -0.43, 1.45, z + dz);
      a.box(0.12, 0.6, 0.12, k.dark, -0.44, 0.75, z + dz + 0.4);
    }
    for (const dz of [-3.9, 3.9]) {
      a.cyl(0.1, 1.1, k.yellow, 0, 0.55, z + dz, 10);
    }
    a.box(0.7, 0.01, 6.9, k.dark, 2.4, 0.03, z); // drainage channel
  }
  // Shop / café: low building with a fully glazed lit front, mullions, entrance canopy, roof plant.
  a.box(14, 4.8, 30, k.cladLight, 24, 2.4, 4);
  a.box(16, 0.3, 32, k.cladDark, 23.5, 5.0, 4);
  a.box(0.4, 3.6, 26, k.glass, 17, 2.1, 4);
  a.box(0.15, 3.0, 25, k.glassLit, 17.2, 2.0, 4);
  for (let z = -8; z <= 16; z += 2.2) a.box(0.08, 3.7, 0.1, k.dark, 16.85, 2.1, z);
  a.box(0.1, 0.12, 26, k.dark, 16.85, 3.9, 4);
  a.box(5, 0.25, 10, k.canopy, 14.5, 3.4, 12);
  a.box(2, 1.0, 2.6, k.cladLight, 28, 5.6, 0);
  a.box(0.6, 0.9, 0.6, k.cabinet, 16.2, 0.45, -9); // waste bin
  a.box(0.5, 0.9, 1.0, k.cabinet, 12.5, 0.75, -18); // air/water cabinet
  // Parking hardstand markings and price pylon (blank).
  for (let z = -34; z <= -12; z += 3.6) a.box(16, 0.01, 0.12, k.line, 32, 0.06, z);
  // Price pylon tucked beside the canopy entrance (not a free-standing tower blocking the
  // road view): a modest 5 m sign, blank panel only.
  a.box(0.6, 5.0, 1.6, k.cladDark, 2, 2.5, 20);
  a.box(0.05, 2.2, 1.3, k.canopy, 1.7, 3.4, 20);
  for (const [x, z, f] of [[-10, 30, 1], [20, -40, -1], [-10, -30, 1]] as const) lampColumn(a, k, x, z, 10, f);
  // Kerbs along the island frontage.
  a.box(0.18, 0.15, 34, k.concrete, -8.6, 0.075, 0);
  return a.build("Estate_ServiceStation");
}

function lowBlock(color: "hotel" | "restaurant"): Group {
  const a = new Assembler();
  const k = kit();
  const hotel = color === "hotel";
  const L = hotel ? 60 : 32;
  const D = hotel ? 14 : 18;
  const H = hotel ? 10.5 : 4.6;
  a.box(D, H, L, k.plaster[1]!, D / 2, H / 2, 0);
  a.box(D + 0.6, 0.5, L + 0.6, k.cladDark, D / 2, H + 0.25, 0);
  const floors = hotel ? 3 : 1;
  const r = rng(hotel ? 9 : 14);
  for (let f = 0; f < floors; f++) {
    for (let z = -L / 2 + 3; z < L / 2 - 2; z += 3.1) {
      const lit = r() < 0.28;
      a.box(0.08, hotel ? 1.7 : 2.6, 1.9, lit ? k.glassLit : k.glass, -0.04, (hotel ? 1.6 : 1.8) + f * 3.3, z);
      a.box(0.3, 0.08, 2.2, k.dark, -0.15, (hotel ? 0.7 : 0.5) + f * 3.3, z);
    }
  }
  a.box(4.5, 0.35, 10, k.cladDark, -2.2, 3.4, -10);
  a.box(0.1, 3.0, 7, k.glassLit, -0.05, 1.5, -10);
  a.box(30, 0.05, 60, k.yard, -12, 0.02, 0);
  for (let z = -24; z < 24; z += 2.8) a.box(4.6, 0.01, 0.1, k.line, -13, 0.06, z);
  lampColumn(a, k, -22, -20, 9, 1);
  lampColumn(a, k, -22, 10, 9, 1);
  return a.build(hotel ? "Estate_Hotel" : "Estate_Restaurant");
}

function farmShed(): Group {
  const a = new Assembler();
  const k = kit();
  a.box(16, 6, 30, k.brick, 8, 3, 0);
  a.gable(0, 16, -15, 15, 6, 2.6, k.rust, 0.8);
  a.box(0.2, 5, 26, k.shelter, -0.1, 2.5, 0);
  for (let z = -11; z < 12; z += 2.4) for (const y of [0.6, 1.8, 3]) a.box(2.2, 1.15, 2.2, k.hay, 1.4, y, z);
  a.cyl(3, 14, k.galv, 18, 7, 20, 16);
  a.box(14, 0.05, 50, k.yard, -7, 0.02, 0);
  return a.build("Estate_FarmShed");
}

function farmhouse(): Group {
  const a = new Assembler();
  const k = kit();
  a.box(12, 9, 18, k.plaster[0]!, 6, 4.5, -10);
  a.gable(0, 12, -19, -1, 9, 2.4, k.terracotta, 0.6);
  a.box(12, 7.6, 22, k.brick, 6, 3.8, 10);
  a.gable(0, 12, -1, 21, 7.6, 2.2, k.terracotta, 0.6);
  a.box(0.2, 5, 16, k.shelter, -0.1, 2.5, 10);
  for (const z of [-15, -10, -5]) for (const y of [2.2, 6]) {
    a.box(0.12, 1.5, 1.0, k.glass, -0.06, y, z);
    a.box(0.14, 1.5, 0.35, k.cladDark, -0.07, y, z - 0.65); // shutters
    a.box(0.14, 1.5, 0.35, k.cladDark, -0.07, y, z + 0.65);
  }
  a.box(14, 0.05, 60, k.yard, -7, 0.02, 0);
  return a.build("Estate_Farmhouse");
}

export const REAL_BUILDINGS: Record<string, () => Group> = {
  warehouse_long: warehouseLong,
  distribution: distributionCenter,
  low_shed: lowShed,
  truck_parking: truckParking,
  yard_trailers: yardTrailers,
  fuel_station: serviceStation,
  hotel: () => lowBlock("hotel"),
  restaurant: () => lowBlock("restaurant"),
  farm_shed: farmShed,
  farmhouse,
};
