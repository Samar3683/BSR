import {
  AdditiveBlending,
  BoxGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  TorusGeometry,
} from "three";

import { createGlowTexture } from "./world-details";

/*
 * Generic 2.5 t counterbalance forklift (no brand), forward = +Z, origin on the
 * floor under the rear axle line. Built from real components rather than a
 * block: rounded counterweight with warning label, engine hood, seat and
 * steering column, four-post overhead guard with roof bars, front drive axle
 * with solid super-elastic tyres (tread rings, hub, bolts), rear steering
 * wheels, a two-stage mast (outer/inner channels, chains, hydraulic cylinders,
 * hoses), carriage with load backrest, L-section forks, work light, amber
 * beacon and the blue floor safety spot. Chipped paint is a darker edge
 * strip on the lower body. `carriage` (forks + load) moves for lift.
 */
export interface Forklift {
  group: Group;
  carriage: Group;
  /** Wheels that roll with travel (front axle, rear axle). */
  wheels: Mesh[];
  /** Rear steering pivots (yaw): rear-wheel steering, like a real counterbalance truck. */
  rearSteer: Group[];
  beaconMaterial: MeshStandardMaterial;
}

export function createForklift(): Forklift {
  const group = new Group();
  group.name = "Dock_Forklift";
  const yellow = new MeshStandardMaterial({ color: "#e0a10c", roughness: 0.42, metalness: 0.25 });
  const chipped = new MeshStandardMaterial({ color: "#5a4a1c", roughness: 0.7, metalness: 0.4 });
  const black = new MeshStandardMaterial({ color: "#141516", roughness: 0.6 });
  const steel = new MeshStandardMaterial({ color: "#9a9ea1", roughness: 0.32, metalness: 0.85 });
  const rubber = new MeshStandardMaterial({ color: "#161617", roughness: 0.92 });
  const dust = new MeshStandardMaterial({ color: "#3a3a3b", roughness: 1 });
  const seat = new MeshStandardMaterial({ color: "#26282a", roughness: 0.85 });
  const label = new MeshStandardMaterial({ color: "#d9d4c0", roughness: 0.6 });
  const hose = new MeshStandardMaterial({ color: "#0d0d0e", roughness: 0.5 });
  const beaconMaterial = new MeshStandardMaterial({ color: "#3a2400", emissive: "#ffb020", emissiveIntensity: 3 });
  const lampMaterial = new MeshStandardMaterial({ color: "#222", emissive: "#fff1d8", emissiveIntensity: 2.5 });

  const add = (parent: Group, geometry: BoxGeometry | CylinderGeometry | TorusGeometry, material: MeshStandardMaterial, x: number, y: number, z: number) => {
    const mesh = new Mesh(geometry, material);
    mesh.position.set(x, y, z);
    mesh.castShadow = mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  };
  const box = (w: number, h: number, d: number) => new BoxGeometry(w, h, d);

  // Chassis and counterweight (rounded rear built from a box + two half-cylinders).
  add(group, box(1.02, 0.55, 1.75), yellow, 0, 0.62, -0.5);
  add(group, box(1.06, 0.12, 1.79), chipped, 0, 0.36, -0.5); // scuffed lower edge
  const cwCore = add(group, box(1.02, 0.78, 0.55), yellow, 0, 0.78, -1.32);
  cwCore.name = "Forklift_Counterweight";
  for (const s of [-1, 1]) {
    const round = add(group, new CylinderGeometry(0.39, 0.39, 0.55, 14, 1, false, 0, Math.PI), yellow, s * 0.51, 0.78, -1.32);
    round.rotation.set(0, s > 0 ? -Math.PI / 2 : Math.PI / 2, Math.PI / 2);
    round.scale.set(1, 1, 0.5);
  }
  add(group, box(0.5, 0.16, 0.02), label, 0, 0.98, -1.61); // warning label
  add(group, box(0.7, 0.36, 0.02), black, 0, 0.55, -1.61); // exhaust grille / tow pin plate
  // Hood + seat + column.
  add(group, box(0.86, 0.22, 0.85), yellow, 0, 1.0, -0.7);
  add(group, box(0.46, 0.09, 0.44), seat, 0, 1.16, -0.7);
  add(group, box(0.44, 0.44, 0.09), seat, 0, 1.4, -0.95);
  add(group, box(0.09, 0.5, 0.09), black, 0, 1.05, 0.02).rotation.x = -0.6;
  add(group, new TorusGeometry(0.15, 0.018, 8, 18), black, 0, 1.28, 0.16).rotation.x = Math.PI / 2 - 0.6;
  // Overhead guard: four posts and roof bars.
  for (const x of [-0.46, 0.46]) {
    add(group, box(0.06, 1.05, 0.06), black, x, 1.72, 0.25);
    add(group, box(0.06, 1.05, 0.06), black, x, 1.72, -1.05);
  }
  for (let z = -1.05; z <= 0.26; z += 0.22) add(group, box(1.0, 0.04, 0.05), black, 0, 2.25, z);
  for (const x of [-0.46, 0.46]) add(group, box(0.05, 0.05, 1.36), black, x, 2.25, -0.4);
  // Beacon + work light + headlights.
  add(group, new CylinderGeometry(0.075, 0.09, 0.13, 12), beaconMaterial, 0.4, 2.34, -1.0);
  add(group, box(0.16, 0.1, 0.06), lampMaterial, 0.3, 1.5, 0.3);
  add(group, box(0.14, 0.1, 0.06), lampMaterial, -0.3, 1.5, 0.3);

  // Wheels: solid tyres with tread ring, hub and bolts (front pair large, rear pair small).
  const wheels: Mesh[] = [];
  const rearSteer: Group[] = [];
  const wheel = (x: number, z: number, r: number, w: number, steer = false) => {
    const g = new Group();
    const pivot = new Group();
    pivot.position.set(x, r, z);
    pivot.add(g);
    if (steer) rearSteer.push(pivot);
    const tyre = add(g, new CylinderGeometry(r, r, w, 22), rubber, 0, 0, 0);
    tyre.rotation.z = Math.PI / 2;
    for (const off of [-1, 1]) {
      const groove = add(g, new CylinderGeometry(r * 1.005, r * 1.005, 0.018, 22), dust, off * w * 0.22, 0, 0);
      groove.rotation.z = Math.PI / 2;
    }
    const hub = add(g, new CylinderGeometry(r * 0.52, r * 0.52, w + 0.02, 14), steel, 0, 0, 0);
    hub.rotation.z = Math.PI / 2;
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const bolt = add(g, new CylinderGeometry(0.018, 0.018, 0.02, 6), black, (x > 0 ? 1 : -1) * (w / 2 + 0.02), Math.sin(a) * r * 0.34, Math.cos(a) * r * 0.34);
      bolt.rotation.z = Math.PI / 2;
    }
    group.add(pivot);
    wheels.push(g as unknown as Mesh);
  };
  wheel(-0.5, 0.05, 0.32, 0.26);
  wheel(0.5, 0.05, 0.32, 0.26);
  wheel(-0.42, -1.1, 0.25, 0.2, true);
  wheel(0.42, -1.1, 0.25, 0.2, true);

  // Mast: outer channels, inner channels, cross members, chains, cylinders and hoses.
  const mast = new Group();
  mast.position.set(0, 0, 0.62);
  group.add(mast);
  for (const x of [-0.31, 0.31]) {
    add(mast, box(0.09, 2.1, 0.11), steel, x, 1.05, 0);
    add(mast, box(0.07, 1.9, 0.09), black, x * 0.86, 1.05, 0.08);
  }
  for (const y of [0.25, 1.15, 2.05]) add(mast, box(0.72, 0.07, 0.1), steel, 0, y, 0.02);
  for (const x of [-0.1, 0.1]) add(mast, new CylinderGeometry(0.012, 0.012, 1.8, 6), black, x, 1.15, 0.13); // chains
  for (const x of [-0.18, 0.18]) add(mast, new CylinderGeometry(0.03, 0.03, 1.2, 10), steel, x, 0.9, -0.09);
  add(mast, new TorusGeometry(0.12, 0.012, 6, 14, Math.PI), hose, 0.36, 1.3, -0.02).rotation.z = -Math.PI / 2;
  add(mast, new TorusGeometry(0.1, 0.012, 6, 14, Math.PI), hose, -0.36, 1.1, -0.02).rotation.z = Math.PI / 2;

  // Carriage: backrest, plate, L-section forks (blade + heel), and a wrapped load.
  const carriage = new Group();
  carriage.name = "Dock_Forklift_Carriage";
  carriage.position.set(0, 0.32, 0.74);
  group.add(carriage);
  add(carriage, box(0.82, 0.18, 0.06), steel, 0, 0.12, 0);
  add(carriage, box(0.82, 0.9, 0.03), black, 0, 0.55, -0.05).scale.set(1, 1, 1);
  for (let y = 0.2; y < 0.95; y += 0.14) add(carriage, box(0.82, 0.02, 0.05), black, 0, y, -0.04); // backrest bars
  for (const x of [-0.27, 0.27]) {
    add(carriage, box(0.1, 0.05, 1.12), steel, x, 0.0, 0.58); // blade
    add(carriage, box(0.1, 0.5, 0.05), steel, x, 0.24, 0.04); // heel
  }
  const pallet = new MeshStandardMaterial({ color: "#b5926a", roughness: 0.85 });
  const carton = new MeshStandardMaterial({ color: "#a9805b", roughness: 0.8 });
  const wrap = new MeshStandardMaterial({ color: "#dfe4e6", roughness: 0.18, transparent: true, opacity: 0.42 });
  add(carriage, box(1.0, 0.13, 1.0), pallet, 0, 0.09, 0.62);
  for (const [x, z] of [[-0.25, 0.4], [0.25, 0.4], [-0.25, 0.85], [0.25, 0.85]] as const) add(carriage, box(0.46, 0.44, 0.4), carton, x, 0.37, z * 0.98 + 0.03);
  for (const [x, z] of [[-0.25, 0.4], [0.25, 0.4], [-0.25, 0.85], [0.25, 0.85]] as const) add(carriage, box(0.46, 0.44, 0.4), carton, x + 0.005, 0.81, z * 0.98 + 0.03);
  add(carriage, box(0.98, 1.0, 0.94), wrap, 0, 0.6, 0.62).renderOrder = 2;

  // Blue safety spot on the floor ahead (a strong Italian-warehouse cue) and a hazard beam.
  const spot = new Mesh(
    new PlaneGeometry(1.2, 1.2).rotateX(-Math.PI / 2),
    new MeshBasicMaterial({ map: createGlowTexture(), color: "#2f6bff", transparent: true, depthWrite: false, blending: AdditiveBlending, fog: false }),
  );
  spot.position.set(0, 0.015, 2.4);
  spot.scale.set(1, 1, 1.5);
  group.add(spot);
  return { group, carriage, wheels, rearSteer, beaconMaterial };
}
