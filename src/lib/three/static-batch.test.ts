import {
  AdditiveBlending,
  BoxGeometry,
  Color,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  MeshStandardMaterial,
  type Object3D,
  SkinnedMesh,
  Vector3,
} from "three";
import { describe, expect, it } from "vitest";

import { batchStatic } from "./static-batch";

const meshes = (root: Object3D) => {
  const out: Mesh[] = [];
  root.traverse((o) => {
    if ((o as Mesh).isMesh) out.push(o as Mesh);
  });
  return out;
};

const worldBounds = (root: Object3D) => {
  root.updateMatrixWorld(true);
  const min = new Vector3(Infinity, Infinity, Infinity);
  const max = new Vector3(-Infinity, -Infinity, -Infinity);
  const v = new Vector3();
  for (const mesh of meshes(root)) {
    const position = mesh.geometry.attributes.position!;
    for (let i = 0; i < position.count; i++) {
      v.fromBufferAttribute(position, i).applyMatrix4(mesh.matrixWorld);
      min.min(v);
      max.max(v);
    }
  }
  return { min, max };
};

describe("static batching", () => {
  it("merges meshes that share a material into one, keeping every vertex in place", () => {
    const root = new Group();
    root.position.set(5, 0, 0);
    const material = new MeshStandardMaterial({ color: "#808080" });
    const group = new Group();
    group.rotation.y = 0.7;
    root.add(group);
    for (let i = 0; i < 4; i++) {
      const mesh = new Mesh(new BoxGeometry(1, 2, 3), material);
      mesh.position.set(i * 3, i, -i);
      mesh.scale.set(1, 1 + i * 0.5, 1);
      group.add(mesh);
    }
    const before = worldBounds(root);
    const result = batchStatic(root);
    expect(result).toEqual({ meshesBefore: 4, meshesAfter: 1 });
    expect(meshes(root)).toHaveLength(1);
    expect(meshes(root)[0]!.material).toBe(material); // same instance, nothing folded
    const after = worldBounds(root);
    expect(after.min.distanceTo(before.min)).toBeLessThan(1e-4);
    expect(after.max.distanceTo(before.max)).toBeLessThan(1e-4);
  });

  it("folds colour-only material differences into vertex colours (same product)", () => {
    const root = new Group();
    const red = new MeshLambertMaterial({ color: "#ff0000" });
    const blue = new MeshLambertMaterial({ color: "#0000ff" });
    root.add(new Mesh(new BoxGeometry(), red), new Mesh(new BoxGeometry(), blue));
    batchStatic(root);
    const [merged] = meshes(root);
    const material = merged!.material as MeshLambertMaterial;
    expect(material.vertexColors).toBe(true);
    expect(material.color.getHex()).toBe(0xffffff);
    const colors = merged!.geometry.attributes.color!;
    expect([colors.getX(0), colors.getY(0), colors.getZ(0)]).toEqual([red.color.r, red.color.g, red.color.b]);
    const last = colors.count - 1;
    expect([colors.getX(last), colors.getY(last), colors.getZ(last)]).toEqual([blue.color.r, blue.color.g, blue.color.b]);
  });

  it("folds roughness, metalness and emissive of standard materials into per-vertex factors", () => {
    const root = new Group();
    const matte = new MeshStandardMaterial({ roughness: 0.9, metalness: 0 });
    const steel = new MeshStandardMaterial({ roughness: 0.3, metalness: 0.8, emissive: "#ff8000", emissiveIntensity: 2 });
    root.add(new Mesh(new BoxGeometry(), matte), new Mesh(new BoxGeometry(), steel));
    batchStatic(root);
    const [merged] = meshes(root);
    const material = merged!.material as MeshStandardMaterial;
    expect([material.roughness, material.metalness, material.emissiveIntensity]).toEqual([1, 1, 1]);
    expect(material.customProgramCacheKey()).toBe("bsr-batch-surface");
    const surface = merged!.geometry.attributes.batchSurface!;
    const emissive = merged!.geometry.attributes.batchEmissive!;
    const last = surface.count - 1;
    // Float32 attributes: the same precision the GPU gets from the uniform.
    expect(surface.getX(0)).toBeCloseTo(0.9);
    expect(surface.getY(0)).toBe(0);
    expect(surface.getX(last)).toBeCloseTo(0.3);
    expect(surface.getY(last)).toBeCloseTo(0.8);
    const glow = new Color("#ff8000").multiplyScalar(2);
    expect(emissive.getX(last)).toBeCloseTo(glow.r);
    expect(emissive.getY(last)).toBeCloseTo(glow.g);
  });

  it("never folds or clones a kept (runtime-driven) material", () => {
    const root = new Group();
    const lamp = new MeshStandardMaterial({ emissive: "#ffffff" });
    const other = new MeshStandardMaterial({ emissive: "#ffffff", color: "#333333" });
    root.add(new Mesh(new BoxGeometry(), lamp), new Mesh(new BoxGeometry(), lamp), new Mesh(new BoxGeometry(), other));
    batchStatic(root, { keep: [lamp] });
    const materials = meshes(root).map((m) => m.material);
    expect(materials).toContain(lamp); // the two lamp meshes merged on the kept instance
    expect(meshes(root)).toHaveLength(2);
  });

  it("expands instanced meshes, folding per-instance colours", () => {
    const root = new Group();
    const instanced = new InstancedMesh(new BoxGeometry(), new MeshLambertMaterial({ color: "#ffffff" }), 3);
    const tint = new Color("#20a040");
    for (let i = 0; i < 3; i++) {
      instanced.setMatrixAt(i, new Matrix4().makeTranslation(i * 2, 0, 0));
      instanced.setColorAt(i, tint);
    }
    root.add(instanced, new Mesh(new BoxGeometry(), new MeshLambertMaterial({ color: "#ffffff" })));
    batchStatic(root);
    const [merged] = meshes(root);
    expect((merged as InstancedMesh).isInstancedMesh).toBeFalsy();
    const colors = merged!.geometry.attributes.color!;
    expect(colors.getY(0)).toBeCloseTo(tint.g);
    expect(worldBounds(root).max.x).toBeCloseTo(4.5);
  });

  it("skins moving parts to their nodes, so the merged mesh follows the rig", () => {
    const root = new Group();
    const wheel = new Group();
    wheel.position.set(2, 0, 0);
    root.add(wheel);
    const material = new MeshStandardMaterial();
    root.add(new Mesh(new BoxGeometry(1, 1, 1), material));
    const spoke = new Mesh(new BoxGeometry(0.1, 1, 0.1), material);
    spoke.position.set(0, 0.5, 0); // tip at (2, 1, 0) in world space
    wheel.add(spoke);
    batchStatic(root, { bones: [wheel] });
    const [merged] = meshes(root) as SkinnedMesh[];
    expect(merged!.isSkinnedMesh).toBe(true);
    // Turn the wheel a quarter: the spoke's top must swing to +/-X around the wheel centre.
    wheel.rotation.z = -Math.PI / 2;
    root.updateMatrixWorld(true);
    merged!.skeleton.update();
    const position = merged!.geometry.attributes.position!;
    const skinIndex = merged!.geometry.attributes.skinIndex!;
    let maxX = -Infinity;
    const v = new Vector3();
    for (let i = 0; i < position.count; i++) {
      if (skinIndex.getX(i) !== 1) continue;
      merged!.getVertexPosition(i, v).applyMatrix4(merged!.matrixWorld);
      maxX = Math.max(maxX, v.x);
    }
    expect(maxX).toBeCloseTo(3, 4); // 2 (centre) + 1 (spoke length, now along +X)
  });

  it("keeps the front faces of mirrored parts", () => {
    const root = new Group();
    const material = new MeshBasicMaterial();
    const a = new Mesh(new BoxGeometry(), material);
    const b = new Mesh(new BoxGeometry(), material);
    b.scale.x = -1;
    b.position.x = 3;
    root.add(a, b);
    batchStatic(root);
    const geometry = meshes(root)[0]!.geometry;
    const index = geometry.index!;
    const position = geometry.attributes.position!;
    const normal = geometry.attributes.normal!;
    const [p0, p1, p2, n] = [new Vector3(), new Vector3(), new Vector3(), new Vector3()];
    // Every triangle's winding agrees with its (transformed) vertex normal.
    for (let t = 0; t < index.count; t += 3) {
      p0.fromBufferAttribute(position, index.getX(t));
      p1.fromBufferAttribute(position, index.getX(t + 1));
      p2.fromBufferAttribute(position, index.getX(t + 2));
      n.fromBufferAttribute(normal, index.getX(t));
      const face = p1.sub(p0).cross(p2.sub(p0));
      expect(face.dot(n)).toBeGreaterThan(0);
    }
  });

  it("leaves alone what must keep its own draw: blending order, render hooks, hidden parts", () => {
    const root = new Group();
    const glass = new MeshStandardMaterial({ transparent: true, opacity: 0.5 });
    const glow = new MeshBasicMaterial({ transparent: true, blending: AdditiveBlending, depthWrite: false });
    const hooked = new Mesh(new BoxGeometry(), new MeshStandardMaterial());
    hooked.onBeforeRender = () => {};
    const hidden = new Mesh(new BoxGeometry(), new MeshStandardMaterial());
    hidden.visible = false;
    root.add(
      new Mesh(new BoxGeometry(), glass),
      new Mesh(new BoxGeometry(), glass),
      new Mesh(new BoxGeometry(), glow),
      new Mesh(new BoxGeometry(), glow),
      hooked,
      hidden,
      new Mesh(new BoxGeometry(), new MeshStandardMaterial()),
    );
    batchStatic(root);
    const left = meshes(root);
    expect(left.filter((m) => m.material === glass)).toHaveLength(2); // alpha-blended: untouched
    expect(left.filter((m) => m.material === glow)).toHaveLength(1); // additive: order-free, merged
    expect(left).toContain(hooked);
    expect(left).toContain(hidden);
  });
});
