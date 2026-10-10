import {
  CanvasTexture,
  type Camera,
  DoubleSide,
  Group,
  InstancedBufferAttribute,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  type Object3D,
  PlaneGeometry,
  Quaternion,
  RepeatWrapping,
  type Texture,
  Vector3,
} from "three";

import { batchStatic } from "@/lib/three/static-batch";

import { REAL_BUILDINGS } from "./road-buildings";

/*
 * Gate B — the journey's cinematic world beyond the realtime road.
 *
 * Mid- and background set pieces are pre-rendered impostor cards (Blender,
 * tools/blender/build_roadkit.py): camera-matched to the road-tracking view,
 * lit by the same low sunrise, with baked contact shadows. Each card stands
 * upright at its set piece's ground anchor, at real-world scale, and turns
 * about its vertical axis to face the camera; the tracking camera only sees
 * them within a narrow cone ahead, so the baked view stays valid.
 *
 * Chapters (A industrial outskirts → B service corridor → C open road) change
 * without anything moving backwards: a slot beyond SWAP_DISTANCE (small, deep
 * in the haze) cross-dissolves to the current chapter's card as soon as the
 * chapter changes; nearer set pieces keep their identity until they have
 * passed and respawn on the horizon. Scrolling back simply re-dresses the
 * distance again — the world keeps arriving from ahead.
 */

export interface CardMeta {
  atlas: "RK_Atlas_Built" | "RK_Atlas_Nature";
  /** Atlas rect (u0, v0, u1, v1), v from the image top (glTF convention). */
  uv: [number, number, number, number];
  /** Real-world size (m). */
  size: [number, number];
  /** Ground anchor within the card (fraction from left, fraction from top). */
  anchor: [number, number];
}

export interface RoadKit {
  atlases: Record<CardMeta["atlas"], Texture>;
  cards: Map<string, CardMeta>;
  road: { map: Texture; normalMap: Texture | null; roughnessMap: Texture | null };
  /** The baked road tile: carriageway x-range and length along the road (m). */
  roadTile: { x0: number; x1: number; length: number };
  /** Top-down farmland (the Reach rise's ground, approved reference 08's aerial character). */
  aerial: Texture;
  /** Approved photographic horizon plates for each journey chapter (references 01–03). */
  plates: { A: Texture; B: Texture; C: Texture };
  /** Camera-matched warehouse depth plate for the dock's lit bay (reference 05). */
  interior: Texture;
}

/** Reads the road-kit GLB scene (textures, card metadata) into a RoadKit. */
export function readRoadKit(scene: Object3D): RoadKit {
  const textures = new Map<string, MeshBasicMaterial>();
  const cards = new Map<string, CardMeta>();
  let roadTile: RoadKit["roadTile"] | null = null;
  scene.traverse((object) => {
    const material = (object as { material?: MeshBasicMaterial }).material;
    if (material && object.name.startsWith("RK_")) textures.set(object.name, material);
    if (typeof object.userData.card === "string") {
      cards.set(object.name.replace(/^Card_/, ""), JSON.parse(object.userData.card) as CardMeta);
    }
    if (typeof object.userData.road === "string") roadTile = JSON.parse(object.userData.road);
  });
  const map = (name: string) => {
    const texture = textures.get(name)?.map;
    if (!texture) throw new Error(`road kit: missing ${name} texture`);
    return texture;
  };
  const road = textures.get("RK_Road") as unknown as {
    map: Texture;
    normalMap: Texture | null;
    roughnessMap: Texture | null;
  };
  if (!road?.map || !roadTile) throw new Error("road kit: missing road surface");
  for (const texture of [road.map, road.normalMap, road.roughnessMap]) {
    if (texture) texture.wrapS = texture.wrapT = RepeatWrapping;
  }
  return {
    atlases: { RK_Atlas_Built: map("RK_Atlas_Built"), RK_Atlas_Nature: map("RK_Atlas_Nature") },
    cards,
    road: { map: road.map, normalMap: road.normalMap, roughnessMap: road.roughnessMap },
    roadTile,
    aerial: map("RK_Aerial"),
    plates: { A: map("RK_Plate_A"), B: map("RK_Plate_B"), C: map("RK_Plate_C") },
    interior: map("RK_Interior"),
  };
}

// ---------------------------------------------------------------- chapters and slots
/** Journey coordinate: 0–1 industrial (A), 1–2 service corridor (B), 2–3 open road (C). */
export type Chapter = "A" | "B1" | "B2" | "C" | "Reach";

export function chapterOf(journey: number): Chapter {
  if (journey < 1) return "A";
  if (journey < 1.5) return "B1";
  if (journey < 2) return "B2";
  if (journey < 2.7) return "C";
  return "Reach";
}

/** Weighted card choices per chapter ("" = leave the slot empty). */
type Choices = Partial<Record<Chapter, ReadonlyArray<[string, number]>>>;

interface SlotSpec {
  x: number;
  z0: number;
  window: number;
  choices: Choices;
  /** Scale jitter range. */
  scale?: [number, number];
  /** Dissolve out closer than this (m ahead): impostors never pass close to the camera. */
  near?: number;
  /**
   * Signature set piece: when its chapter begins it enters at this distance
   * ahead (dissolving in, then flowing past), whatever the road flow position.
   */
  entry?: number;
}

const TREES: ReadonlyArray<[string, number]> = [
  ["tree_a", 3],
  ["tree_b", 3],
  ["poplar_a", 2],
  ["poplar_b", 2],
  ["hedge", 2],
  ["shrub", 2],
];

/** Scenery layout: lateral bands either side of the road (truck left = +X). */
function slots(): SlotSpec[] {
  const out: SlotSpec[] = [];
  // Near verge vegetation (both sides), densest on the open road.
  for (let i = 0; i < 26; i++) {
    const left = i % 2 === 0;
    out.push({
      x: left ? 27 + ((i * 7) % 14) : -(9 + ((i * 5) % 12)),
      z0: i * 23.3,
      window: 600,
      choices: {
        A: [
          ["", 1],
          ["shrub", 3],
          ["tree_a", 3],
          ["tree_b", 2],
          ["hedge", 3],
          ["poplar_a", 1],
        ],
        B1: [["", 3], ...TREES],
        B2: [["", 3], ...TREES],
        C: [["", 2], ...TREES, ["poplar_a", 3]],
        Reach: [
          ["", 8],
          ["shrub", 1],
          ["tree_a", 1],
        ],
      },
      scale: [0.85, 1.2],
    });
  }
  // Mid band: buildings and yards (mostly on the visible left side).
  const mid: Choices = {
    A: [
      ["warehouse_long", 3],
      ["distribution", 3],
      ["yard_trailers", 2],
      ["low_shed", 1],
      ["pylon", 1],
      ["tree_group", 2],
    ],
    B1: [
      ["truck_parking", 2],
      ["tree_group", 2],
      ["", 1],
    ],
    B2: [
      ["restaurant", 2],
      ["truck_parking", 1],
      ["tree_group", 2],
    ],
    C: [
      ["farm_shed", 3],
      ["farmhouse", 3],
      ["poplar_row", 3],
      ["tree_group", 3],
      ["low_shed", 1],
      ["", 1],
    ],
    Reach: [
      ["", 5],
      ["poplar_row", 1],
      ["tree_group", 1],
    ],
  };
  const midX = [85, -80, 120, 70, -115, 150, 95, 130];
  midX.forEach((x, i) =>
    out.push({ x, z0: 40 + i * 112, window: 900, choices: mid, scale: [0.9, 1.1], near: 110 }),
  );
  // Far band: skylines, towns, tree masses (slow parallax).
  const far: Choices = {
    A: [
      ["skyline", 3],
      ["pylon", 1],
    ],
    B1: [
      ["skyline", 1],
      ["tree_group", 2],
    ],
    B2: [
      ["tree_group", 2],
      ["village", 1],
    ],
    C: [
      ["village", 2],
      ["poplar_row", 3],
      ["tree_group", 2],
    ],
    Reach: [
      ["", 4],
      ["poplar_row", 1],
    ],
  };
  const farX = [210, -220, 260, 180, -260, 240];
  farX.forEach((x, i) => out.push({ x, z0: 100 + i * 205, window: 1200, choices: far }));
  // Signature compositions: each chapter opens on a composed set that enters at
  // readable distances (cinematic editing), the random bands fill in around it.
  // Distance (x) is the same realistic building setback as the original pass —
  // moving these large (80–105 m wide) flat cards physically closer broke the
  // billboard illusion (a single fixed-yaw render can't stay convincing for an
  // object that wide viewed from only 25–30 m away; the near and far edges of
  // the same flat plane end up at very different angles). Instead a uniform
  // scale boost reads bigger without any of that distortion.
  const signature: Array<[Chapter, string, number, number, number?]> = [
    // [chapter, card, x, entry distance, scale]
    ["A", "warehouse_long", 34, 200],
    ["A", "yard_trailers", 30, 110],
    ["A", "distribution", 40, 320],
    ["A", "skyline", 190, 560],
    ["A", "warehouse_long", -46, 330],
    ["A", "yard_trailers", -34, 230],
    ["A", "distribution", -80, 520],
    ["A", "warehouse_long", 90, 470],
    ["B1", "fuel_station", 34, 135],
    ["B1", "truck_parking", 36, 280],
    ["B2", "hotel", 36, 170],
    ["B2", "restaurant", 40, 300],
    ["C", "poplar_row", 64, 235],
    ["C", "farmhouse", 34, 150],
    ["C", "village", 150, 340],
  ];
  signature.forEach(([chapter, card, x, entry, scale], i) =>
    out.push({
      x,
      z0: 150 + i * 80,
      window: 900,
      choices: { [chapter]: [[card, 1]] },
      near: 70,
      entry,
      ...(scale ? { scale: [scale, scale] } : {}),
    }),
  );
  return out;
}

/** Beyond this distance ahead (m) a slot may re-dress for the current chapter. */
const SWAP_DISTANCE = 180;

/** Deterministic hash → [0, 1). */
function hash(a: number, b: number): number {
  const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

function pick(choices: ReadonlyArray<[string, number]> | undefined, r: number): string {
  if (!choices || choices.length === 0) return "";
  const total = choices.reduce((sum, [, w]) => sum + w, 0);
  let t = r * total;
  for (const [id, w] of choices) {
    if ((t -= w) < 0) return id;
  }
  return choices[choices.length - 1]![0];
}

// ---------------------------------------------------------------- card rendering
/**
 * One instanced draw per atlas. Per-instance atlas rect and mirror flag are
 * injected into MeshBasicMaterial (so fog and colour management stay three's).
 * Cutout alpha with alpha-to-coverage: soft foliage edges without sorting.
 */
function cardMaterial(atlas: Texture): MeshBasicMaterial {
  atlas.flipY = false;
  const material = new MeshBasicMaterial({
    map: atlas,
    // Baked renders sit slightly into the morning haze (fog then finishes the job).
    color: 0xd9d9d6,
    alphaTest: 0.35,
    alphaToCoverage: true,
    side: DoubleSide,
  });
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        "#include <common>\nattribute vec4 aRect;\nattribute vec2 aCard;\nvarying float vFade;",
      )
      .replace(
        "#include <uv_vertex>",
        `#include <uv_vertex>
        {
          float u = aCard.x > 0.5 ? 1.0 - uv.x : uv.x;
          vMapUv = vec2(mix(aRect.x, aRect.z, u), mix(aRect.y, aRect.w, 1.0 - uv.y));
          vFade = aCard.y;
        }`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\nvarying float vFade;")
      .replace(
        "#include <alphatest_fragment>",
        // Partial-alpha fringe texels carry the bake's pale background: darkened towards the
        // silhouette, so foliage against the sunrise has no bright halo.
        "diffuseColor.rgb *= mix(0.5, 1.0, smoothstep(0.3, 0.92, diffuseColor.a));\ndiffuseColor.a *= vFade;\n#include <alphatest_fragment>",
      );
  };
  material.customProgramCacheKey = () => "bsr-road-card-v2";
  return material;
}

interface CardLayer {
  mesh: InstancedMesh;
  rect: InstancedBufferAttribute;
  card: InstancedBufferAttribute;
}

function cardLayer(atlas: Texture, count: number, name: string): CardLayer {
  // Unit quad from (0, 0) to (1, 1): x right, y up; anchor applied per instance.
  const geometry = new PlaneGeometry(1, 1).translate(0.5, 0.5, 0);
  const rect = new InstancedBufferAttribute(new Float32Array(count * 4), 4);
  const card = new InstancedBufferAttribute(new Float32Array(count * 2), 2);
  geometry.setAttribute("aRect", rect);
  geometry.setAttribute("aCard", card);
  const mesh = new InstancedMesh(geometry, cardMaterial(atlas), count);
  mesh.name = name;
  mesh.frustumCulled = false;
  mesh.count = 0;
  return { mesh, rect, card };
}

// ---------------------------------------------------------------- traffic
interface Vehicle {
  card: string;
  x: number;
  z0: number;
  /** World speed relative to the flow (1 = parked, −1 = oncoming at cruise speed …). */
  drift: number;
  window: number;
  /** Visible up to this journey coordinate (sparse near Reach). */
  until: number;
}

const TRAFFIC: readonly Vehicle[] = [
  // Oncoming carriageway (their lanes at x ≈ 13.6 / 17.4): relative speed ≈ 2× cruise.
  { card: "car_front", x: 17.4, z0: 60, drift: 2.1, window: 900, until: 2.8 },
  { card: "truck_front", x: 13.6, z0: 420, drift: 1.8, window: 900, until: 2.5 },
  { card: "car_front", x: 17.4, z0: 610, drift: 2.2, window: 900, until: 2.2 },
  // Same direction, well ahead: slowly drawing away or being caught.
  { card: "car_rear_a", x: 3.75, z0: 180, drift: -0.08, window: 600, until: 2.9 },
  { card: "truck_rear", x: 0, z0: 380, drift: 0.05, window: 600, until: 2.6 },
  { card: "van_rear", x: 3.75, z0: 520, drift: -0.12, window: 600, until: 2.3 },
  { card: "car_rear_b", x: 3.75, z0: 300, drift: -0.05, window: 600, until: 1.9 },
];

// ---------------------------------------------------------------- horizon plates
/**
 * A thin edge feather only (opaque core): the plate is sized and positioned
 * to fill the road-tracking shot's frustum completely, so this margin sits
 * outside the visible frame and never reads as a translucent rectangle.
 */
function featherMask(w = 512, h = 512): CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  const gx = ctx.createLinearGradient(0, 0, w, 0);
  gx.addColorStop(0, "rgba(0,0,0,0)");
  gx.addColorStop(0.04, "rgba(255,255,255,1)");
  gx.addColorStop(0.96, "rgba(255,255,255,1)");
  gx.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = gx;
  ctx.fillRect(0, 0, w, h);
  const gy = ctx.createLinearGradient(0, 0, 0, h);
  gy.addColorStop(0, "rgba(0,0,0,0)");
  gy.addColorStop(0.04, "rgba(255,255,255,1)");
  gy.addColorStop(0.94, "rgba(255,255,255,1)");
  gy.addColorStop(1, "rgba(0,0,0,0)");
  ctx.globalCompositeOperation = "multiply";
  ctx.fillStyle = gy;
  ctx.fillRect(0, 0, w, h);
  return new CanvasTexture(canvas);
}

export interface HorizonPlates {
  group: Group;
  update(journey: number, fadeWorld: number): void;
}

/**
 * The three approved photographic references (01 industrial, 02 service, 03
 * open road) as the road-tracking shot's actual sky and background: sized and
 * billboarded to fill that shot's frustum exactly (fov 31°, aspect ≈ 1.78) at
 * a fixed distance, so within that shot the plate reads as world geometry —
 * its own sky, buildings and ground — never as a rectangle laid over ours.
 * Realtime road, guardrail and truck sit in front of it at normal depth.
 * Only one plate is opaque at a time; the transition crossfades with the
 * chapter. Positioning follows the camera's real view direction every frame
 * (the road-tracking shot looks ~25° off the road axis, lens-shifted), not
 * the world's +Z — the previous version placed it along +Z and only a sliver
 * of it ever fell inside the frame.
 */
export function createHorizonPlates(kit: RoadKit): HorizonPlates {
  const group = new Group();
  group.name = "Road_Horizon_Plates";
  const mask = featherMask();
  const DISTANCE = 620;
  // The road-tracking shot's frustum at DISTANCE is ≈ 611 × 344 m (fov 31°,
  // aspect 1.78); sized up with margin for the shot's lens shift and for
  // narrower/portrait buckets, which sit further back but shift more.
  const WIDTH = 980;
  const HEIGHT = 520;
  // Each reference is a 1672×941 landscape photo: crop a small margin off
  // the extreme top/bottom only (the plate now stands in for the shot's
  // whole sky and ground, not a thin band — see the module comment).
  const bandTop = 0.06;
  const bandBottom = 0.85;
  const entries: Array<{ material: MeshBasicMaterial; chapter: "A" | "B" | "C" }> = [];
  const plates: Array<["A" | "B" | "C", Texture]> = [
    ["A", kit.plates.A],
    ["B", kit.plates.B],
    ["C", kit.plates.C],
  ];
  const forward = new Vector3();
  const target = new Vector3();
  for (const [chapter, texture] of plates) {
    texture.wrapS = texture.wrapT = RepeatWrapping;
    // glTF textures load with flipY=false (V=0 is the image's top row), so the
    // plane's own +V (world up) must sample decreasing V to stay upright.
    texture.repeat.set(1, -(bandBottom - bandTop));
    texture.offset.set(0, bandBottom);
    texture.needsUpdate = true;
    const material = new MeshBasicMaterial({
      map: texture,
      alphaMap: mask,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      // The scene's distance fog reaches full density at exactly this plate's
      // distance (tuned for the road/midground, not a fixed background plate),
      // which was washing it out to pure fog colour regardless of its texture.
      // The photo's own atmospheric haze already does that job.
      fog: false,
      toneMapped: true,
    });
    const mesh = new Mesh(new PlaneGeometry(WIDTH, HEIGHT), material);
    mesh.name = "Road_Horizon_" + chapter;
    // After the sky dome (−2) and clouds (−1), before ordinary opaque scene
    // content: where the plate is opaque it paints over the procedural sky
    // (it *is* the sky for this shot); real depth-tested geometry (truck,
    // road, CG cards) still occludes it normally via depthTest.
    mesh.renderOrder = -0.5;
    mesh.frustumCulled = false;
    mesh.matrixAutoUpdate = false;
    // Billboards a fixed distance directly ahead of the camera's real view
    // direction every frame (not world +Z: this shot looks ~25° off-axis).
    mesh.onBeforeRender = (_renderer, _scene, camera) => {
      camera.getWorldDirection(forward);
      mesh.position.copy(camera.position).addScaledVector(forward, DISTANCE);
      target.copy(camera.position);
      mesh.lookAt(target);
      mesh.updateMatrix();
      mesh.updateMatrixWorld(true);
    };
    group.add(mesh);
    entries.push({ material, chapter });
  }
  // Centred on each chapter's midpoint; natural overlap crossfades the boundary.
  const centres: Record<"A" | "B" | "C", number> = { A: 0.5, B: 1.5, C: 2.5 };
  const halfWidths: Record<"A" | "B" | "C", number> = { A: 0.55, B: 0.55, C: 0.7 };
  return {
    group,
    update(journey, fadeWorld) {
      for (const entry of entries) {
        const weight = Math.max(
          0,
          1 - Math.abs(journey - centres[entry.chapter]) / halfWidths[entry.chapter],
        );
        entry.material.opacity = weight * fadeWorld;
      }
    },
  };
}

// ---------------------------------------------------------------- scenery
export interface RoadScenery {
  group: Group;
  update(
    offset: number,
    story: { journey: number; routeBlend: number; mapBlend: number; active: boolean },
  ): void;
  /** Builds every building type now (idle time), instead of on first sight mid-scroll. */
  prepare(): void;
}

export function createRoadScenery(kit: RoadKit, options: { behind: number }): RoadScenery {
  const group = new Group();
  group.name = "Road_Scenery";
  const specs = slots();
  const layers = {
    RK_Atlas_Built: cardLayer(kit.atlases.RK_Atlas_Built, specs.length, "Road_Cards_Built"),
    RK_Atlas_Nature: cardLayer(
      kit.atlases.RK_Atlas_Nature,
      specs.length + TRAFFIC.length,
      "Road_Cards_Nature",
    ),
  };
  group.add(layers.RK_Atlas_Built.mesh, layers.RK_Atlas_Nature.mesh);

  // Real proxy geometry for buildings (replaces the flat impostor cards). Each building
  // type is batched once (one mesh per remaining material) and drawn instanced: every
  // slot showing that type adds an instance at its road-flow position, so the estate
  // costs one draw call per material per type in view, however many copies are shown.
  interface EstateType {
    meshes: InstancedMesh[];
    count: number;
  }
  const types = new Map<string, EstateType>();
  const estate = new Group();
  estate.name = "Road_Estate";
  group.add(estate);
  const estateType = (id: string): EstateType | null => {
    const build = REAL_BUILDINGS[id];
    if (!build) return null;
    let type = types.get(id);
    if (!type) {
      const template = build();
      batchStatic(template);
      const meshes: InstancedMesh[] = [];
      template.traverse((object) => {
        const mesh = object as Mesh;
        if (!mesh.isMesh) return;
        const instanced = new InstancedMesh(mesh.geometry, mesh.material, specs.length);
        instanced.name = `${template.name}_${meshes.length}`;
        instanced.count = 0;
        // Instances move with the road flow every frame: bounds are never current.
        instanced.frustumCulled = false;
        instanced.castShadow = mesh.castShadow;
        instanced.receiveShadow = mesh.receiveShadow;
        instanced.userData.local = mesh.matrixWorld.clone();
        meshes.push(instanced);
        estate.add(instanced);
      });
      type = { meshes, count: 0 };
      types.set(id, type);
    }
    return type;
  };

  // Per slot: the card shown, its cross-dissolve level, the spawn counter and last z.
  const current = specs.map(() => "");
  const level = specs.map(() => 1);
  /** Extra phase per slot (signature set pieces are re-phased on chapter entry). */
  const phase = specs.map(() => 0);
  let lastChapter: Chapter | null = null;
  const spawn = specs.map(() => 0);
  const lastZ = specs.map(() => Number.NaN);
  let wasActive = false;
  let lastTime = Number.NaN;

  interface Placement {
    meta: CardMeta;
    x: number;
    z: number;
    scale: number;
  }
  const placed: Record<CardMeta["atlas"], Placement[]> = {
    RK_Atlas_Built: [],
    RK_Atlas_Nature: [],
  };

  const recycle = (z0: number, offset: number, window: number) =>
    ((((z0 - offset) % window) + window) % window) - options.behind;

  const matrix = new Matrix4();
  const placement = new Matrix4();
  const slotPosition = new Vector3();
  const slotTurn = new Quaternion();
  const slotScale = new Vector3();
  const UP = new Vector3(0, 1, 0);
  const rotation = new Matrix4();
  const shift = new Matrix4();
  // Each layer turns its cards to face the camera just before it renders.
  for (const key of Object.keys(layers) as Array<CardMeta["atlas"]>) {
    const layer = layers[key];
    layer.mesh.onBeforeRender = (_renderer, _scene, camera: Camera) => {
      placed[key].forEach((p, i) => {
        const [w, h] = p.meta.size;
        // Cards were rendered for the right side of the road: mirrored on the left.
        const ax = p.x > 0 ? 1 - p.meta.anchor[0] : p.meta.anchor[0];
        shift.makeTranslation(-ax, -(1 - p.meta.anchor[1]), 0);
        rotation.makeRotationY(Math.atan2(camera.position.x - p.x, camera.position.z - p.z));
        matrix
          .makeScale(w * p.scale, h * p.scale, 1)
          .multiply(shift)
          .premultiply(rotation)
          .setPosition(p.x, 0, p.z);
        layer.mesh.setMatrixAt(i, matrix);
      });
      layer.mesh.instanceMatrix.needsUpdate = true;
    };
  }

  const place = (id: string, x: number, z: number, scale: number, fade: number) => {
    const meta = kit.cards.get(id);
    if (!meta) return;
    const list = placed[meta.atlas];
    const layer = layers[meta.atlas];
    const i = list.length;
    list.push({ meta, x, z, scale });
    layer.rect.setXYZW(i, meta.uv[0], meta.uv[1], meta.uv[2], meta.uv[3]);
    layer.card.setXY(i, x > 0 ? 1 : 0, fade);
  };

  return {
    group,
    prepare() {
      for (const id of Object.keys(REAL_BUILDINGS)) estateType(id);
    },
    update(offset, { journey, routeBlend, mapBlend, active }) {
      const chapter = chapterOf(journey);
      // Entering the road world (or a jump): dress every slot for the current chapter.
      const reseed = active && !wasActive;
      wasActive = active;
      const fadeWorld = (1 - routeBlend) * (1 - mapBlend);
      // Cross-dissolve speed (wall clock: identical while the story is frozen).
      const now = typeof performance === "undefined" ? 0 : performance.now();
      const step = Number.isNaN(lastTime) ? 1 : Math.min(1, Math.max(0, (now - lastTime) / 450));
      lastTime = now;
      placed.RK_Atlas_Built.length = 0;
      placed.RK_Atlas_Nature.length = 0;
      for (const type of types.values()) type.count = 0;
      const entering = active && (reseed || chapter !== lastChapter);
      lastChapter = active ? chapter : null;
      specs.forEach((spec, i) => {
        if (entering && spec.entry !== undefined && spec.choices[chapter]) {
          // Put the set piece at its entry distance now: z = entry.
          const base = (((spec.z0 - offset) % spec.window) + spec.window) % spec.window;
          phase[i] = spec.entry + options.behind - base;
          lastZ[i] = Number.NaN;
          current[i] = pick(spec.choices[chapter], 0);
          level[i] = 0;
        }
        const z = recycle(spec.z0 + phase[i]!, offset, spec.window);
        const respawned = !Number.isNaN(lastZ[i]!) && z > lastZ[i]! + spec.window / 2;
        lastZ[i] = z;
        if (reseed || respawned) {
          spawn[i] = spawn[i]! + 1;
          current[i] = pick(spec.choices[chapter], hash(i, spawn[i]!));
          level[i] = 1;
        } else {
          const wanted = pick(spec.choices[chapter], hash(i, spawn[i]!));
          // Signature pieces leave with their chapter at any distance; the rest only far away.
          if (wanted !== current[i] && (z > SWAP_DISTANCE || spec.entry !== undefined)) {
            // Dissolve out, swap, dissolve in — only far away, in the haze.
            level[i] = Math.max(0, level[i]! - step);
            if (level[i] === 0) current[i] = wanted;
          } else if (level[i]! < 1) {
            level[i] = Math.min(1, level[i]! + step);
          }
        }
        const id = current[i]!;
        const near = spec.near === undefined ? 1 : Math.min(1, Math.max(0, (z - spec.near) / 50));
        if (!id || fadeWorld <= 0.001 || level[i]! <= 0 || near <= 0) return;
        const [s0, s1] = spec.scale ?? [1, 1];
        const visibility = fadeWorld * level[i]! * near;
        const type = estateType(id);
        if (type) {
          // Real geometry: shown/hidden with its fade (swaps happen far away, inside the haze).
          if (visibility > 0.35) {
            placement.compose(
              slotPosition.set(spec.x, 0, z),
              slotTurn.setFromAxisAngle(UP, spec.x > 0 ? 0 : Math.PI),
              slotScale.setScalar(id === "fuel_station" ? 1.55 : 1.25),
            );
            for (const mesh of type.meshes) {
              mesh.setMatrixAt(
                type.count,
                matrix.multiplyMatrices(placement, mesh.userData.local as Matrix4),
              );
            }
            type.count++;
          }
          return;
        }
        place(id, spec.x, z, s0 + (s1 - s0) * hash(i + 17, spawn[i]!), visibility);
      });
      // Sparse traffic: oncoming vehicles pass quickly, same-direction ones hold station far ahead.
      for (const v of TRAFFIC) {
        if (journey > v.until || fadeWorld <= 0.001) continue;
        const z = recycle(v.z0, offset * v.drift, v.window);
        // Vehicles are cards: they dissolve before they come close enough to
        // show it (oncoming ones pass behind the median in the haze).
        const near = v.drift > 0 ? 160 : 90;
        const fade =
          Math.min(1, Math.max(0, (z - near) / 60)) * Math.min(1, Math.max(0, (560 - z) / 120));
        if (fade <= 0.01) continue;
        place(v.card, v.x, z, 1, fadeWorld * fade);
      }
      for (const key of Object.keys(layers) as Array<CardMeta["atlas"]>) {
        const layer = layers[key];
        layer.mesh.count = placed[key].length;
        layer.rect.needsUpdate = true;
        layer.card.needsUpdate = true;
      }
      for (const type of types.values()) {
        for (const mesh of type.meshes) {
          mesh.count = type.count;
          mesh.visible = type.count > 0;
          mesh.instanceMatrix.needsUpdate = true;
        }
      }
    },
  };
}
