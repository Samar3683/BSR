import { BoxGeometry, Group, Mesh, MeshPhysicalMaterial, MeshStandardMaterial } from "three";
import { describe, expect, it } from "vitest";

import { LIGHT_MATERIAL_NAMES, MATERIAL_SLOTS } from "./truck-contract-spec";
import { prepareTruckMaterials } from "./truck-materials";

function truckWithClearcoat() {
  const paint = new MeshPhysicalMaterial({ color: "#f0f0ea", roughness: 0.3, clearcoat: 1 });
  paint.name = MATERIAL_SLOTS.paintBody;
  const lens = new MeshStandardMaterial({ emissive: "#ffffff" });
  lens.name = LIGHT_MATERIAL_NAMES.head;
  const root = new Group();
  const cab = new Mesh(new BoxGeometry(), paint);
  const shared = new Mesh(new BoxGeometry(), paint);
  const lamp = new Mesh(new BoxGeometry(), lens);
  root.add(cab, shared, lamp);
  return { root, cab, shared, lamp };
}

describe("truck material preparation per tier", () => {
  it("keeps clearcoat (physical materials) on the high tier", () => {
    const { root, cab } = truckWithClearcoat();
    expect(prepareTruckMaterials(root, "high").downgraded).toEqual([]);
    expect((cab.material as MeshPhysicalMaterial).isMeshPhysicalMaterial).toBe(true);
  });

  for (const tier of ["medium", "low"] as const) {
    it(`${tier}: replaces physical materials with standard equivalents (shared once)`, () => {
      const { root, cab, shared } = truckWithClearcoat();
      const result = prepareTruckMaterials(root, tier);
      expect(result.downgraded).toEqual([MATERIAL_SLOTS.paintBody]);
      const material = cab.material as MeshStandardMaterial;
      expect((material as unknown as MeshPhysicalMaterial).isMeshPhysicalMaterial).toBeFalsy();
      expect(material.isMeshStandardMaterial).toBe(true);
      expect(material.name).toBe(MATERIAL_SLOTS.paintBody);
      expect(material.roughness).toBeCloseTo(0.3);
      expect(material.defines).toEqual({ STANDARD: "" });
      expect(shared.material).toBe(material);
    });
  }

  it("body meshes cast shadows; light lenses do not", () => {
    const { root, cab, lamp } = truckWithClearcoat();
    prepareTruckMaterials(root, "high");
    expect(cab.castShadow).toBe(true);
    expect(lamp.castShadow).toBe(false);
    expect(lamp.receiveShadow).toBe(true);
  });
});
