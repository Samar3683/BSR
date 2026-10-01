import {
  AdditiveBlending,
  Box3,
  Group,
  type Material,
  type Mesh,
  type MeshStandardMaterial,
  Object3D,
  SpotLight,
  Sprite,
  SpriteMaterial,
  Vector3,
} from "three";

import {
  LIGHT_MATERIAL_NAMES,
  missingMaterials,
  SPIN_SUFFIX,
  TRACTOR_REQUIRED_MATERIALS,
  TRACTOR_REQUIRED_NODES,
  TRAILER_REQUIRED_MATERIALS,
  TRAILER_REQUIRED_NODES,
} from "./truck-contract-spec";
import { createGlowTexture } from "./world-details";

/*
 * Runtime binding of the production model contract. Names and conventions
 * live in truck-contract-spec.ts (shared with the offline validator). Any
 * tractor/trailer asset — the development placeholder today, a generic or
 * licensed production model later — is bound through these names only.
 */

export {
  LIGHT_MATERIAL_NAMES,
  LIVERY_MATERIAL_NAME,
  MATERIAL_SLOTS,
  SPIN_SUFFIX,
  TRACTOR_REQUIRED_NODES,
  TRAILER_REQUIRED_NODES,
} from "./truck-contract-spec";

export function missingNodes(root: Object3D, required: readonly string[]): string[] {
  return required.filter((name) => !root.getObjectByName(name));
}

/** Names of every material used by meshes under `root`. */
export function materialNames(root: Object3D): Set<string> {
  const names = new Set<string>();
  root.traverse((object) => {
    const material = (object as Mesh).material;
    const materials = Array.isArray(material) ? material : material ? [material] : [];
    for (const m of materials) if (m.name) names.add(m.name);
  });
  return names;
}

/** Every contract violation of a tractor/trailer pair (empty = compliant). */
export function contractViolations(tractor: Object3D, trailer: Object3D): string[] {
  return [
    ...missingNodes(tractor, TRACTOR_REQUIRED_NODES).map((name) => `node ${name}`),
    ...missingNodes(trailer, TRAILER_REQUIRED_NODES).map((name) => `node ${name}`),
    ...missingMaterials(materialNames(tractor), TRACTOR_REQUIRED_MATERIALS).map(
      (name) => `tractor material ${name}`,
    ),
    ...missingMaterials(materialNames(trailer), TRAILER_REQUIRED_MATERIALS).map(
      (name) => `trailer material ${name}`,
    ),
  ];
}

export interface WheelBinding {
  node: Object3D;
  radius: number;
}

export interface TruckRigBinding {
  root: Group;
  tractor: Object3D;
  tractorBody: Object3D;
  steerNodes: Object3D[];
  wheels: WheelBinding[];
  trailerRoot: Object3D;
  trailerBody: Object3D;
  /** Trailer body bounds in Trailer_Body local space (coverage OBB). */
  trailerBodyBox: Box3;
  lightMaterials: Record<keyof typeof LIGHT_MATERIAL_NAMES, MeshStandardMaterial[]>;
  headlights: SpotLight[];
  /** Soft lamp glow at each headlamp (the lens emitters alone read too small at hero distance). */
  headlightGlow: SpriteMaterial;
}

export class TruckContractError extends Error {}

/**
 * Assembles tractor + trailer into one rig: attaches the trailer at the
 * fifth wheel and resolves every contract node. Throws if the contract is
 * not met (the realtime path then falls back quietly to stills).
 */
export function assembleTruckRig(
  tractor: Object3D,
  trailer: Object3D,
  options: { headlightBeams?: 1 | 2 } = {},
): TruckRigBinding {
  const missing = contractViolations(tractor, trailer);
  if (missing.length > 0) {
    throw new TruckContractError(`Truck model contract not met; missing: ${missing.join(", ")}`);
  }

  const root = new Group();
  root.name = "TruckRoot";
  root.add(tractor);
  const hitch = tractor.getObjectByName("Hitch_FifthWheel")!;
  hitch.add(trailer);
  root.updateMatrixWorld(true);

  const wheels: WheelBinding[] = [];
  root.traverse((object) => {
    if (object.name.endsWith(SPIN_SUFFIX)) {
      const size = new Box3().setFromObject(object).getSize(new Vector3());
      wheels.push({ node: object, radius: Math.max(0.05, size.y / 2) });
    }
  });

  const lightMaterials: TruckRigBinding["lightMaterials"] = {
    head: [],
    marker: [],
    tail: [],
    brake: [],
    reverse: [],
  };
  const byName = new Map<string, keyof typeof LIGHT_MATERIAL_NAMES>(
    Object.entries(LIGHT_MATERIAL_NAMES).map(([key, name]) => [
      name,
      key as keyof typeof LIGHT_MATERIAL_NAMES,
    ]),
  );
  const seen = new Set<Material>();
  root.traverse((object) => {
    const material = (object as Mesh).material;
    const materials = Array.isArray(material) ? material : material ? [material] : [];
    for (const m of materials) {
      const key = byName.get(m.name);
      if (key && !seen.has(m)) {
        seen.add(m);
        lightMaterials[key].push(m as MeshStandardMaterial);
      }
    }
  });

  // Headlight beams are runtime lights (never baked into the asset). Tiers with
  // a two-light budget use one centred beam between the headlamps.
  const beamNodes =
    (options.headlightBeams ?? 2) === 2
      ? ["Lights_Head_L", "Lights_Head_R"]
      : [centreBeamNode(tractor)];
  const headlights = beamNodes.map((name) => {
    const node = tractor.getObjectByName(name)!;
    const light = new SpotLight("#fff3e0", 0, 60, Math.PI / 7, 0.5, 1.4);
    light.name = `${name}_Beam`;
    light.target.position.set(0, -0.6, 12);
    light.add(light.target);
    node.add(light);
    return light;
  });

  // A restrained glow card just ahead of each headlamp: "lights on" at hero
  // distance without a flare. Depth-tested, so the cab hides it from behind.
  const headlightGlow = new SpriteMaterial({
    map: createGlowTexture(),
    color: "#fff1dc",
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: AdditiveBlending,
    fog: false,
  });
  for (const name of ["Lights_Head_L", "Lights_Head_R"]) {
    const glow = new Sprite(headlightGlow);
    glow.name = `${name}_Glow`;
    glow.scale.setScalar(0.85);
    glow.position.set(0, 0, 0.15);
    tractor.getObjectByName(name)!.add(glow);
  }

  const trailerBody = trailer.getObjectByName("Trailer_Body")!;
  return {
    root,
    tractor,
    tractorBody: tractor.getObjectByName("Tractor_Body")!,
    steerNodes: ["Wheel_FL", "Wheel_FR"].map((name) => tractor.getObjectByName(name)!),
    wheels,
    trailerRoot: trailer.getObjectByName("Trailer_Root")!,
    trailerBody,
    trailerBodyBox: localBounds(trailerBody),
    lightMaterials,
    headlights,
    headlightGlow,
  };
}

/** Adds (once) a node midway between the headlamps; returns its name. */
function centreBeamNode(tractor: Object3D): string {
  const name = "Lights_Head_Centre";
  if (tractor.getObjectByName(name)) return name;
  const left = tractor.getObjectByName("Lights_Head_L")!;
  const right = tractor.getObjectByName("Lights_Head_R")!;
  const parent = left.parent!;
  tractor.updateMatrixWorld(true);
  const centre = left
    .getWorldPosition(new Vector3())
    .add(right.getWorldPosition(new Vector3()))
    .multiplyScalar(0.5);
  const node = new Object3D();
  node.name = name;
  node.position.copy(parent.worldToLocal(centre));
  parent.add(node);
  return name;
}

/** Bounds of an object's meshes, expressed in that object's own local space. */
export function localBounds(object: Object3D): Box3 {
  object.updateWorldMatrix(true, true);
  const inverse = object.matrixWorld.clone().invert();
  const box = new Box3();
  object.traverse((child) => {
    const mesh = child as Mesh;
    if (!mesh.isMesh) return;
    mesh.geometry.computeBoundingBox();
    const childBox = mesh.geometry.boundingBox!.clone();
    childBox.applyMatrix4(mesh.matrixWorld).applyMatrix4(inverse);
    box.union(childBox);
  });
  return box;
}
