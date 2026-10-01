import { describe, expect, it } from "vitest";

import { inspectGlb, parseGlb, pipelineIssues } from "./glb-inspect";

/** Builds a minimal GLB (JSON + BIN chunks) for tests. */
function glb(json: object, bin = new Uint8Array(0)): Uint8Array {
  const pad = (bytes: Uint8Array, fill: number) => {
    const padded = new Uint8Array(Math.ceil(bytes.byteLength / 4) * 4).fill(fill);
    padded.set(bytes);
    return padded;
  };
  const jsonChunk = pad(new TextEncoder().encode(JSON.stringify(json)), 0x20);
  const binChunk = pad(bin, 0);
  const total = 12 + 8 + jsonChunk.byteLength + (binChunk.byteLength ? 8 + binChunk.byteLength : 0);
  const out = new Uint8Array(total);
  const view = new DataView(out.buffer);
  view.setUint32(0, 0x46546c67, true);
  view.setUint32(4, 2, true);
  view.setUint32(8, total, true);
  view.setUint32(12, jsonChunk.byteLength, true);
  view.setUint32(16, 0x4e4f534a, true);
  out.set(jsonChunk, 20);
  if (binChunk.byteLength) {
    const at = 20 + jsonChunk.byteLength;
    view.setUint32(at, binChunk.byteLength, true);
    view.setUint32(at + 4, 0x004e4942, true);
    out.set(binChunk, at + 8);
  }
  return out;
}

function ktx2Header(width: number, height: number, levels: number): Uint8Array {
  const bytes = new Uint8Array(80);
  bytes.set([0xab, 0x4b, 0x54, 0x58, 0x20, 0x32, 0x30, 0xbb, 0x0d, 0x0a, 0x1a, 0x0a]);
  const view = new DataView(bytes.buffer);
  view.setUint32(20, width, true);
  view.setUint32(24, height, true);
  view.setUint32(40, levels, true);
  return bytes;
}

function pngHeader(width: number, height: number): Uint8Array {
  const bytes = new Uint8Array(33);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const view = new DataView(bytes.buffer);
  view.setUint32(16, width, false);
  view.setUint32(20, height, false);
  return bytes;
}

const TRUCK_JSON = {
  asset: { version: "2.0", generator: "test" },
  scene: 0,
  scenes: [{ nodes: [0] }],
  nodes: [
    { name: "Tractor", children: [1, 2] },
    { name: "Tractor_Body", mesh: 0 },
    {
      name: "Bolts",
      mesh: 1,
      extensions: { EXT_mesh_gpu_instancing: { attributes: { TRANSLATION: 3 } } },
    },
  ],
  meshes: [
    { primitives: [{ attributes: { POSITION: 0 }, indices: 1 }] },
    { primitives: [{ attributes: { POSITION: 2 } }] },
  ],
  accessors: [{ count: 400 }, { count: 3000 }, { count: 36 }, { count: 10 }],
  materials: [{ name: "MAT_Paint_Body" }, { name: "MAT_Glass" }],
  extensionsUsed: ["EXT_meshopt_compression", "EXT_mesh_gpu_instancing"],
};

describe("inspectGlb", () => {
  it("reads names, extensions and triangles (indices, non-indexed, instancing)", () => {
    const report = inspectGlb(glb(TRUCK_JSON));
    expect(report.nodeNames).toEqual(["Tractor", "Tractor_Body", "Bolts"]);
    expect(report.materialNames).toEqual(["MAT_Paint_Body", "MAT_Glass"]);
    // 3000 indices → 1000 triangles; 36 vertices × 10 instances → 120.
    expect(report.triangles).toBe(1000 + 120);
    expect(report.primitives).toBe(2);
    expect(pipelineIssues(report)).toEqual([]);
  });

  it("measures embedded KTX2 and PNG images and estimates GPU memory", () => {
    const ktx = ktx2Header(2048, 2048, 12);
    const png = pngHeader(1024, 512);
    const bin = new Uint8Array(ktx.byteLength + png.byteLength);
    bin.set(ktx, 0);
    bin.set(png, ktx.byteLength);
    const report = inspectGlb(
      glb(
        {
          ...TRUCK_JSON,
          images: [
            { bufferView: 0, mimeType: "image/ktx2", name: "cab_basecolor" },
            { bufferView: 1, mimeType: "image/png", name: "wheel" },
          ],
          bufferViews: [
            { byteOffset: 0, byteLength: ktx.byteLength },
            { byteOffset: ktx.byteLength, byteLength: png.byteLength },
          ],
          extensionsUsed: [...TRUCK_JSON.extensionsUsed, "KHR_texture_basisu"],
        },
        bin,
      ),
    );
    expect(report.images[0]).toMatchObject({ width: 2048, height: 2048 });
    expect(report.images[0]!.gpuBytes).toBe(Math.round(2048 * 2048 * (4 / 3)));
    expect(report.images[1]).toMatchObject({ width: 1024, height: 512 });
    expect(report.images[1]!.gpuBytes).toBe(Math.round(1024 * 512 * 4 * (4 / 3)));
    expect(pipelineIssues(report)).toEqual(["image 1 (wheel) is image/png; textures must be KTX2"]);
  });

  it("flags Draco and uncompressed geometry", () => {
    const draco = inspectGlb(
      glb({ ...TRUCK_JSON, extensionsUsed: ["KHR_draco_mesh_compression"] }),
    );
    expect(pipelineIssues(draco)).toEqual([
      "uses Draco (KHR_draco_mesh_compression); the pipeline uses Meshopt",
      "geometry is not Meshopt-compressed (EXT_meshopt_compression)",
    ]);
  });

  it("rejects files that are not GLB", () => {
    expect(() => parseGlb(new TextEncoder().encode('{"asset":{}}'))).toThrow(/magic/);
  });
});
