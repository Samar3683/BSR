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

  root.traverse((object) => {
    const mesh = object as Mesh;
    if (!mesh.isMesh) return;
    mesh.material = Array.isArray(mesh.material)
      ? mesh.material.map(replace)
      : replace(mesh.material);
    const list = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const material of list) {
      if (material.name !== "MAT_Glass") continue;
      // Glass: smooth, dielectric, strong scene reflection (Fresnel from the env probe) over a
      // dark-but-not-black cabin tint — reads as a windscreen, not a black slab.
      const glass = material as MeshPhysicalMaterial;
      glass.roughness = 0.05;
      glass.metalness = 0;
      glass.envMapIntensity = 2.2;
      glass.color?.set("#27333d");
      if (glass.isMeshPhysicalMaterial) {
        glass.clearcoat = 1;
        glass.clearcoatRoughness = 0.03;
      }
    }
    const casts = list.every((material) => !NON_CASTING.has(material.name));
    mesh.castShadow = casts;
    mesh.receiveShadow = true;
  });
  for (const material of replacements.keys()) material.dispose();
  return { downgraded };
}
