import {
  BoxGeometry,
  CompressedTexture,
  DataTexture,
  Group,
  InstancedMesh,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
} from "three";
import { describe, expect, it } from "vitest";

import { estimateTextureBytes, measureObject } from "./scene-stats";

describe("measureObject", () => {
  it("counts triangles, draw calls, casters and distinct materials", () => {
    const material = new MeshStandardMaterial();
    const root = new Group();
    const box = new Mesh(new BoxGeometry(), material); // 12 triangles, 6 groups
    box.castShadow = true;
    const plane = new Mesh(new PlaneGeometry(), material); // 2 triangles
    root.add(box, plane);
    const stats = measureObject(root);
    expect(stats.triangles).toBe(14);
    expect(stats.drawCalls).toBe(6 + 1);
    expect(stats.shadowCasters).toBe(6);
    expect(stats.materials).toBe(1);
  });

  it("multiplies instanced triangles by the instance count (one draw call)", () => {
    const instanced = new InstancedMesh(new PlaneGeometry(), new MeshStandardMaterial(), 50);
    const stats = measureObject(instanced);
    expect(stats.triangles).toBe(100);
    expect(stats.drawCalls).toBe(1);
  });

  it("skips hidden subtrees unless asked not to", () => {
    const root = new Group();
    const hidden = new Mesh(new PlaneGeometry(), new MeshStandardMaterial());
    hidden.visible = false;
    root.add(hidden);
    expect(measureObject(root).triangles).toBe(0);
    expect(measureObject(root, { visibleOnly: false }).triangles).toBe(2);
  });

  it("collects textures once and estimates their memory", () => {
    const texture = new DataTexture(new Uint8Array(4 * 256 * 256), 256, 256);
    const a = new MeshStandardMaterial({ map: texture, roughnessMap: texture });
    const stats = measureObject(new Mesh(new PlaneGeometry(), a));
    expect(stats.textures).toBe(1);
    expect(stats.textureBytes).toBe(estimateTextureBytes(texture));
  });
});

describe("estimateTextureBytes", () => {
  it("uses real mip sizes for compressed (KTX2) textures", () => {
    const mipmaps = [
      { data: new Uint8Array(1024), width: 32, height: 32 },
      { data: new Uint8Array(256), width: 16, height: 16 },
    ];
    const texture = new CompressedTexture(mipmaps, 32, 32);
    expect(estimateTextureBytes(texture)).toBe(1280);
  });

  it("assumes RGBA8 with a mip chain for other textures", () => {
    const texture = new DataTexture(new Uint8Array(4 * 64 * 64), 64, 64);
    texture.generateMipmaps = true;
    expect(estimateTextureBytes(texture)).toBe(Math.round(64 * 64 * 4 * (4 / 3)));
  });
});
