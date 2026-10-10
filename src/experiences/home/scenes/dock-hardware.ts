import {
  BoxGeometry,
  CylinderGeometry,
  DataTexture,
  DoubleSide,
  Group,
  InstancedMesh,
  LinearFilter,
  LinearMipmapLinearFilter,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  RepeatWrapping,
  SRGBColorSpace,
} from "three";

/*
 * Construction evidence for the dock world: the physical systems a photographed
 * logistics facility carries and a bare box does not — eaves gutter with downpipes,
 * wall-pack lanterns (housing + bracket + emissive lens), bay-number plates, a
 * personnel door with hardware, utility cabinets and conduit, dock bumpers, capped
 * bollards on base plates, and yard lamp columns with base plate, access hatch, arm
 * and luminaire housing. Everything is instanced per part family (few draw calls).
 * Emissive parts read `lampGlow` so they follow the dock light story.
 */

interface HardwareOptions {
  facadeX: number;
  buildingZ: readonly [number, number];
  buildingHeight: number;
  doorZ: readonly number[];
  litDoorZ: number;
  lampGlow: MeshStandardMaterial;
}

const matrix = new Matrix4();

function instanced(
  geometry: BoxGeometry | CylinderGeometry | PlaneGeometry,
  material: MeshStandardMaterial,
  count: number,
  name: string,
) {
  const mesh = new InstancedMesh(geometry, material, count);
  mesh.name = name;
  mesh.castShadow = mesh.receiveShadow = true;
  return mesh;
}

export function createDockHardware({
  facadeX,
  buildingZ,
  buildingHeight,
  doorZ,
  litDoorZ,
  lampGlow,
}: HardwareOptions): Group {
  const group = new Group();
  group.name = "Dock_Hardware";
  const galv = new MeshStandardMaterial({ color: "#8d9296", metalness: 0.7, roughness: 0.45 });
  const dark = new MeshStandardMaterial({ color: "#1d2022", metalness: 0.4, roughness: 0.6 });
  const cabinet = new MeshStandardMaterial({ color: "#596064", metalness: 0.3, roughness: 0.55 });
  const plate = new MeshStandardMaterial({ color: "#c9ccc6", roughness: 0.6 });
  const yellow = new MeshStandardMaterial({ color: "#b8890f", roughness: 0.4, metalness: 0.1 });
  const rubber = new MeshStandardMaterial({ color: "#0d0d0e", roughness: 0.9 });

  const length = buildingZ[1] - buildingZ[0];
  const midZ = (buildingZ[0] + buildingZ[1]) / 2;

  // Eaves gutter (galvanised) and coping on the parapet.
  const gutter = new Mesh(new BoxGeometry(0.26, 0.18, length), galv);
  gutter.name = "Dock_Gutter";
  gutter.position.set(facadeX - 0.15, buildingHeight - 1.3, midZ);
  const coping = new Mesh(new BoxGeometry(0.5, 0.16, length + 0.4), galv);
  coping.name = "Dock_Coping";
  coping.position.set(facadeX - 0.12, buildingHeight + 0.02, midZ);
  group.add(gutter, coping);

  // Downpipes between doors, with brackets and a wall-wash stain plate below.
  const pipeZ = [-52, -36, -20, -4].filter((z) => Math.abs(z - litDoorZ) > 3);
  const pipes = instanced(
    new CylinderGeometry(0.06, 0.06, buildingHeight - 1.5, 8),
    galv,
    pipeZ.length,
    "Dock_Downpipes",
  );
  const stains = instanced(new BoxGeometry(0.01, 3.2, 0.5), dark, pipeZ.length, "Dock_Stains");
  (stains.material as MeshStandardMaterial).transparent = true;
  (stains.material as MeshStandardMaterial).opacity = 0.22;
  stains.castShadow = false;
  pipeZ.forEach((z, i) => {
    pipes.setMatrixAt(
      i,
      matrix.makeTranslation(facadeX - 0.2, (buildingHeight - 1.5) / 2 + 0.1, z),
    );
    stains.setMatrixAt(i, matrix.makeTranslation(facadeX - 0.03, 1.8, z));
  });
  group.add(pipes, stains);

  // Wall-pack lanterns over every door: housing, bracket, emissive lens facing down and out.
  const packs = instanced(
    new BoxGeometry(0.34, 0.3, 0.95),
    cabinet,
    doorZ.length,
    "Dock_WallPack_Housing",
  );
  const lens = new InstancedMesh(new BoxGeometry(0.05, 0.17, 0.82), lampGlow, doorZ.length);
  lens.name = "Dock_WallPack_Lens";
  const plates = instanced(
    new BoxGeometry(0.05, 0.36, 0.55),
    plate,
    doorZ.length,
    "Dock_Bay_Plates",
  );
  doorZ.forEach((z, i) => {
    packs.setMatrixAt(i, matrix.makeTranslation(facadeX - 0.32, 5.6, z));
    lens.setMatrixAt(i, matrix.makeTranslation(facadeX - 0.5, 5.53, z));
    plates.setMatrixAt(i, matrix.makeTranslation(facadeX - 0.04, 5.0, z + 0.05));
  });
  group.add(packs, lens, plates);

  // Rubber bumpers beside each opening (compressed, scuffed).
  const bumperZ = doorZ.flatMap((z) => [z - 1.62, z + 1.62]);
  const bumpers = instanced(
    new BoxGeometry(0.22, 0.5, 0.2),
    rubber,
    bumperZ.length,
    "Dock_Bumpers_Rubber",
  );
  bumperZ.forEach((z, i) => bumpers.setMatrixAt(i, matrix.makeTranslation(facadeX - 0.12, 1.1, z)));
  group.add(bumpers);

  // Personnel door at the far end + two utility cabinets with conduit.
  const pdoor = new Mesh(new BoxGeometry(0.1, 2.1, 1.0), dark);
  pdoor.position.set(facadeX - 0.05, 1.05, buildingZ[0] + 4);
  const handle = new Mesh(new BoxGeometry(0.06, 0.06, 0.2), galv);
  handle.position.set(facadeX - 0.12, 1.05, buildingZ[0] + 4.35);
  const cabinetA = new Mesh(new BoxGeometry(0.5, 1.8, 1.1), cabinet);
  cabinetA.position.set(facadeX - 0.3, 0.9, buildingZ[1] - 3);
  const cabinetB = new Mesh(new BoxGeometry(0.4, 1.2, 0.8), cabinet);
  cabinetB.position.set(facadeX - 0.25, 0.6, buildingZ[0] + 8);
  const conduit = new Mesh(new CylinderGeometry(0.035, 0.035, 4.2, 6), dark);
  conduit.position.set(facadeX - 0.06, 2.3, buildingZ[1] - 3.6);
  group.add(pdoor, handle, cabinetA, cabinetB, conduit);

  // Bollards: capped steel pipe on a bolted base plate, dark scuff band at bumper height.
  const bollardZ = doorZ.flatMap((z) => [z - 1.9, z + 1.9]);
  const bollards = instanced(
    new CylinderGeometry(0.13, 0.13, 1.1, 14),
    yellow,
    bollardZ.length,
    "Dock_Bollards_Yellow",
  );
  const bands = instanced(
    new CylinderGeometry(0.135, 0.135, 0.28, 14),
    dark,
    bollardZ.length,
    "Dock_Bollard_Scuff",
  );
  const caps = instanced(
    new CylinderGeometry(0.1, 0.13, 0.05, 14),
    dark,
    bollardZ.length,
    "Dock_Bollard_Caps",
  );
  const bases = instanced(
    new CylinderGeometry(0.24, 0.24, 0.04, 14),
    galv,
    bollardZ.length,
    "Dock_Bollard_Bases",
  );
  bollardZ.forEach((z, i) => {
    bollards.setMatrixAt(i, matrix.makeTranslation(facadeX - 1.5, 0.55, z));
    bands.setMatrixAt(i, matrix.makeTranslation(facadeX - 1.5, 0.62, z));
    caps.setMatrixAt(i, matrix.makeTranslation(facadeX - 1.5, 1.12, z));
    bases.setMatrixAt(i, matrix.makeTranslation(facadeX - 1.5, 0.02, z));
  });
  group.add(bollards, bands, caps, bases);
  return group;
}

/** Yard lamp column pieces for the given ground positions: hatch, base plate, arm, housing, lens. */
export function createLampColumns(
  positions: ReadonlyArray<readonly [number, number]>,
  lampGlow: MeshStandardMaterial,
): Group {
  const group = new Group();
  group.name = "Yard_Lamp_Columns";
  const galv = new MeshStandardMaterial({ color: "#6f7478", metalness: 0.7, roughness: 0.5 });
  const dark = new MeshStandardMaterial({ color: "#26292b", metalness: 0.4, roughness: 0.55 });
  const n = positions.length;
  const bases = instanced(new CylinderGeometry(0.3, 0.3, 0.05, 10), galv, n, "Yard_Lamp_Bases");
  const hatches = instanced(new BoxGeometry(0.2, 0.55, 0.05), dark, n, "Yard_Lamp_Hatches");
  const arms = instanced(new BoxGeometry(1.8, 0.09, 0.09), galv, n, "Yard_Lamp_Arms");
  const housings = instanced(new BoxGeometry(1.0, 0.16, 0.42), dark, n, "Yard_Lamp_Housings");
  const lenses = new InstancedMesh(new BoxGeometry(0.86, 0.02, 0.32), lampGlow, n);
  lenses.name = "Yard_Lamp_Lenses";
  positions.forEach(([x, z], i) => {
    bases.setMatrixAt(i, matrix.makeTranslation(x, 0.025, z));
    hatches.setMatrixAt(i, matrix.makeTranslation(x, 0.9, z + 0.13));
    arms.setMatrixAt(i, matrix.makeTranslation(x + 0.9, 9.85, z));
    housings.setMatrixAt(i, matrix.makeTranslation(x + 1.75, 9.8, z));
    lenses.setMatrixAt(i, matrix.makeTranslation(x + 1.75, 9.71, z));
  });
  group.add(bases, hatches, arms, housings, lenses);
  return group;
}

/**
 * The two industrial blocks along the exit road (x = centre, 24 m deep; z0 → z1 along the
 * road). They begin past every opening/reveal camera position (hero-camera.test.ts): from
 * z = 22 the near block stood where the portrait camera is (the camera saw its dock
 * shelters from inside it as a dark slab across the poster) and 0.2 m from the wide one.
 */
export const YARD_BLOCKS = [
  { x: -22, z0: 52, z1: 230, height: 10.5 },
  { x: 24, z0: 45, z1: 250, height: 12 },
] as const;
export const YARD_BLOCK_DEPTH = 24;

/**
 * Yard-exit environs for the Departure beat: a security fence with posts and mesh along
 * the exit road, kerbs, a row of lamp columns, and two low industrial blocks (cladding,
 * lit window strips, dock lights, parapet) receding on either side so the yard has depth
 * and reads as an estate road, not an empty plane.
 */
export function createYardEnvirons(
  cladding: MeshStandardMaterial,
  lampGlow: MeshStandardMaterial,
): Group {
  const group = new Group();
  group.name = "Yard_Environs";
  const galv = new MeshStandardMaterial({ color: "#7d8286", metalness: 0.7, roughness: 0.5 });
  const kerb = new MeshStandardMaterial({ color: "#6d6f6e", roughness: 0.85 });
  const zs: number[] = [];
  for (let z = 55; z <= 200; z += 3) zs.push(z);
  // Fence: posts + top/bottom rails + a diamond-mesh alpha panel per span.
  const meshTex = (() => {
    const size = 64;
    const data = new Uint8Array(size * size * 4);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const d1 = Math.abs(((x + y) % 16) - 8) < 1.1 ? 1 : 0;
        const d2 = Math.abs(((x - y + 64) % 16) - 8) < 1.1 ? 1 : 0;
        const i = (y * size + x) * 4;
        data[i] = data[i + 1] = data[i + 2] = 150;
        data[i + 3] = d1 || d2 ? 255 : 0;
      }
    }
    return data;
  })();
  const fenceMap = new DataTexture(meshTex, 64, 64);
  fenceMap.wrapS = fenceMap.wrapT = RepeatWrapping;
  fenceMap.magFilter = LinearFilter;
  fenceMap.minFilter = LinearMipmapLinearFilter;
  fenceMap.generateMipmaps = true;
  fenceMap.repeat.set(3 / 0.4, 2 / 0.4);
  fenceMap.colorSpace = SRGBColorSpace;
  fenceMap.needsUpdate = true;
  const fenceMat = new MeshStandardMaterial({
    color: "#8d9296",
    map: fenceMap,
    alphaTest: 0.5,
    side: DoubleSide,
    metalness: 0.5,
    roughness: 0.6,
  });
  for (const x of [-10.5, 10.5]) {
    const posts = instanced(new BoxGeometry(0.08, 2.2, 0.08), galv, zs.length, "Yard_Fence_Posts");
    const caps = instanced(new BoxGeometry(0.11, 0.05, 0.11), galv, zs.length, "Yard_Fence_Caps");
    const spans = instanced(new PlaneGeometry(3, 2), fenceMat, zs.length, "Yard_Fence_Mesh");
    spans.castShadow = false;
    const rails = instanced(
      new BoxGeometry(0.04, 0.04, 3),
      galv,
      zs.length * 2,
      "Yard_Fence_Rails",
    );
    const footings = instanced(
      new BoxGeometry(0.3, 0.2, 0.3),
      kerb,
      zs.length,
      "Yard_Fence_Footings",
    );
    zs.forEach((z, i) => {
      posts.setMatrixAt(i, matrix.makeTranslation(x, 1.1, z));
      caps.setMatrixAt(i, matrix.makeTranslation(x, 2.225, z));
      footings.setMatrixAt(i, matrix.makeTranslation(x, 0.1, z));
      spans.setMatrixAt(i, matrix.makeRotationY(Math.PI / 2).setPosition(x, 1.1, z + 1.5));
      rails.setMatrixAt(i * 2, matrix.makeTranslation(x, 2.15, z + 1.5));
      rails.setMatrixAt(i * 2 + 1, matrix.makeTranslation(x, 0.15, z + 1.5));
    });
    group.add(posts, caps, spans, rails, footings);
  }
  // Kerbs along both edges of the exit road.
  for (const x of [-4.1, 4.1]) {
    const k = new Mesh(new BoxGeometry(0.18, 0.15, 150), kerb);
    k.position.set(x, 0.075, 100);
    k.receiveShadow = true;
    group.add(k);
  }
  // Lamp columns along the road.
  const lampPos: Array<[number, number]> = [];
  for (let z = 40; z <= 160; z += 30) {
    lampPos.push([-7, z], [7, z + 15]);
  }
  const poles = instanced(
    new CylinderGeometry(0.09, 0.14, 9.8, 8),
    galv,
    lampPos.length,
    "Yard_Road_Poles",
  );
  lampPos.forEach(([x, z], i) => poles.setMatrixAt(i, matrix.makeTranslation(x, 4.9, z)));
  group.add(poles, createLampColumns(lampPos, lampGlow));
  // Two long industrial blocks receding on each side.
  const block = (x: number, z0: number, z1: number, h: number) => {
    const g = new Group();
    const body = new Mesh(new BoxGeometry(YARD_BLOCK_DEPTH, h, z1 - z0), cladding);
    body.position.set(x, h / 2, (z0 + z1) / 2);
    const coping = new Mesh(new BoxGeometry(24.4, 0.3, z1 - z0 + 0.4), galv);
    coping.position.set(x, h + 0.15, (z0 + z1) / 2);
    const winMat = lampGlow;
    const face = x > 0 ? -1 : 1;
    const strip = new Mesh(new BoxGeometry(0.06, 0.9, (z1 - z0) * 0.8), winMat);
    strip.position.set(x + face * 12.03, 3.2, (z0 + z1) / 2);
    const dockMat = new MeshStandardMaterial({ color: "#3b4148", roughness: 0.6, metalness: 0.4 });
    const docks = instanced(new BoxGeometry(0.1, 3.4, 3.2), dockMat, 10, "Yard_Block_Doors");
    const shelters = instanced(
      new BoxGeometry(0.5, 3.8, 3.6),
      new MeshStandardMaterial({ color: "#101214", roughness: 0.85 }),
      10,
      "Yard_Block_Shelters",
    );
    for (let i = 0; i < 10; i++) {
      const dz = z0 + 6 + i * ((z1 - z0 - 12) / 9);
      docks.setMatrixAt(i, matrix.makeTranslation(x + face * 12.05, 1.7, dz));
      shelters.setMatrixAt(i, matrix.makeTranslation(x + face * 12.25, 1.9, dz));
    }
    // Downpipes off the eaves gutter, at intervals along the length.
    const pipes = instanced(
      new CylinderGeometry(0.05, 0.05, h - 1.3, 8),
      galv,
      Math.max(2, Math.floor((z1 - z0) / 24)),
      "Yard_Block_Downpipes",
    );
    const pn = pipes.instanceMatrix.count;
    for (let i = 0; i < pn; i++)
      pipes.setMatrixAt(
        i,
        matrix.makeTranslation(
          x + face * 12.15,
          (h - 1.3) / 2,
          z0 + 10 + i * ((z1 - z0 - 20) / Math.max(1, pn - 1)),
        ),
      );
    // Roof plant: a few HVAC/vent boxes so the roofline is not a bare slab.
    const plant = instanced(
      new BoxGeometry(1.8, 1.0, 1.4),
      new MeshStandardMaterial({ color: "#9aa0a4", roughness: 0.55, metalness: 0.3 }),
      Math.max(2, Math.floor((z1 - z0) / 30)),
      "Yard_Block_Plant",
    );
    const pc = plant.instanceMatrix.count;
    for (let i = 0; i < pc; i++)
      plant.setMatrixAt(
        i,
        matrix.makeTranslation(
          x + face * 4,
          h + 0.65,
          z0 + 12 + i * ((z1 - z0 - 24) / Math.max(1, pc - 1)),
        ),
      );
    g.add(body, coping, strip, docks, shelters, pipes, plant);
    return g;
  };
  group.add(...YARD_BLOCKS.map((b) => block(b.x, b.z0, b.z1, b.height)));
  // Vehicle gate midway along the west fence run: two heavier gate posts, a sliding-gate
  // leaf (mesh-filled frame) and a track rail — the fence reads as an operated boundary.
  {
    const gz = 75;
    const gatePostMat = new MeshStandardMaterial({
      color: "#6a6e70",
      metalness: 0.6,
      roughness: 0.5,
    });
    for (const dz of [-2.2, 2.2]) {
      const post = new Mesh(new BoxGeometry(0.16, 2.6, 0.16), gatePostMat);
      post.position.set(-10.5, 1.3, gz + dz);
      group.add(post);
    }
    const leaf = new Mesh(new PlaneGeometry(4.2, 2.2), fenceMat);
    leaf.position.set(-10.5, 1.2, gz);
    leaf.rotation.y = Math.PI / 2;
    const leafFrame = new Mesh(new BoxGeometry(0.06, 2.3, 4.3), gatePostMat);
    leafFrame.position.set(-10.5, 1.2, gz);
    const track = new Mesh(new BoxGeometry(0.1, 0.04, 4.4), gatePostMat);
    track.position.set(-10.5, 0.02, gz);
    group.add(leaf, leafFrame, track);
  }
  // Adjacent annex / office blocks along the horizon behind the yard (Preparation & Ready):
  // long low buildings facing the yard with lit window strips, dock doors, wall-pack lamps,
  // parapet coping and roof plant — the yard sits inside a facility, not an empty plane.
  const annex = (xc: number, zc: number, len: number, h: number, seed: number) => {
    const g = new Group();
    const r = (k: number) => {
      const v = Math.sin(seed * 12.9898 + k * 78.233) * 43758.5453;
      return v - Math.floor(v);
    };
    const body = new Mesh(new BoxGeometry(len, h, 18), cladding);
    body.position.set(xc, h / 2, zc);
    const coping = new Mesh(new BoxGeometry(len + 0.4, 0.3, 18.4), galv);
    coping.position.set(xc, h + 0.15, zc);
    g.add(body, coping);
    const face = zc < 0 ? 1 : -1; // faces the yard (towards z = 0)
    const zf = zc + face * 9.04;
    const win = instanced(
      new BoxGeometry(2.2, 1.1, 0.08),
      lampGlow,
      Math.floor(len / 5),
      "Annex_Windows",
    );
    const doorsM = instanced(
      new BoxGeometry(3, 3.4, 0.1),
      new MeshStandardMaterial({ color: "#39404a", roughness: 0.6, metalness: 0.4 }),
      Math.floor(len / 8),
      "Annex_Doors",
    );
    const packs = instanced(
      new BoxGeometry(0.7, 0.2, 0.3),
      lampGlow,
      Math.floor(len / 8),
      "Annex_Packs",
    );
    for (let i = 0; i < win.count; i++) {
      const lit = r(i) > 0.35;
      win.setMatrixAt(
        i,
        matrix
          .makeTranslation(xc - len / 2 + 3 + i * 5, h - 2.2, zf)
          .scale({ x: lit ? 1 : 0.001, y: 1, z: 1 } as never),
      );
    }
    for (let i = 0; i < doorsM.count; i++) {
      doorsM.setMatrixAt(i, matrix.makeTranslation(xc - len / 2 + 4 + i * 8, 1.7, zf));
      packs.setMatrixAt(i, matrix.makeTranslation(xc - len / 2 + 4 + i * 8, 4.6, zf + face * 0.2));
    }
    for (let i = 0; i < 4; i++) {
      const w = 1.5 + r(20 + i) * 2.5;
      const u = new Mesh(new BoxGeometry(w, 1.2, w * 0.7), cladding);
      u.position.set(
        xc - len / 2 + 6 + r(30 + i) * (len - 12),
        h + 0.6,
        zc + (r(40 + i) - 0.5) * 8,
      );
      g.add(u);
    }
    g.add(win, doorsM, packs);
    return g;
  };
  group.add(annex(-52, -150, 80, 9, 1), annex(-135, -138, 70, 11, 2), annex(35, -165, 60, 8, 3));
  return group;
}
