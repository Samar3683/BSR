import {
  AdditiveBlending,
  type Bone,
  BufferAttribute,
  BufferGeometry,
  Color,
  type InstancedMesh,
  type Material,
  Matrix3,
  Matrix4,
  Mesh,
  type MeshStandardMaterial,
  Object3D,
  Skeleton,
  SkinnedMesh,
  type Texture,
  Vector3,
  Vector4,
} from "three";

/*
 * Draw-call batching for imperatively built scene graphs.
 *
 * Meshes below `root` are merged into one mesh per material, baked into the
 * root's space. Materials that differ only in values the shader can take per
 * vertex are merged too, with those values moved into vertex attributes the
 * shader multiplies exactly like the material uniforms, so the image is
 * unchanged:
 *  - `color` (and per-instance / existing vertex colours) → vertex colour;
 *  - roughness, metalness, emissive (MeshStandardMaterial) → per-vertex
 *    factors applied after the material's own maps;
 *  - glTF vertex-colour material variants (the loader clones a material for
 *    primitives with COLOR_0) → one instance, white vertex colour elsewhere.
 *
 * Animated parts: pass the moving nodes as `bones`. Every vertex is then bound
 * (weight 1) to the nearest bone above its mesh — rigid GPU skinning — so the
 * runtime keeps animating the same nodes and the merged mesh follows them. A
 * node that is neither the root nor a bone must not move relative to its
 * nearest bone.
 *
 * Left untouched (they keep their own draw calls): excluded subtrees,
 * invisible objects, meshes with children, per-object render hooks, custom
 * depth materials, morph targets/instanced attributes, multi-material meshes,
 * sprites/lines/points, and alpha-blended transparency (its per-object sort
 * order matters; additive blending is order-free and is merged).
 */

export interface BatchOptions {
  /** Materials the runtime changes (colour, emissive, opacity…): never folded or cloned. */
  keep?: Iterable<Material>;
  /** Moving nodes below the root: meshes under them are skinned to them. */
  bones?: Object3D[];
  /** Subtrees to leave exactly as they are. */
  exclude?: Iterable<Object3D>;
  /**
   * Fold colour (and, for standard materials, roughness/metalness/emissive)
   * into vertex attributes — new material instances. Off: only existing
   * material instances are used (glTF vertex-colour variants still merge).
   */
  fold?: boolean;
}

export interface BatchResult {
  meshesBefore: number;
  meshesAfter: number;
}

type Mode = "instance" | "variants" | "color" | "surface";

interface Member {
  mesh: Mesh;
  bone: number;
  /** Root-space transform per drawn copy (one, or one per instance). */
  copies: Array<{ matrix: Matrix4; color: Color | null }>;
}

interface Bucket {
  mode: Mode;
  members: Member[];
}

const FOLDABLE = new Set([
  "MeshStandardMaterial",
  "MeshPhysicalMaterial",
  "MeshLambertMaterial",
  "MeshPhongMaterial",
  "MeshBasicMaterial",
]);
const IDENTITY_KEYS = ["uuid", "id", "name", "version", "userData", "_listeners"];
const SKIP = {
  // Variants keep their name: runtime code finds glTF materials by name (e.g. the truck's
  // tail vs brake lamps can be identical at build time yet driven separately).
  variants: new Set(["uuid", "id", "version", "userData", "_listeners", "vertexColors"]),
  color: new Set([...IDENTITY_KEYS, "color", "vertexColors"]),
  surface: new Set([...IDENTITY_KEYS, "color", "vertexColors", "roughness", "metalness", "emissive", "emissiveIntensity"]),
};
const WHITE = new Color(1, 1, 1);

export function batchStatic(root: Object3D, options: BatchOptions = {}): BatchResult {
  const keep = new Set(options.keep ?? []);
  const exclude = new Set(options.exclude ?? []);
  const fold = options.fold ?? true;
  const bones = [root, ...(options.bones ?? [])];
  const boneIndex = new Map(bones.map((bone, i) => [bone, i]));

  root.updateMatrixWorld(true);
  const rootInverse = new Matrix4().copy(root.matrixWorld).invert();
  const buckets = new Map<string, Bucket>();
  let meshesBefore = 0;

  const classify = (material: Material): { mode: Mode; signature: string } => {
    if (!keep.has(material)) {
      const surface = fold && material.type === "MeshStandardMaterial" ? signature(material, SKIP.surface) : null;
      if (surface) return { mode: "surface", signature: surface };
      const color = fold ? signature(material, SKIP.color) : null;
      if (color) return { mode: "color", signature: color };
      const variants = signature(material, SKIP.variants);
      if (variants) return { mode: "variants", signature: variants };
    }
    return { mode: "instance", signature: material.uuid };
  };

  const collect = (object: Object3D, bone: number) => {
    if (exclude.has(object) || !object.visible) return;
    const ownBone = boneIndex.get(object) ?? bone;
    const mesh = object as Mesh;
    if (mesh.isMesh) {
      meshesBefore++;
      const member = eligible(mesh) ? toMember(mesh, ownBone, rootInverse) : null;
      if (member) {
        const { mode, signature: materialKey } = classify(mesh.material as Material);
        // Per-instance colours need a vertex-colour material we are allowed to create.
        const instanceColors = member.copies.some((copy) => copy.color);
        if (!instanceColors || mode === "color" || mode === "surface") {
          const key = [
            mode,
            materialKey,
            mesh.castShadow,
            mesh.receiveShadow,
            mesh.renderOrder,
            mesh.frustumCulled,
            mesh.layers.mask,
            attributeSignature(mesh.geometry, mode !== "instance"),
          ].join("|");
          const bucket = buckets.get(key) ?? { mode, members: [] };
          bucket.members.push(member);
          buckets.set(key, bucket);
        }
      }
    }
    for (const child of [...object.children]) collect(child, ownBone);
  };
  for (const child of [...root.children]) collect(child, 0);

  let merged = 0;
  let batches = 0;
  for (const bucket of buckets.values()) {
    // A lone mesh (or a lone instanced mesh) is already one draw call.
    if (bucket.members.length === 1) continue;
    const { material, color, surface } = outputMaterial(bucket);
    const anyBone = bucket.members.some((m) => m.bone !== 0);
    const geometry = mergeMembers(bucket.members, { color, surface, skin: anyBone });
    const mesh = anyBone ? new SkinnedMesh(geometry, material) : new Mesh(geometry, material);
    const sample = bucket.members[0]!.mesh;
    mesh.name = `${root.name || "Batch"}_Batch_${batches++}`;
    mesh.castShadow = sample.castShadow;
    mesh.receiveShadow = sample.receiveShadow;
    mesh.renderOrder = sample.renderOrder;
    mesh.layers.mask = sample.layers.mask;
    // Skinned bounds follow the bones (not the bind pose): never culled.
    mesh.frustumCulled = anyBone ? false : sample.frustumCulled;
    root.add(mesh);
    if (anyBone) (mesh as SkinnedMesh).bind(new Skeleton(bones as Bone[]));
    for (const member of bucket.members) member.mesh.removeFromParent();
    merged += 1 - bucket.members.length;
  }
  return { meshesBefore, meshesAfter: meshesBefore + merged };
}

type ColorMode = "keep" | "none" | "variants" | "fold";

/** The merged mesh's material and how its colour/surface attributes are built. */
function outputMaterial(bucket: Bucket): { material: Material; color: ColorMode; surface: boolean } {
  const materials = bucket.members.map((m) => m.mesh.material as Material & { vertexColors: boolean });
  const first = materials[0]!;
  const same = materials.every((m) => m === first);
  const instanceColors = bucket.members.some((m) => m.copies.some((c) => c.color));
  if (bucket.mode === "instance") return { material: first, color: "keep", surface: false };
  if (bucket.mode === "variants") {
    const withColors = materials.find((m) => m.vertexColors);
    return withColors
      ? { material: withColors, color: "variants", surface: false }
      : { material: first, color: "none", surface: false };
  }
  if (same && !instanceColors) {
    return { material: first, color: first.vertexColors ? "variants" : "none", surface: false };
  }
  const surface =
    bucket.mode === "surface" &&
    materials.some((m) => surfaceKey(m as unknown as MeshStandardMaterial) !== surfaceKey(first as unknown as MeshStandardMaterial));
  return { material: surface ? surfaceMaterial(first as unknown as MeshStandardMaterial) : colorMaterial(first), color: "fold", surface };
}

function eligible(mesh: Mesh): boolean {
  const geometry = mesh.geometry;
  if ((mesh as SkinnedMesh).isSkinnedMesh || Array.isArray(mesh.material)) return false;
  if (mesh.children.length > 0) return false;
  if (mesh.onBeforeRender !== Object3D.prototype.onBeforeRender) return false;
  if (mesh.onAfterRender !== Object3D.prototype.onAfterRender) return false;
  if (mesh.customDepthMaterial || mesh.customDistanceMaterial) return false;
  // Geometry groups only matter with a material array (excluded above): one material
  // draws the whole geometry in one call, so primitives' face groups are ignored.
  if (Object.keys(geometry.morphAttributes).length > 0) return false;
  if (geometry.drawRange.start !== 0 || geometry.drawRange.count !== Infinity) return false;
  // Interleaved/quantised glTF attributes are fine (read through the accessors, which
  // de-interleave and denormalise); per-instance attributes belong to custom shaders.
  for (const attribute of Object.values(geometry.attributes)) {
    if ((attribute as BufferAttribute & { isInstancedBufferAttribute?: boolean }).isInstancedBufferAttribute) return false;
  }
  if (!geometry.attributes.position) return false;
  const material = mesh.material as Material;
  if (material.transparent && !(material.blending === AdditiveBlending && !material.depthWrite)) return false;
  return true;
}

function toMember(mesh: Mesh, bone: number, rootInverse: Matrix4): Member {
  const base = new Matrix4().multiplyMatrices(rootInverse, mesh.matrixWorld);
  const instanced = mesh as InstancedMesh;
  if (!instanced.isInstancedMesh) return { mesh, bone, copies: [{ matrix: base, color: null }] };
  const copies: Member["copies"] = [];
  const local = new Matrix4();
  for (let i = 0; i < instanced.count; i++) {
    instanced.getMatrixAt(i, local);
    const color = instanced.instanceColor ? new Color() : null;
    if (color) instanced.getColorAt(i, color);
    copies.push({ matrix: new Matrix4().multiplyMatrices(base, local), color });
  }
  return { mesh, bone, copies };
}

/** Everything that affects the shader or render state, except the skipped keys. */
function signature(material: Material, skip: Set<string>): string | null {
  if (!FOLDABLE.has(material.type)) return null;
  const parts: string[] = [material.type];
  for (const [key, value] of Object.entries(material)) {
    if (skip.has(key)) continue;
    if (typeof value === "function") return null; // custom shader hooks (onBeforeCompile…)
    parts.push(`${key}=${describe(value)}`);
  }
  return parts.join(";");
}

function describe(value: unknown): string {
  if (value === null || value === undefined) return String(value);
  if (typeof value !== "object") return String(value);
  const v = value as { isColor?: boolean; isTexture?: boolean; isVector2?: boolean; uuid?: string };
  if (v.isColor) return (value as Color).getHexString();
  if (v.isTexture) return (value as Texture).uuid;
  if (v.isVector2) return `${(value as { x: number }).x},${(value as { y: number }).y}`;
  if (v.uuid) return v.uuid;
  return JSON.stringify(value);
}

function attributeSignature(geometry: BufferGeometry, ignoreColor: boolean): string {
  return (
    Object.entries(geometry.attributes)
      .filter(([name]) => !(ignoreColor && name === "color"))
      .map(([name, a]) => `${name}:${a.itemSize}`)
      .sort()
      .join(",") + (geometry.index ? ":i" : "")
  );
}

function surfaceKey(material: MeshStandardMaterial): string {
  return `${material.roughness},${material.metalness},${material.emissive.getHexString()},${material.emissiveIntensity}`;
}

function colorMaterial(material: Material): Material {
  const folded = material.clone() as Material & { color: Color; vertexColors: boolean };
  folded.name = material.name;
  folded.color.copy(WHITE);
  folded.vertexColors = true;
  return folded;
}

/**
 * Standard material whose roughness, metalness and emissive come per vertex:
 * the uniforms are set to 1/white and the attributes multiply the factors after
 * the material's own maps — the same products the uniforms would give.
 */
function surfaceMaterial(material: MeshStandardMaterial): MeshStandardMaterial {
  const folded = colorMaterial(material) as MeshStandardMaterial;
  folded.roughness = 1;
  folded.metalness = 1;
  folded.emissive.copy(WHITE);
  folded.emissiveIntensity = 1;
  folded.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        "#include <common>\nattribute vec2 batchSurface;\nattribute vec3 batchEmissive;\nvarying vec2 vBatchSurface;\nvarying vec3 vBatchEmissive;",
      )
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvBatchSurface = batchSurface;\nvBatchEmissive = batchEmissive;");
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\nvarying vec2 vBatchSurface;\nvarying vec3 vBatchEmissive;")
      .replace("#include <roughnessmap_fragment>", "#include <roughnessmap_fragment>\nroughnessFactor *= vBatchSurface.x;")
      .replace("#include <metalnessmap_fragment>", "#include <metalnessmap_fragment>\nmetalnessFactor *= vBatchSurface.y;")
      .replace("#include <emissivemap_fragment>", "#include <emissivemap_fragment>\ntotalEmissiveRadiance *= vBatchEmissive;");
  };
  folded.customProgramCacheKey = () => "bsr-batch-surface";
  return folded;
}

function mergeMembers(
  members: Member[],
  options: { color: ColorMode; surface: boolean; skin: boolean },
): BufferGeometry {
  const sample = members[0]!.mesh.geometry;
  const names = Object.keys(sample.attributes).filter((name) => options.color === "keep" || name !== "color");
  let vertexCount = 0;
  let indexCount = 0;
  for (const member of members) {
    const g = member.mesh.geometry;
    const n = member.copies.length;
    vertexCount += g.attributes.position!.count * n;
    indexCount += (g.index ? g.index.count : g.attributes.position!.count) * n;
  }
  const arrays: Record<string, Float32Array> = {};
  for (const name of names) arrays[name] = new Float32Array(vertexCount * sample.attributes[name]!.itemSize);
  const makeColors = options.color === "variants" || options.color === "fold";
  const colors = makeColors ? new Float32Array(vertexCount * 3) : null;
  const surface = options.surface ? new Float32Array(vertexCount * 2) : null;
  const emissive = options.surface ? new Float32Array(vertexCount * 3) : null;
  const skinIndex = options.skin ? new Uint16Array(vertexCount * 4) : null;
  const skinWeight = options.skin ? new Float32Array(vertexCount * 4) : null;
  const index = vertexCount > 65535 ? new Uint32Array(indexCount) : new Uint16Array(indexCount);

  const v = new Vector3();
  const v4 = new Vector4();
  const normalMatrix = new Matrix3();
  const tint = new Color();
  const glow = new Color();
  let vertexBase = 0;
  let indexBase = 0;
  for (const member of members) {
    const geometry = member.mesh.geometry;
    const material = member.mesh.material as MeshStandardMaterial;
    const count = geometry.attributes.position!.count;
    const sourceColor = material.vertexColors ? geometry.attributes.color : undefined;
    for (const copy of member.copies) {
      normalMatrix.getNormalMatrix(copy.matrix);
      const flip = copy.matrix.determinant() < 0;
      for (const name of names) {
        const source = geometry.attributes[name]!;
        const target = arrays[name]!;
        const size = source.itemSize;
        for (let i = 0; i < count; i++) {
          const o = (vertexBase + i) * size;
          if (name === "position") {
            v.fromBufferAttribute(source, i).applyMatrix4(copy.matrix);
            target[o] = v.x;
            target[o + 1] = v.y;
            target[o + 2] = v.z;
          } else if (name === "normal") {
            v.fromBufferAttribute(source, i).applyMatrix3(normalMatrix).normalize();
            target[o] = v.x;
            target[o + 1] = v.y;
            target[o + 2] = v.z;
          } else if (name === "tangent") {
            v4.fromBufferAttribute(source as BufferAttribute, i);
            v.set(v4.x, v4.y, v4.z).transformDirection(copy.matrix);
            target[o] = v.x;
            target[o + 1] = v.y;
            target[o + 2] = v.z;
            target[o + 3] = flip ? -v4.w : v4.w;
          } else {
            for (let k = 0; k < size; k++) target[o + k] = source.getComponent(i, k);
          }
        }
      }
      if (colors) {
        tint.copy(options.color === "fold" ? (material.color ?? WHITE) : WHITE);
        if (options.color === "fold" && copy.color) tint.multiply(copy.color);
        for (let i = 0; i < count; i++) {
          const o = (vertexBase + i) * 3;
          colors[o] = tint.r * (sourceColor ? sourceColor.getX(i) : 1);
          colors[o + 1] = tint.g * (sourceColor ? sourceColor.getY(i) : 1);
          colors[o + 2] = tint.b * (sourceColor ? sourceColor.getZ(i) : 1);
        }
      }
      if (surface && emissive) {
        glow.copy(material.emissive).multiplyScalar(material.emissiveIntensity);
        for (let i = 0; i < count; i++) {
          surface[(vertexBase + i) * 2] = material.roughness;
          surface[(vertexBase + i) * 2 + 1] = material.metalness;
          emissive[(vertexBase + i) * 3] = glow.r;
          emissive[(vertexBase + i) * 3 + 1] = glow.g;
          emissive[(vertexBase + i) * 3 + 2] = glow.b;
        }
      }
      if (skinIndex && skinWeight) {
        for (let i = 0; i < count; i++) {
          skinIndex[(vertexBase + i) * 4] = member.bone;
          skinWeight[(vertexBase + i) * 4] = 1;
        }
      }
      const sourceIndex = geometry.index;
      const n = sourceIndex ? sourceIndex.count : count;
      for (let i = 0; i < n; i += 3) {
        const a = sourceIndex ? sourceIndex.getX(i) : i;
        const b = sourceIndex ? sourceIndex.getX(i + 1) : i + 1;
        const c = sourceIndex ? sourceIndex.getX(i + 2) : i + 2;
        // A mirrored transform reverses the winding: swap to keep the same front faces.
        index[indexBase + i] = vertexBase + a;
        index[indexBase + i + 1] = vertexBase + (flip ? c : b);
        index[indexBase + i + 2] = vertexBase + (flip ? b : c);
      }
      vertexBase += count;
      indexBase += n;
    }
  }

  const geometry = new BufferGeometry();
  for (const name of names) geometry.setAttribute(name, new BufferAttribute(arrays[name]!, sample.attributes[name]!.itemSize));
  if (colors) geometry.setAttribute("color", new BufferAttribute(colors, 3));
  if (surface && emissive) {
    geometry.setAttribute("batchSurface", new BufferAttribute(surface, 2));
    geometry.setAttribute("batchEmissive", new BufferAttribute(emissive, 3));
  }
  if (skinIndex && skinWeight) {
    geometry.setAttribute("skinIndex", new BufferAttribute(skinIndex, 4));
    geometry.setAttribute("skinWeight", new BufferAttribute(skinWeight, 4));
  }
  geometry.setIndex(new BufferAttribute(index, 1));
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}
