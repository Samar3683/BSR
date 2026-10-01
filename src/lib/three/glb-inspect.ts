/*
 * Static inspection of a binary glTF (GLB) file, without Three.js or a GPU:
 * node and material names, extensions, triangle count, embedded images and an
 * estimate of their GPU memory. No imports, so the offline validator
 * (scripts/validate-hero-model.mjs) can run it directly under Node.
 */

interface GltfJson {
  asset?: { version?: string; generator?: string };
  scene?: number;
  scenes?: Array<{ nodes?: number[] }>;
  nodes?: Array<{
    name?: string;
    mesh?: number;
    children?: number[];
    extensions?: Record<string, { attributes?: Record<string, number> }>;
  }>;
  meshes?: Array<{
    primitives: Array<{ attributes: Record<string, number>; indices?: number; mode?: number }>;
  }>;
  accessors?: Array<{ count: number }>;
  materials?: Array<{ name?: string }>;
  images?: Array<{ bufferView?: number; mimeType?: string; uri?: string; name?: string }>;
  bufferViews?: Array<{ byteOffset?: number; byteLength: number }>;
  extensionsUsed?: string[];
  extensionsRequired?: string[];
}

export interface GlbImage {
  index: number;
  name: string | null;
  mimeType: string | null;
  bytes: number;
  width: number | null;
  height: number | null;
  /** Estimated GPU bytes once uploaded (mipmaps included). */
  gpuBytes: number;
}

export interface GlbReport {
  byteLength: number;
  generator: string | null;
  nodeNames: string[];
  materialNames: string[];
  extensionsUsed: string[];
  extensionsRequired: string[];
  /** Triangles drawn by the default scene (instancing included). */
  triangles: number;
  primitives: number;
  images: GlbImage[];
  textureGpuBytes: number;
}

const GLB_MAGIC = 0x46546c67; // "glTF"
const CHUNK_JSON = 0x4e4f534a;
const CHUNK_BIN = 0x004e4942;

export function parseGlb(bytes: Uint8Array): { json: GltfJson; bin: Uint8Array | null } {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes.byteLength < 20 || view.getUint32(0, true) !== GLB_MAGIC) {
    throw new Error("Not a GLB file (missing glTF magic)");
  }
  if (view.getUint32(4, true) !== 2) throw new Error("Only glTF 2.0 GLB files are supported");
  let offset = 12;
  let json: GltfJson | null = null;
  let bin: Uint8Array | null = null;
  while (offset + 8 <= bytes.byteLength) {
    const length = view.getUint32(offset, true);
    const type = view.getUint32(offset + 4, true);
    const chunk = bytes.subarray(offset + 8, offset + 8 + length);
    if (type === CHUNK_JSON) json = JSON.parse(new TextDecoder().decode(chunk)) as GltfJson;
    else if (type === CHUNK_BIN) bin = chunk;
    offset += 8 + length;
  }
  if (!json) throw new Error("GLB has no JSON chunk");
  return { json, bin };
}

export function inspectGlb(bytes: Uint8Array): GlbReport {
  const { json, bin } = parseGlb(bytes);
  const nodes = json.nodes ?? [];
  const accessors = json.accessors ?? [];

  let triangles = 0;
  let primitives = 0;
  const visit = (index: number, instances: number) => {
    const node = nodes[index];
    if (!node) return;
    const instancing = node.extensions?.EXT_mesh_gpu_instancing?.attributes;
    const instanceAccessor = instancing ? Object.values(instancing)[0] : undefined;
    const count =
      instanceAccessor !== undefined ? (accessors[instanceAccessor]?.count ?? 1) : instances;
    if (node.mesh !== undefined) {
      for (const primitive of json.meshes?.[node.mesh]?.primitives ?? []) {
        primitives++;
        const vertices =
          primitive.indices !== undefined
            ? (accessors[primitive.indices]?.count ?? 0)
            : (accessors[primitive.attributes.POSITION ?? -1]?.count ?? 0);
        triangles += primitiveTriangles(primitive.mode ?? 4, vertices) * count;
      }
    }
    for (const child of node.children ?? []) visit(child, instances);
  };
  const scene = json.scenes?.[json.scene ?? 0];
  for (const root of scene?.nodes ?? []) visit(root, 1);

  const images = (json.images ?? []).map((image, index): GlbImage => {
    const viewInfo = image.bufferView !== undefined ? json.bufferViews?.[image.bufferView] : null;
    const data =
      viewInfo && bin
        ? bin.subarray(viewInfo.byteOffset ?? 0, (viewInfo.byteOffset ?? 0) + viewInfo.byteLength)
        : null;
    const size = data ? imageSize(data, image.mimeType ?? null) : null;
    return {
      index,
      name: image.name ?? null,
      mimeType: image.mimeType ?? null,
      bytes: data?.byteLength ?? 0,
      width: size?.width ?? null,
      height: size?.height ?? null,
      gpuBytes: size ? size.gpuBytes : 0,
    };
  });

  return {
    byteLength: bytes.byteLength,
    generator: json.asset?.generator ?? null,
    nodeNames: nodes.map((node) => node.name ?? "").filter(Boolean),
    materialNames: (json.materials ?? []).map((material) => material.name ?? "").filter(Boolean),
    extensionsUsed: json.extensionsUsed ?? [],
    extensionsRequired: json.extensionsRequired ?? [],
    triangles,
    primitives,
    images,
    textureGpuBytes: images.reduce((sum, image) => sum + image.gpuBytes, 0),
  };
}

function primitiveTriangles(mode: number, vertices: number): number {
  if (mode === 4) return Math.floor(vertices / 3); // TRIANGLES
  if (mode === 5 || mode === 6) return Math.max(0, vertices - 2); // STRIP / FAN
  return 0; // points and lines
}

const MIP_CHAIN = 4 / 3;

/**
 * Pixel size and GPU estimate. KTX2 (Basis) transcodes to ~1 byte per pixel
 * (BC7 / ASTC 4×4; a conservative figure for ETC1S too); PNG/JPEG upload as
 * RGBA8 (4 bytes per pixel). Mipmaps add a third.
 */
function imageSize(
  data: Uint8Array,
  mimeType: string | null,
): { width: number; height: number; gpuBytes: number } | null {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  if (mimeType === "image/ktx2" && data.byteLength >= 48) {
    const width = view.getUint32(20, true);
    const height = view.getUint32(24, true);
    const levels = Math.max(1, view.getUint32(40, true));
    return { width, height, gpuBytes: Math.round(width * height * (levels > 1 ? MIP_CHAIN : 1)) };
  }
  if (mimeType === "image/png" && data.byteLength >= 24) {
    const width = view.getUint32(16, false);
    const height = view.getUint32(20, false);
    return { width, height, gpuBytes: Math.round(width * height * 4 * MIP_CHAIN) };
  }
  if (mimeType === "image/jpeg") {
    // Walk the markers to a start-of-frame segment (SOF0–SOF15, except DHT/JPG/DAC).
    let offset = 2;
    while (offset + 9 < data.byteLength) {
      if (data[offset] !== 0xff) return null;
      const marker = data[offset + 1]!;
      const length = view.getUint16(offset + 2, false);
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
        const height = view.getUint16(offset + 5, false);
        const width = view.getUint16(offset + 7, false);
        return { width, height, gpuBytes: Math.round(width * height * 4 * MIP_CHAIN) };
      }
      offset += 2 + length;
    }
  }
  return null;
}

/** Violations of the approved asset pipeline (GLB + Meshopt + KTX2, no Draco). */
export function pipelineIssues(report: GlbReport): string[] {
  const issues: string[] = [];
  if (report.extensionsUsed.includes("KHR_draco_mesh_compression")) {
    issues.push("uses Draco (KHR_draco_mesh_compression); the pipeline uses Meshopt");
  }
  const meshopt =
    report.extensionsUsed.includes("EXT_meshopt_compression") ||
    report.extensionsUsed.includes("KHR_meshopt_compression");
  if (report.primitives > 0 && !meshopt) {
    issues.push("geometry is not Meshopt-compressed (EXT_meshopt_compression)");
  }
  for (const image of report.images) {
    if (image.mimeType !== "image/ktx2") {
      issues.push(
        `image ${image.index}${image.name ? ` (${image.name})` : ""} is ${image.mimeType ?? "external/unknown"}; textures must be KTX2`,
      );
    }
  }
  if (report.images.some((image) => image.mimeType === "image/ktx2")) {
    if (!report.extensionsUsed.includes("KHR_texture_basisu")) {
      issues.push("KTX2 images without KHR_texture_basisu");
    }
  }
  return issues;
}
