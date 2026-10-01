import {
  BoxGeometry,
  type BufferGeometry,
  CylinderGeometry,
  EdgesGeometry,
  Group,
  LineBasicMaterial,
  LineSegments,
  type Material,
  Mesh,
  MeshStandardMaterial,
  Object3D,
} from "three";

import { SCENE_COLORS } from "@/lib/three/brand-colors";

import { LIGHT_MATERIAL_NAMES, LIVERY_MATERIAL_NAME, MATERIAL_SLOTS } from "./truck-contract";

/*
 * ⚠ DEVELOPMENT-ONLY PLACEHOLDER — NOT PRODUCTION ART.
 *
 * Crude blocks at real-world scale that implement the model contract
 * (node names, pivots, origins, materials) so camera, departure, wheels,
 * steering, trailer yaw, suspension and wipe coverage can be engineered
 * before the production truck exists. Magenta edge lines mark it as
 * placeholder geometry; it is never a stand-in for final visuals.
 */

const DEV_EDGE_COLOR = "#ff2bd6";

interface PlaceholderMaterials {
  body: MeshStandardMaterial;
  curtain: MeshStandardMaterial;
  reflective: MeshStandardMaterial;
  dark: MeshStandardMaterial;
  glass: MeshStandardMaterial;
  rubber: MeshStandardMaterial;
  plastic: MeshStandardMaterial;
  steel: MeshStandardMaterial;
  livery: MeshStandardMaterial;
  edges: LineBasicMaterial;
  lights: Record<keyof typeof LIGHT_MATERIAL_NAMES, MeshStandardMaterial>;
}

function createMaterials(): PlaceholderMaterials {
  const named = (name: string, params: ConstructorParameters<typeof MeshStandardMaterial>[0]) => {
    const material = new MeshStandardMaterial(params);
    material.name = name;
    return material;
  };
  const light = (name: string, color: string) =>
    named(name, { color: "#1b1d1c", emissive: color, emissiveIntensity: 0, roughness: 0.4 });

  return {
    // Soft white at the production value, so exposure can be judged against the styleframes.
    body: named(MATERIAL_SLOTS.paintBody, { color: "#e9e9e4", roughness: 0.4 }),
    curtain: named(MATERIAL_SLOTS.curtain, { color: "#e4e4df", roughness: 0.75 }),
    reflective: named(MATERIAL_SLOTS.reflective, { color: "#d9dad5", roughness: 0.3 }),
    dark: named(MATERIAL_SLOTS.paintGraphite, { color: "#2c302e", roughness: 0.7 }),
    glass: named(MATERIAL_SLOTS.glass, { color: "#1a2229", roughness: 0.15, metalness: 0.2 }),
    rubber: named(MATERIAL_SLOTS.rubber, { color: "#141515", roughness: 0.9 }),
    // Indicative only (lighting response): black grille plastic and polished steel.
    plastic: named(MATERIAL_SLOTS.plasticGrille, { color: "#0e0f10", roughness: 0.55 }),
    steel: named(MATERIAL_SLOTS.metalSteel, { color: "#c4c7c6", roughness: 0.28, metalness: 1 }),
    livery: named(LIVERY_MATERIAL_NAME, { color: DEV_EDGE_COLOR, roughness: 0.6 }),
    edges: new LineBasicMaterial({ color: DEV_EDGE_COLOR }),
    lights: {
      head: light(LIGHT_MATERIAL_NAMES.head, "#ffffff"),
      marker: light(LIGHT_MATERIAL_NAMES.marker, "#ffd9a0"),
      tail: light(LIGHT_MATERIAL_NAMES.tail, SCENE_COLORS.red500),
      brake: light(LIGHT_MATERIAL_NAMES.brake, SCENE_COLORS.red500),
      reverse: light(LIGHT_MATERIAL_NAMES.reverse, "#ffffff"),
    },
  };
}

function box(
  name: string,
  size: [number, number, number],
  position: [number, number, number],
  material: Material,
  edges?: LineBasicMaterial,
): Mesh {
  const mesh = new Mesh(new BoxGeometry(...size), material);
  mesh.name = name;
  mesh.position.set(...position);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  if (edges) addEdges(mesh, mesh.geometry, edges);
  return mesh;
}

function addEdges(target: Object3D, geometry: BufferGeometry, material: LineBasicMaterial): void {
  const lines = new LineSegments(new EdgesGeometry(geometry), material);
  lines.name = `${target.name}_DevEdges`;
  target.add(lines);
}

function wheel(
  name: string,
  position: [number, number, number],
  radius: number,
  width: number,
  materials: PlaceholderMaterials,
): Object3D {
  const spin = new Object3D();
  spin.name = `${name}_Spin`;
  spin.position.set(...position);
  const tyre = new Mesh(new CylinderGeometry(radius, radius, width, 20), materials.rubber);
  tyre.name = `${name}_Tyre`;
  tyre.rotation.z = Math.PI / 2; // cylinder axis → local X (spin axis)
  tyre.castShadow = true;
  // A dark spoke plate makes rotation visible on the placeholder.
  const spoke = new Mesh(new BoxGeometry(width * 1.02, radius * 1.6, 0.12), materials.dark);
  spoke.name = `${name}_Spoke`;
  spin.add(tyre, spoke);
  return spin;
}

function lightNode(
  name: string,
  position: [number, number, number],
  size: [number, number, number],
  material: MeshStandardMaterial,
): Mesh {
  const mesh = new Mesh(new BoxGeometry(...size), material);
  mesh.name = name;
  mesh.position.set(...position);
  return mesh;
}

/** Contract-compliant development tractor (≈ 6 m, cab-over). */
export function createPlaceholderTractor(): Group {
  const m = createMaterials();
  const tractor = new Group();
  tractor.name = "Tractor";

  const body = new Group();
  body.name = "Tractor_Body";
  body.add(
    box("Cab", [2.45, 2.85, 2.3], [0, 2.55, 3.75], m.body, m.edges),
    box("Cab_Lower", [2.5, 0.6, 0.45], [0, 0.78, 4.72], m.dark, m.edges),
    box("Chassis", [1.0, 0.3, 6.0], [0, 0.9, 1.75], m.dark),
    box("Fifth_Wheel_Plate", [1.4, 0.12, 1.2], [0, 1.09, 0.35], m.dark),
    box("Windscreen", [2.2, 1.1, 0.03], [0, 3.1, 4.91], m.glass),
    box("Grille", [1.5, 1.0, 0.04], [0, 1.75, 4.92], m.plastic),
    box("Fuel_Tank_R", [0.62, 0.62, 1.3], [-0.95, 0.85, 1.6], m.steel),
    lightNode("Lights_Head_L", [0.95, 0.95, 4.96], [0.4, 0.16, 0.05], m.lights.head),
    lightNode("Lights_Head_R", [-0.95, 0.95, 4.96], [0.4, 0.16, 0.05], m.lights.head),
    lightNode("Lights_Marker_1", [1.1, 3.98, 4.8], [0.12, 0.06, 0.06], m.lights.marker),
    lightNode("Lights_Marker_2", [-1.1, 3.98, 4.8], [0.12, 0.06, 0.06], m.lights.marker),
    lightNode("Lights_Marker_3", [1.24, 1.3, 2.9], [0.03, 0.08, 0.14], m.lights.marker),
    lightNode("Lights_Marker_4", [-1.24, 1.3, 2.9], [0.03, 0.08, 0.14], m.lights.marker),
    lightNode("Lights_Tail_L", [1.0, 0.95, -1.27], [0.25, 0.12, 0.04], m.lights.tail),
    lightNode("Lights_Tail_R", [-1.0, 0.95, -1.27], [0.25, 0.12, 0.04], m.lights.tail),
    lightNode("Lights_Brake_L", [1.0, 0.8, -1.27], [0.25, 0.08, 0.04], m.lights.brake),
    lightNode("Lights_Brake_R", [-1.0, 0.8, -1.27], [0.25, 0.08, 0.04], m.lights.brake),
  );
  for (const [side, x] of [
    ["L", 1.235],
    ["R", -1.235],
  ] as const) {
    const cabMark = box(`Livery_CabMark_${side}`, [0.02, 0.35, 0.9], [x, 2.7, 3.9], m.livery);
    cabMark.castShadow = false;
    body.add(cabMark);
  }

  const hitch = new Object3D();
  hitch.name = "Hitch_FifthWheel";
  hitch.position.set(0, 1.15, 0.35);
  body.add(hitch);
  tractor.add(body);

  for (const [name, x] of [
    ["Wheel_FL", 1.05],
    ["Wheel_FR", -1.05],
  ] as const) {
    const steer = new Object3D();
    steer.name = name;
    steer.position.set(x, 0.52, 3.6);
    steer.add(wheel(name, [0, 0, 0], 0.52, 0.35, m));
    tractor.add(steer);
  }
  tractor.add(wheel("Wheel_RL", [1.0, 0.52, 0], 0.52, 0.6, m));
  tractor.add(wheel("Wheel_RR", [-1.0, 0.52, 0], 0.52, 0.6, m));
  return tractor;
}

/** Contract-compliant development trailer (13.6 m, closed body). */
export function createPlaceholderTrailer(): Group {
  const m = createMaterials();
  const trailer = new Group();
  trailer.name = "Trailer";
  const root = new Group();
  root.name = "Trailer_Root"; // origin = kingpin
  trailer.add(root);

  // Body spans 1.6 m ahead of the kingpin to 12 m behind it; floor ≈ 1.2 m above ground.
  const body = box("Trailer_Body", [2.55, 2.8, 13.6], [0, 1.45, -5.2], m.curtain, m.edges);
  root.add(body);

  // Livery on both flanks: the dock shots see the right side, the road shots the left.
  const wordmark = new Group();
  wordmark.name = "Livery_Wordmark";
  const accent = new Group();
  accent.name = "Livery_Accent";
  for (const [side, x] of [
    ["L", 1.285],
    ["R", -1.285],
  ] as const) {
    const mark = box(`Livery_Wordmark_${side}`, [0.02, 1.1, 5.5], [x, 0.2, -1.2], m.livery);
    const line = box(`Livery_Accent_${side}`, [0.02, 0.08, 7], [x, -0.7, -1.2], m.livery);
    mark.castShadow = line.castShadow = false;
    wordmark.add(mark);
    accent.add(line);
  }
  body.add(wordmark, accent);

  root.add(
    box("Trailer_Chassis", [1.0, 0.25, 12.8], [0, -0.15, -5.6], m.dark),
    box("Landing_Legs", [2.0, 0.9, 0.3], [0, -0.6, -1.8], m.dark),
    lightNode("Lights_Tail_L", [1.05, -0.35, -12.02], [0.3, 0.14, 0.04], m.lights.tail),
    lightNode("Lights_Tail_R", [-1.05, -0.35, -12.02], [0.3, 0.14, 0.04], m.lights.tail),
    lightNode("Lights_Brake_L", [1.05, -0.52, -12.02], [0.3, 0.1, 0.04], m.lights.brake),
    lightNode("Lights_Brake_R", [-1.05, -0.52, -12.02], [0.3, 0.1, 0.04], m.lights.brake),
    lightNode("Lights_Marker_5", [1.28, 0.1, -4], [0.03, 0.08, 0.14], m.lights.marker),
    lightNode("Lights_Marker_6", [-1.28, 0.1, -4], [0.03, 0.08, 0.14], m.lights.marker),
  );

  // Contour marking (retro-reflective, as EU trailers carry): rear frame and lower flanks.
  root.add(
    box("Reflective_Rear", [2.5, 0.05, 0.02], [0, 0.02, -12.03], m.reflective),
    box("Reflective_Side_L", [0.02, 0.05, 12.8], [1.29, -0.02, -5.6], m.reflective),
    box("Reflective_Side_R", [0.02, 0.05, 12.8], [-1.29, -0.02, -5.6], m.reflective),
  );

  const axles = [-8.4, -9.7, -11.0];
  axles.forEach((z, index) => {
    root.add(wheel(`Trailer_Wheel_${index + 1}L`, [1.05, -0.7, z], 0.45, 0.4, m));
    root.add(wheel(`Trailer_Wheel_${index + 1}R`, [-1.05, -0.7, z], 0.45, 0.4, m));
  });
  return trailer;
}
