import {
  AdditiveBlending,
  BoxGeometry,
  Color,
  CylinderGeometry,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  DataTexture,
  LinearFilter,
  LinearMipmapLinearFilter,
  MeshLambertMaterial,
  PlaneGeometry,
  PointLight,
  RepeatWrapping,
  SRGBColorSpace,
} from "three";

import { createGlowTexture } from "./world-details";

/*
 * Real interior for a lit dock bay (replaces the flat interior plate): a
 * 22 m-deep hall seen through the opening — selective pallet racking (blue
 * uprights, orange beams, bracing), wrapped loads / cartons / timber pallets in
 * each slot (some slots empty), steel columns with yellow guards, roof trusses
 * and purlins, rows of round high-bay LED fixtures, a power-floated floor with
 * lane markings and streaked lamp reflections, and a back wall.
 *
 * Lighting is baked per instance: every part is unlit (MeshBasicMaterial) and
 * tinted by the illumination its position receives from the fixture grid
 * (inverse-square from each lamp), so depth reads as falling-off warm light,
 * never a uniformly emissive box. Deterministic (seeded).
 */

interface InteriorOptions {
  /** Facade plane (x) and bay centre (z) in world space; the hall extends +X. */
  facadeX: number;
  z: number;
  /** Dock floor height (m). */
  floorY: number;
  seed?: number;
}

const DEPTH = 22;
const CLEAR = 8.4;
const AISLE = 2.5;

function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 100000) / 100000;
  };
}

export function createBayInterior({ facadeX, z, floorY, seed = 5 }: InteriorOptions): Group {
  const random = rng(seed);
  const group = new Group();
  group.name = "Dock_Bay_Interior";

  // Fixture grid (x along the hall, dz across): two rows of round high-bays.
  const lamps: Array<[number, number]> = [];
  for (let x = 2; x < DEPTH; x += 4.5) for (const dz of [-3.2, 0, 3.2]) lamps.push([x, dz]);
  const lampY = floorY + CLEAR - 0.6;
  const light = (x: number, y: number, dz: number, boost = 1) => {
    let sum = 0;
    for (const [lx, ldz] of lamps) {
      // Tighter pool per fixture (real high-bay beam angle, not a flood): sharp hotspot,
      // dark gaps between fixture rows read as real ceiling structure, not a wash.
      const d2 = (x - lx) ** 2 + (dz - ldz) ** 2 + (y - lampY) ** 2;
      sum += 1 / (1 + d2 / 5) ** 1.9;
    }
    // Strong falloff into depth (dark far hall); the near threshold stays brightest.
    return Math.min(1.0, (0.045 + 0.85 * sum * boost) * Math.exp(-x / 15));
  };
  const warm = new Color(1.0, 0.8, 0.58);
  const tint = new Color();
  const cool = new Color(0.55, 0.7, 1.0); // exterior blue-hour spill near the bay opening
  const matrix = new Matrix4();

  const parts = new Map<string, { mesh: InstancedMesh; n: number }>();
  // Lambert (not Basic): the interior boxes must respond to real light direction so each
  // face shades differently (top lit, sides darker) — that per-face read, not just the
  // baked per-instance colour, is what stops racks/cargo looking like flat game props.
  const basic = (color: string) => new MeshLambertMaterial({ color, fog: false });
  /** Instanced part family with a fixed capacity; setPart tints by baked light. */
  const family = (name: string, geometry: BoxGeometry | CylinderGeometry, color: string, capacity: number) => {
    const mesh = new InstancedMesh(geometry, basic(color), capacity);
    mesh.name = name;
    mesh.count = 0;
    mesh.frustumCulled = false;
    group.add(mesh);
    parts.set(name, { mesh, n: 0 });
    return name;
  };
  const put = (
    name: string,
    x: number,
    y: number,
    dz: number,
    sx = 1,
    sy = 1,
    sz = 1,
    boost = 1,
    hue?: Color,
    jitter = 0,
  ) => {
    const entry = parts.get(name)!;
    if (entry.n >= entry.mesh.instanceMatrix.count) return;
    entry.mesh.setMatrixAt(entry.n, matrix.makeScale(sx, sy, sz).setPosition(facadeX + x, y, z + dz));
    const albedoJitter = jitter ? 1 - jitter * 0.5 + random() * jitter : 1;
    tint.copy(hue ?? warm).lerp(cool, Math.exp(-x / 2.2) * 0.55).multiplyScalar(light(x, y, dz, boost) * albedoJitter);
    entry.mesh.setColorAt(entry.n, tint);
    entry.n++;
  };

  // Stretch-wrap surface for the wrapped loads: vertical fold streaks, diagonal tension
  // highlights and corner bunching — cheap (one shared texture) but removes the "flat
  // painted box" read that is the single biggest tell on the racking.
  const wrapMap = (() => {
    const size = 64;
    const data = new Uint8Array(size * size * 4);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const u = x / size;
        const v = y / size;
        const fold = 0.82 + 0.22 * Math.sin(u * 26 + Math.sin(v * 5) * 2) ** 2;
        const tension = 0.9 + 0.25 * Math.max(0, Math.sin((u + v) * 9)) ** 3;
        const corner = 1 + 0.35 * Math.max(0, 1 - Math.min(u, 1 - u, v, 1 - v) * 6);
        const k = Math.min(1.5, fold * tension * corner);
        const i = (y * size + x) * 4;
        data[i] = data[i + 1] = data[i + 2] = Math.min(255, Math.round(k * 200));
        data[i + 3] = 255;
      }
    }
    const t = new DataTexture(data, size, size);
    t.wrapS = t.wrapT = RepeatWrapping;
    t.magFilter = LinearFilter;
    t.minFilter = LinearMipmapLinearFilter;
    t.generateMipmaps = true;
    t.colorSpace = SRGBColorSpace;
    t.needsUpdate = true;
    return t;
  })();

  const unit = new BoxGeometry(1, 1, 1);
  const upright = family("Upright", unit, "#1f4e9a", 120);
  const beam = family("Beam", unit, "#e25b12", 220);
  const brace = family("Brace", unit, "#8a97a8", 120);
  const wrapLoad = family("WrapLoad", unit, "#c3c8c6", 90);
  (parts.get(wrapLoad)!.mesh.material as MeshLambertMaterial).map = wrapMap;
  const carton = family("Carton", unit, "#8f6a47", 140);
  const pallet = family("Pallet", unit, "#b8946a", 120);
  const column = family("Column", unit, "#3b4048", 12);
  const guard = family("Guard", unit, "#c99a00", 12);
  const truss = family("Truss", unit, "#5d646e", 40);
  const purlin = family("Purlin", unit, "#4f565f", 60);
  const lampBody = family("LampBody", new CylinderGeometry(0.32, 0.4, 0.16, 12), "#8b9198", 40);
  const lampLens = family("LampLens", new CylinderGeometry(0.28, 0.28, 0.03, 12), "#fff2d6", 40);
  const pipe = family("SprinklerPipe", new CylinderGeometry(0.5, 0.5, 1, 8), "#b3261e", 30);
  const head = family("SprinklerHead", new CylinderGeometry(0.04, 0.06, 0.12, 6), "#c9b25a", 80);
  const duct = family("Duct", unit, "#8f959b", 6);
  const basePlate = family("BasePlate", unit, "#6b7178", 160);
  const patch = family("FloorPatch", unit, "#6d6c68", 30);
  const tyreArc = family("TyreArc", unit, "#3d3c3a", 40);
  const strap = family("Strap", unit, "#22262a", 120);
  const label = family("Label", unit, "#e8e6df", 60);
  const exitSign = family("ExitSign", unit, "#2fbf5a", 4);
  const beamEdge = family("BeamEdge", unit, "#ff9a5c", 240);
  const uprightEdge = family("UprightEdge", unit, "#7fa4de", 160);
  const wrapStreak = family("WrapStreak", unit, "#dfe8e8", 90);
  const dirt = family("PalletDirt", unit, "#2a2118", 120);
  const marking = family("Marking", unit, "#c8a212", 40);

  // Lane markings on the floor and a hall shell (floor, back wall, side walls, ceiling).
  const shell = (w: number, h: number, d: number, x: number, y: number, dz: number, color: string, boost: number) => {
    const m = new Mesh(new BoxGeometry(w, h, d), basic(color));
    m.position.set(facadeX + x, y, z + dz);
    m.frustumCulled = false;
    m.userData.baked = { x, y, dz, boost };
    group.add(m);
    return m;
  };
  const floor = shell(DEPTH, 0.1, 14, DEPTH / 2, floorY - 0.05, 0, "#8a8a86", 1);
  shell(DEPTH, 0.1, 14, DEPTH / 2, floorY + CLEAR, 0, "#25292e", 0.3);
  shell(0.2, CLEAR, 14, DEPTH, floorY + CLEAR / 2, 0, "#3b3f43", 0.6);
  for (const s of [-1, 1]) shell(DEPTH, CLEAR, 0.2, DEPTH / 2, floorY + CLEAR / 2, s * 7, "#4c5156", 0.7);
  // Floor tone falls off with the lamp grid: paint it as vertical strips of shells' colour.
  {
    const strips = 24;
    for (let i = 0; i < strips; i++) {
      const x = (i + 0.5) * (DEPTH / strips);
      const s = new Mesh(new BoxGeometry(DEPTH / strips + 0.01, 0.02, 14), basic("#ffffff"));
      s.position.set(facadeX + x, floorY + 0.005, z);
      const k = Math.min(1, 0.22 + 0.5 * (light(x, floorY, 0) + light(x, floorY, 3.2) + light(x, floorY, -3.2)) / 3);
      (s.material as MeshLambertMaterial).color.setRGB(0.55 * k * 1.0, 0.53 * k * 0.95, 0.5 * k * 0.85);
      s.frustumCulled = false;
      group.add(s);
    }
  }
  floor.visible = false;

  // Racking both sides: bays every 2.7 m, four levels, slots filled with varied loads.
  for (const side of [-1, 1]) {
    const dzFace = side * (AISLE + 0.05);
    for (let x = 2.4; x < DEPTH - 1.5; x += 2.7) {
      const rackCentre = side * (AISLE + 0.55);
      // Uprights (two frames per bay), bracing zig-zag on the outer frame.
      for (const ux of [x - 1.35, x + 1.35]) {
        for (const udz of [rackCentre - 0.5, rackCentre + 0.5]) {
          put(upright, ux, floorY + 3, udz, 0.09, 6.0, 0.09);
          put(uprightEdge, ux + 0.03, floorY + 3, udz - side * 0.03, 0.012, 6.0, 0.02, 1.4);
        }
        put(brace, ux, floorY + 3, rackCentre + side * 0.5, 0.03, 6.2, 0.03);
        for (const udz of [rackCentre - 0.5, rackCentre + 0.5]) put(basePlate, ux, floorY + 0.02, udz, 0.22, 0.04, 0.22);
      }
      const levels = [0.18, 1.85, 3.5, 5.15];
      for (const ly of levels) {
        for (const bdz of [rackCentre - 0.5, rackCentre + 0.5]) {
          put(beam, x, floorY + ly, bdz, 2.7, 0.14, 0.07);
          put(beamEdge, x, floorY + ly + 0.066, bdz - side * 0.02, 2.7, 0.012, 0.03, 1.5); // catches the light on its top edge
        }
        // Two pallet slots per level.
        for (const px of [x - 0.68, x + 0.68]) {
          const r = random();
          if (r < 0.14) continue; // empty slot
          put(pallet, px, floorY + ly + 0.09, rackCentre, 1.15, 0.13, 0.85, undefined, undefined, 0.35);
          put(dirt, px, floorY + ly + 0.03, rackCentre - side * 0.43, 1.15, 0.05, 0.02, 0.6);
          if (r < 0.62) {
            const h = 0.9 + random() * 0.55;
            put(wrapLoad, px, floorY + ly + 0.16 + h / 2, rackCentre, 1.08, h, 0.78, 1.05, undefined, 0.22);
            put(wrapStreak, px - 0.25 + random() * 0.5, floorY + ly + 0.16 + h / 2, rackCentre - side * 0.392, 0.03, h * 0.9, 0.01, 1.3);
            if (random() > 0.5) put(strap, px, floorY + ly + 0.16 + h * 0.5, rackCentre - side * 0.4, 1.09, 0.02, 0.02);
            put(label, px + (random() - 0.5) * 0.4, floorY + ly + 0.16 + h * 0.6, rackCentre - side * 0.395, 0.16, 0.1, 0.01);
          } else {
            const layers = 2 + Math.floor(random() * 2);
            for (let l = 0; l < layers; l++) {
              for (const cx of [-0.28, 0.28]) {
                put(carton, px + cx + (random() - 0.5) * 0.04, floorY + ly + 0.2 + l * 0.42, rackCentre + (random() - 0.5) * 0.05, 0.52 + random() * 0.05, 0.4, 0.74, undefined, undefined, 0.4);
              }
            }
          }
        }
      }
    }
    // Floor lane marking along each rack face.
    put(marking, DEPTH / 2, floorY + 0.012, dzFace + side * -0.25, DEPTH, 0.01, 0.1);
  }

  // Columns with yellow guards at the aisle ends of every fourth bay.
  for (let x = 6.5; x < DEPTH - 1; x += 10.8) {
    for (const s of [-1, 1]) {
      put(column, x, floorY + CLEAR / 2, s * (AISLE + 1.55), 0.4, CLEAR, 0.4);
      put(guard, x, floorY + 0.6, s * (AISLE + 1.55), 0.46, 1.2, 0.46);
    }
  }
  // Roof: trusses across the hall every 4.5 m, purlins along it, high-bay fixtures.
  for (let x = 2; x < DEPTH; x += 4.5) {
    put(truss, x, floorY + CLEAR - 0.3, 0, 0.18, 0.5, 13.6, 0.55);
    put(truss, x, floorY + CLEAR - 0.9, 0, 0.1, 0.1, 13.6, 0.5);
  }
  for (const dz of [-5.6, -2.8, 0, 2.8, 5.6]) put(purlin, DEPTH / 2, floorY + CLEAR - 0.05, dz, DEPTH, 0.12, 0.1, 0.45);
  // Fire sprinkler mains along the hall with heads every 3 m; one ventilation duct run.
  for (const dz of [-1.6, 1.6]) {
    const entry = parts.get(pipe)!;
    entry.mesh.setMatrixAt(entry.n, matrix.makeRotationZ(Math.PI / 2).scale({ x: 0.09, y: DEPTH, z: 0.09 } as never).setPosition(facadeX + DEPTH / 2, floorY + CLEAR - 0.7, z + dz));
    entry.mesh.setColorAt(entry.n, tint.copy(warm).multiplyScalar(0.55));
    entry.n++;
    for (let x = 1.5; x < DEPTH; x += 3) put(head, x, floorY + CLEAR - 0.8, dz, 1, 1, 1, 0.4);
  }
  put(duct, DEPTH / 2, floorY + CLEAR - 0.35, 4.6, DEPTH, 0.6, 0.9, 0.5);
  // Exit sign over the back wall, floor wear: patched slabs, forklift tyre arcs, worn lane.
  put(exitSign, DEPTH - 0.2, floorY + 3.4, 0, 0.02, 0.28, 0.6, 1.4, new Color(0.3, 1, 0.5));
  for (const [px, pdz, w, d] of [[5, 0.6, 1.6, 2.2], [11.5, -1.1, 2.4, 1.4], [16, 1.2, 1.2, 1.8]] as const) put(patch, px, floorY + 0.014, pdz, w, 0.004, d, 0.9);
  for (let x = 1.5; x < DEPTH - 1; x += 2.2) for (const dz of [-0.5, 0.5]) put(tyreArc, x + random() * 0.5, floorY + 0.016, dz + (random() - 0.5) * 0.2, 1.4 + random(), 0.004, 0.14, 0.8);
  for (const [x, dz] of lamps) {
    put(lampBody, x, lampY + 0.12, dz, 1, 1, 1, 0.4);
    const entry = parts.get(lampLens)!;
    entry.mesh.setMatrixAt(entry.n, matrix.makeScale(1, 1, 1).setPosition(facadeX + x, lampY, z + dz));
    entry.mesh.setColorAt(entry.n, tint.setRGB(2.2, 1.9, 1.5)); // fixture lens: HDR-bright
    entry.n++;
  }
  for (const { mesh, n } of parts.values()) {
    mesh.count = n;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }

  // Soft light bloom around each fixture and reflected streaks on the polished floor.
  const glow = new MeshBasicMaterial({
    map: createGlowTexture(),
    color: new Color(1.0, 0.82, 0.6).multiplyScalar(0.5),
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    fog: false,
  });
  const faceOut = new Matrix4().makeRotationY(-Math.PI / 2);
  const flare = new InstancedMesh(new PlaneGeometry(1, 1), glow, lamps.length);
  const streak = new InstancedMesh(new PlaneGeometry(1, 1).rotateX(-Math.PI / 2), glow, lamps.length);
  flare.frustumCulled = streak.frustumCulled = false;
  lamps.forEach(([x, dz], i) => {
    flare.setMatrixAt(i, matrix.makeScale(1.9, 1.9, 1).premultiply(faceOut).setPosition(facadeX + x - 0.05, lampY - 0.1, z + dz));
    streak.setMatrixAt(i, matrix.makeScale(0.9, 1, 3.4).setPosition(facadeX + x, floorY + 0.02, z + dz));
  });
  flare.name = "Interior_Lamp_Glow";
  streak.name = "Interior_Floor_Streaks";
  group.add(flare, streak);
  // One small unshadowed point light per bay (budget-conscious: real-time lights stay
  // scarce), positioned at the nearest fixture row — enough for Lambert faces to shade by
  // direction (top lit, sides darker) instead of the flat unlit read a Basic material gives.
  const interiorLight = new PointLight("#ffcf9c", 7, 11, 2);
  interiorLight.position.set(facadeX + 5, lampY - 0.4, z);
  group.add(interiorLight);
  return group;
}
