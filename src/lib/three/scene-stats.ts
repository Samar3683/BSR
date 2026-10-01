import type { BufferGeometry, InstancedMesh, Material, Mesh, Object3D, Texture } from "three";

/**
 * Static cost of an object tree, measured on the CPU before anything renders:
 * triangles, draw calls, materials and an estimate of GPU texture memory.
 * Used to hold assets to their budgets (the renderer's own `info` only
 * reports what the last frame drew).
 */
export interface SceneStats {
  triangles: number;
  /** One per mesh and geometry group (a shadow pass adds one per caster). */
  drawCalls: number;
  shadowCasters: number;
  materials: number;
  textures: number;
  /** Estimated bytes, including mipmaps. */
  textureBytes: number;
}

export function measureObject(root: Object3D, options: { visibleOnly?: boolean } = {}): SceneStats {
  const visibleOnly = options.visibleOnly ?? true;
  const materials = new Set<Material>();
  const textures = new Set<Texture>();
  let triangles = 0;
  let drawCalls = 0;
  let shadowCasters = 0;

  const visit = (object: Object3D) => {
    if (visibleOnly && !object.visible) return;
    const mesh = object as Mesh;
    if (mesh.isMesh) {
      const instances = (mesh as InstancedMesh).isInstancedMesh ? (mesh as InstancedMesh).count : 1;
      triangles += geometryTriangles(mesh.geometry) * instances;
      const groups = Math.max(1, mesh.geometry.groups.length);
      drawCalls += groups;
      if (mesh.castShadow) shadowCasters += groups;
      const list = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const material of list) {
        materials.add(material);
        for (const value of Object.values(material)) {
          if (value && typeof value === "object" && (value as Texture).isTexture) {
            textures.add(value as Texture);
          }
        }
      }
    }
    for (const child of object.children) visit(child);
  };
  visit(root);

  let textureBytes = 0;
  for (const texture of textures) textureBytes += estimateTextureBytes(texture);
  return {
    triangles,
    drawCalls,
    shadowCasters,
    materials: materials.size,
    textures: textures.size,
    textureBytes,
  };
}

export function geometryTriangles(geometry: BufferGeometry): number {
  const count = geometry.index ? geometry.index.count : (geometry.attributes.position?.count ?? 0);
  const drawCount = Number.isFinite(geometry.drawRange.count)
    ? Math.min(count, geometry.drawRange.count)
    : count;
  return Math.floor(drawCount / 3);
}

/**
 * Compressed textures (KTX2) report their real mip sizes; everything else is
 * assumed RGBA8 with a full mip chain (× 4/3).
 */
export function estimateTextureBytes(texture: Texture): number {
  const mipmaps = (texture as Texture & { mipmaps?: Array<{ data?: ArrayBufferView }> }).mipmaps;
  if ((texture as { isCompressedTexture?: boolean }).isCompressedTexture && mipmaps?.length) {
    return mipmaps.reduce((sum, level) => sum + (level.data?.byteLength ?? 0), 0);
  }
  const image = texture.image as { width?: number; height?: number } | undefined;
  const width = image?.width ?? 0;
  const height = image?.height ?? 0;
  return Math.round(width * height * 4 * (texture.generateMipmaps ? 4 / 3 : 1));
}
