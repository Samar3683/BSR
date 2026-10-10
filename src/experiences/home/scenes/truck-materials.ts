import {
  type Material,
  type Mesh,
  type MeshPhysicalMaterial,
  MeshStandardMaterial,
  type Object3D,
} from "three";

import type { RealtimeQuality } from "@/lib/performance/quality";

import { LIGHT_MATERIAL_NAMES, LIVERY_MATERIAL_NAME } from "./truck-contract-spec";

/*
 * Prepares truck materials for a quality tier, before the contract binding.
 *
 * - Clearcoat and the other physical extensions (KHR_materials_clearcoat,
 *   sheen, transmission…) are kept on the high tier only; other tiers get the
 *   standard-material equivalent (same maps, colour, roughness, metalness).
 * - Every body mesh casts and receives shadows; light lenses and livery
 *   geometry never cast (they sit on the body surface).
 */

const NON_CASTING = new Set<string>([...Object.values(LIGHT_MATERIAL_NAMES), LIVERY_MATERIAL_NAME]);

export interface MaterialPreparation {
  /** Physical materials replaced by standard ones (tiers below high). */
  downgraded: string[];
}

export function prepareTruckMaterials(root: Object3D, tier: RealtimeQuality): MaterialPreparation {
  const replacements = new Map<Material, Material>();
  const downgraded: string[] = [];
  const replace = (material: Material): Material => {
    if (tier === "high" || !(material as MeshPhysicalMaterial).isMeshPhysicalMaterial) {
      return material;
    }
    let standard = replacements.get(material);
    if (!standard) {
      // MeshStandardMaterial.copy takes the shared (standard) properties and resets the defines.
      standard = new MeshStandardMaterial().copy(material as MeshStandardMaterial);
      standard.name = material.name;
      replacements.set(material, standard);
      downgraded.push(material.name);
    }
    return standard;
  };

  const tuned = new Set<Material>();
  root.traverse((object) => {
    const mesh = object as Mesh;
    if (!mesh.isMesh) return;
    mesh.material = Array.isArray(mesh.material)
      ? mesh.material.map(replace)
      : replace(mesh.material);
    const list = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const material of list) refineMaterial(material as MeshPhysicalMaterial, tuned);
    const casts = list.every((material) => !NON_CASTING.has(material.name));
    mesh.castShadow = casts;
    mesh.receiveShadow = true;
  });
  for (const material of replacements.keys()) material.dispose();
  return { downgraded };
}

/**
 * Material separation the asset leaves to the renderer (values, never baked light). Applied
 * once per material instance (`tuned`): tractor and trailer share slot instances after the
 * downgrade map, and a second pass would compound the scale factors.
 */
function refineMaterial(material: MeshPhysicalMaterial, tuned: Set<Material>): void {
  if (tuned.has(material)) return;
  tuned.add(material);
  switch (material.name) {
    case "MAT_Glass":
      // Smooth, dielectric, strong scene reflection (Fresnel from the env probe) over a
      // dark-but-not-black cabin tint — reads as a windscreen, not a black slab.
      material.roughness = 0.05;
      material.metalness = 0;
      material.envMapIntensity = 2.2;
      material.color?.set("#27333d");
      if (material.isMeshPhysicalMaterial) {
        material.clearcoat = 1;
        material.clearcoatRoughness = 0.03;
      }
      break;
    case "MAT_Metal_Steel":
      // Hubs, tanks, steps: painted / brushed metal with a satin finish, not polished
      // chrome — fully metallic at 0.36 the hubs mirrored the whole sunrise sky.
      material.roughness = 0.56;
      material.metalness = 0.75;
      material.color.setScalar(0.52);
      material.envMapIntensity = 0.8;
      break;
    case "MAT_Curtain":
      // PVC curtain: a white that is not paper white (headroom for the sunrise, whose
      // highlights otherwise clip the whole flank), and folds as tension in the fabric —
      // at 0.55 the 2 K fold map read as a hanging shower curtain under raking sun.
      material.color.set("#e9e8e2");
      material.normalScale.multiplyScalar(0.5);
      material.envMapIntensity = 0.8;
      break;
    case "MAT_Plastic_Grille":
      // Textured black plastic: a touch lighter and rougher than the graphite paint around
      // it, so the grille and bumper separate from the painted panels in the dark opening.
      material.color.setScalar(0.035);
      material.roughness = 0.68;
      break;
    case "MAT_Light_Tail":
    case "MAT_Light_Brake":
      // Saturated lens red: with a weak green/blue component the tone mapper desaturated
      // the lit lamps to salmon pink.
      material.emissive.setRGB(1, 0.015, 0.008);
      break;
  }
}
