import type { Material, Object3D, Texture } from "three";

/**
 * Releases GPU resources owned by an object tree: geometries, materials and
 * their textures. Objects added via <primitive> are not disposed by R3F, so
 * code that builds scene graphs imperatively must call this on unmount.
 */
export function disposeObject3D(root: Object3D): void {
  const materials = new Set<Material>();
  root.traverse((object) => {
    const withGeometry = object as Object3D & {
      geometry?: { dispose(): void };
      material?: Material | Material[];
      dispose?: () => void;
    };
    withGeometry.geometry?.dispose();
    const material = withGeometry.material;
    if (Array.isArray(material)) material.forEach((m) => materials.add(m));
    else if (material) materials.add(material);
    // Lights (shadow maps), instanced meshes and helpers expose their own dispose().
    withGeometry.dispose?.();
  });
  for (const material of materials) {
    for (const value of Object.values(material)) {
      if (value && typeof value === "object" && (value as Texture).isTexture) {
        (value as Texture).dispose();
      }
    }
    material.dispose();
  }
}
