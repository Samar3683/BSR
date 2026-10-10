import {
  AdditiveBlending,
  BoxGeometry,
  type BufferGeometry,
  Color,
  CylinderGeometry,
  DataTexture,
  DirectionalLight,
  DoubleSide,
  ExtrudeGeometry,
  Group,
  HemisphereLight,
  IcosahedronGeometry,
  InstancedMesh,
  LinearFilter,
  LinearMipmapLinearFilter,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  RepeatWrapping,
  Shape,
  SRGBColorSpace,
  type Texture,
  Quaternion,
  Vector2,
  Vector3,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

import { SCENE_COLORS } from "@/lib/three/brand-colors";

import { createItalyStage } from "./italy-stage";
import { createRidge } from "./placeholder-worlds";
import { chapterOf, createHorizonPlates, createRoadScenery, type RoadKit } from "./road-scenery";
import {
  createAggregateDetail,
  createAsphaltMaps,
  createGlowTexture,
  createGroundGlints,
  type GlintSource,
  valueNoise,
} from "./world-details";

/*
 * Road world (Styleframe 03, Gate B journey): a Northern Italian dual
 * carriageway. Truck-relative: the truck stays at the origin in the right
 * lane (x = 0) heading +Z and everything that must read as movement flows
 * past along −Z (road texture, posts, scenery), wrapping at ROAD_FLOW_WRAP.
 *
 * Realtime: road surface (baked road-kit tile: aggregate, wheel paths,
 * repairs, sealed cracks, worn Italian markings), W-beam guardrails on posts,
 * lamp columns (industrial / service chapters), the overpass (open road).
 * Pre-rendered: every mid/background set piece and passing traffic
 * (road-scenery.ts). Without a road kit (tests, development) the road keeps a
 * procedural surface and simple markings.
 */

const LANE = 3.75;
const RIGHT_EDGE = -LANE / 2; // −1.875
const DIVIDER = LANE / 2; // 1.875
const LEFT_EDGE = LANE * 1.5; // 5.625
/** Median barrier: a wide left shoulder keeps it out of the tracking camera's face. */
const MEDIAN = 9;
const CARRIAGEWAY: readonly [number, number] = [RIGHT_EDGE - 2.6, MEDIAN]; // −4.475 … 9
const OPPOSITE_X = MEDIAN + 1; // the oncoming carriageway starts past the median
const DASH_SPACING = 12;
const POST_SPACING = 2;
const LAMP_SPACING = 45;
const ROAD_BEHIND = 150;
const ROAD_AHEAD = 850;
const ROAD_LENGTH = ROAD_BEHIND + ROAD_AHEAD;
/** Field patchwork tile (m). */
const FIELD_TILE = 200;
/** Low sun straight down the road, a touch left (Styleframe 03). */
const SUN_DIRECTION = new Vector3(0.06, 0.03, 1).normalize();
const SUN_INTENSITY = 1.8;

/**
 * Road flow offsets wrap at this length: a multiple of every repeat spacing
 * and recycle window (road tile 36, dashes 12, posts 2, lamps 45, fields 200,
 * scenery windows 600 / 900 / 1200), so wrapping never jumps.
 */
export const ROAD_FLOW_WRAP = 3600;

export interface RoadStory {
  routeBlend: number;
  mapBlend: number;
  europeBlend: number;
  /** Journey coordinate: 0–1 industrial, 1–2 service corridor, 2–3 open road. */
  journey: number;
  /** The road world is the one on screen (entering it re-dresses the scenery). */
  active: boolean;
}

export interface RoadWorld {
  group: Group;
  ambient: HemisphereLight;
  sun: DirectionalLight;
  /** Direction of the low sun (world space, for the sky dome). */
  sunDirection: Vector3;
  /** Distant relief material (tinted from the sky horizon by the runtime). */
  ridge: MeshBasicMaterial;
  /** The paler far range behind it (tinted by the runtime). */
  farRidge: MeshBasicMaterial;
  update(offset: number, layers: number, story: RoadStory): void;
  /** Builds everything that would otherwise be built on first sight (idle-time warm-up). */
  prepare(): void;
}

/**
 * Low-frequency farmland relief (m) at a world position: gentle parcel-scale rises and
 * shallow drainage depressions. Zero across the motorway corridor and its verges so the road
 * (a flat, cambered surface) always sits on the ground; the relief grows away from it.
 */
export function terrainHeight(x: number, z: number): number {
  const corridor = Math.min(1, Math.max(0, (Math.abs(x - 6) - 34) / 110));
  const k = corridor * corridor * (3 - 2 * corridor);
  const relief =
    4.2 * (valueNoise(x * 0.0045 + 3, z * 0.0045, 4096, 81) - 0.5) +
    1.6 * (valueNoise(x * 0.016, z * 0.016 + 7, 4096, 82) - 0.5) +
    0.35 * (valueNoise(x * 0.06, z * 0.06, 4096, 83) - 0.5);
  return relief * k * 2.2;
}

const smooth = (a: number, b: number, t: number) => {
  const x = Math.min(1, Math.max(0, (t - a) / (b - a)));
  return x * x * (3 - 2 * x);
};

/** Aggregate tile size (m) — matches createAggregateDetail (512 texels at 1 mm). */
const AGGREGATE_TILE = 0.5;

interface AggregateUniforms {
  detailMap: { value: Texture };
  detailRepeat: { value: Vector2 };
  detailOffset: { value: number };
  detailStrength: { value: number };
}

/**
 * Road micro-surface: injects the tiled aggregate layer into a standard material —
 * a derivative-based micro-normal (no tangent frame needed), a stone-vs-bitumen albedo
 * split and stone-top roughness (sun glints). Everything fades out beyond ~45 m where the
 * detail would only alias; there the baked tile and haze carry the road.
 */
function withAggregateDetail(material: MeshStandardMaterial, uniforms: AggregateUniforms): void {
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        "#include <common>\nuniform vec2 detailRepeat;\nuniform float detailOffset;\nvarying vec2 vDetailUv;",
      )
      .replace(
        "#include <uv_vertex>",
        "#include <uv_vertex>\nvDetailUv = uv * detailRepeat + vec2(0.0, detailOffset);",
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
uniform sampler2D detailMap;
uniform float detailStrength;
varying vec2 vDetailUv;
vec3 detailPerturb(vec3 surfPos, vec3 surfNorm, vec2 dHdxy, float faceDir) {
  vec3 sx = normalize(dFdx(surfPos));
  vec3 sy = normalize(dFdy(surfPos));
  vec3 r1 = cross(sy, surfNorm);
  vec3 r2 = cross(surfNorm, sx);
  float det = dot(sx, r1) * faceDir;
  vec3 grad = sign(det) * (dHdxy.x * r1 + dHdxy.y * r2);
  return normalize(abs(det) * surfNorm - grad);
}`,
      )
      .replace(
        "#include <clipping_planes_fragment>",
        `#include <clipping_planes_fragment>
float detailH = texture2D(detailMap, vDetailUv).r;
float detailFade = 1.0 - smoothstep(8.0, 45.0, length(vViewPosition));`,
      )
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
diffuseColor.rgb *= mix(1.0, 0.72 + 0.6 * smoothstep(0.2, 0.75, detailH), detailFade);`,
      )
      .replace(
        "#include <roughnessmap_fragment>",
        `#include <roughnessmap_fragment>
roughnessFactor = mix(roughnessFactor, roughnessFactor * mix(1.0, 0.62, smoothstep(0.55, 0.9, detailH)), detailFade);`,
      )
      .replace(
        "#include <normal_fragment_maps>",
        `#include <normal_fragment_maps>
{
  vec2 dstdx = dFdx(vDetailUv);
  vec2 dstdy = dFdy(vDetailUv);
  float dbx = texture2D(detailMap, vDetailUv + dstdx).r - detailH;
  float dby = texture2D(detailMap, vDetailUv + dstdy).r - detailH;
  normal = detailPerturb(-vViewPosition, normal, vec2(dbx, dby) * detailStrength * detailFade, faceDirection);
}`,
      );
  };
  material.customProgramCacheKey = () => "bsr-road-aggregate";
}

function texture(data: Uint8Array, w: number, h: number, srgb: boolean): DataTexture {
  const t = new DataTexture(data, w, h);
  t.wrapS = t.wrapT = RepeatWrapping;
  t.magFilter = LinearFilter;
  t.minFilter = LinearMipmapLinearFilter;
  t.generateMipmaps = true;
  t.anisotropy = 8;
  if (srgb) t.colorSpace = SRGBColorSpace;
  t.needsUpdate = true;
  return t;
}

/**
 * Po-valley field patchwork, one 200 m tile: parcels of winter wheat, stubble,
 * ploughed earth and fallow, with furrows along each parcel and darker margins.
 */
function createFieldTexture(size = 512): DataTexture {
  const data = new Uint8Array(size * size * 4);
  const crops: Array<[number, number, number]> = [
    [70, 82, 44], // young wheat
    [96, 92, 58], // stubble
    [78, 62, 46], // ploughed
    [86, 90, 54], // fallow
    [62, 76, 40], // lucerne
  ];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const v = y / size;
      // Parcels: 4 across × 3 along, jittered boundaries.
      const pu = Math.floor(u * 4 + 0.08 * Math.sin(v * 12));
      const pv = Math.floor(v * 3 + 0.05 * Math.sin(u * 9));
      const id = (((pu * 7 + pv * 13) % crops.length) + crops.length) % crops.length;
      const [r, g, b] = crops[id]!;
      const furrow = 0.9 + 0.1 * Math.sin((id % 2 ? u : v) * size * 0.9);
      const grain = 0.85 + 0.3 * valueNoise(u * 64, v * 64, 64, 30 + id);
      const edge = Math.min((u * 4) % 1, 1 - ((u * 4) % 1), (v * 3) % 1, 1 - ((v * 3) % 1));
      const margin = edge < 0.012 ? 0.9 : 1;
      const k = furrow * grain * margin;
      const i = (y * size + x) * 4;
      data[i] = Math.min(255, r * k);
      data[i + 1] = Math.min(255, g * k);
      data[i + 2] = Math.min(255, b * k);
      data[i + 3] = 255;
    }
  }
  return texture(data, size, size, true);
}

/** Galvanised W-beam: zinc spangle, a splice overlap and bolts every 4 m, dirt low. */
function createGalvanizedTexture(w = 128, h = 32): DataTexture {
  const data = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const u = x / w;
      const v = y / h;
      let k =
        0.82 + 0.12 * valueNoise(u * 48, v * 12, 48, 40) + 0.05 * valueNoise(u * 8, v * 2, 8, 41);
      if (u < 0.012) k *= 0.55; // splice overlap edge
      const bolt =
        Math.hypot((u - 0.035) * 4, v - 0.5) < 0.05 || Math.hypot((u - 0.035) * 4, v - 0.25) < 0.05;
      if (bolt) k *= 0.6;
      k *= 0.85 + 0.15 * v; // road grime towards the bottom edge
      const i = (y * w + x) * 4;
      data[i] = data[i + 1] = Math.round(200 * k);
      data[i + 2] = Math.round(204 * k);
      data[i + 3] = 255;
    }
  }
  return texture(data, w, h, true);
}

/** Weathered concrete with vertical rain streaks (overpass). */
function createConcreteTexture(size = 128): DataTexture {
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const v = y / size;
      const streak = 0.9 + 0.1 * valueNoise(u * 40, v * 2, 40, 50);
      const k = (0.8 + 0.2 * valueNoise(u * 16, v * 16, 16, 51)) * streak;
      const i = (y * size + x) * 4;
      data[i] = Math.round(170 * k);
      data[i + 1] = Math.round(166 * k);
      data[i + 2] = Math.round(156 * k);
      data[i + 3] = 255;
    }
  }
  return texture(data, size, size, true);
}

/**
 * European W-beam (A-profile, 310 mm × 83 mm, top ≈ 0.75 m) extruded along
 * the road; `facing` = +1 when the traffic side is +X. UVs in metres along Z.
 */
function wBeamGeometry(facing: 1 | -1): BufferGeometry {
  const profile: Array<[number, number]> = [
    [0, 0],
    [0.02, 0.02],
    [0.07, 0.055],
    [0.083, 0.08],
    [0.07, 0.105],
    [0.04, 0.13],
    [0.04, 0.18],
    [0.07, 0.205],
    [0.083, 0.23],
    [0.07, 0.255],
    [0.02, 0.29],
    [0, 0.31],
  ];
  const t = 0.004;
  const shape = new Shape();
  profile.forEach(([d, y], i) => (i ? shape.lineTo(d * facing, y) : shape.moveTo(d * facing, y)));
  for (let i = profile.length - 1; i >= 0; i--) {
    const [d, y] = profile[i]!;
    shape.lineTo((d - t) * facing, y);
  }
  shape.closePath();
  const geometry = new ExtrudeGeometry(shape, {
    depth: ROAD_LENGTH,
    bevelEnabled: false,
    steps: 1,
  });
  const position = geometry.attributes.position!;
  const uv = geometry.attributes.uv!;
  for (let i = 0; i < position.count; i++) {
    uv.setXY(i, position.getZ(i) / 4, position.getY(i) / 0.31);
  }
  geometry.translate(0, 0.44, -ROAD_BEHIND);
  return geometry;
}

/** Guardrail post (C-section) with its spacer block, behind the beam. */
function postGeometry(facing: 1 | -1): BufferGeometry {
  const post = new BoxGeometry(0.1, 1.05, 0.055).translate(-0.18 * facing, 0.525, 0);
  const block = new BoxGeometry(0.15, 0.3, 0.06).translate(-0.08 * facing, 0.6, 0);
  // Splice/post bolts: domed heads with washers on the beam's centre valley, and a second
  // pair on the block-out.
  const bolts: BufferGeometry[] = [];
  for (const y of [0.53, 0.68]) {
    const head = new CylinderGeometry(0.022, 0.022, 0.014, 8)
      .rotateZ(Math.PI / 2)
      .translate(0.048 * facing, y, 0);
    const washer = new CylinderGeometry(0.03, 0.03, 0.004, 10)
      .rotateZ(Math.PI / 2)
      .translate(0.041 * facing, y, 0);
    bolts.push(head, washer);
  }
  const rust = new BoxGeometry(0.004, 0.12, 0.05).translate(0.042 * facing, 0.41, 0); // rain-wash stain under the post
  return mergeGeometries([post, block, ...bolts, rust])!;
}

/** Road lighting column: tapered pole, outreach arm over the road, luminaire. */
function lampGeometry(): BufferGeometry {
  const pole = new CylinderGeometry(0.07, 0.12, 11, 8).translate(0, 5.5, 0);
  const arm = new BoxGeometry(2.2, 0.08, 0.08).translate(1.1, 10.9, 0);
  const head = new BoxGeometry(0.75, 0.14, 0.32).translate(2.3, 10.85, 0);
  return mergeGeometries([pole, arm, head])!;
}

/** Motorway overpass: deck with parapets on three piers, embankment abutments. */
function createOverpass(concrete: MeshStandardMaterial): Group {
  const group = new Group();
  group.name = "Road_Overpass";
  const add = (w: number, h: number, d: number, x: number, y: number, z: number) => {
    const mesh = new Mesh(new BoxGeometry(w, h, d), concrete);
    mesh.position.set(x, y, z);
    mesh.castShadow = mesh.receiveShadow = true;
    group.add(mesh);
  };
  add(78, 1.4, 12, 7, 6.3, 0); // deck: 5.6 m clearance
  add(78, 1.1, 0.35, 7, 7.55, -5.8); // parapets
  add(78, 1.1, 0.35, 7, 7.55, 5.8);
  add(1.4, 5.6, 9, -7.8, 2.8, 0); // piers: right verge, median, far verge
  add(1.2, 5.6, 9, MEDIAN + 0.5, 2.8, 0);
  add(1.4, 5.6, 9, 25.5, 2.8, 0);
  add(10, 7, 16, -36, 3.5, 0); // abutments
  add(10, 7, 16, 50, 3.5, 0);
  return group;
}

/** 2400 m ground plane (rotated flat by the caller) with the terrain relief baked in. */
function reliefPlane(lift = 0): PlaneGeometry {
  const g = new PlaneGeometry(2400, 2400, 100, 100);
  const p = g.attributes.position!;
  for (let i = 0; i < p.count; i++) {
    // Local (x, y) → world (x, 150 − y) after the plane's −90° rotation about X.
    p.setZ(i, terrainHeight(p.getX(i), 150 - p.getY(i)) + lift);
  }
  g.computeVertexNormals();
  return g;
}

export function createRoadWorld(kit: RoadKit | null = null): RoadWorld {
  const group = new Group();
  group.name = "RoadWorld";
  const matrix = new Matrix4();
  const flatAt = (mesh: Mesh, x: number, width: number) => {
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(x, 0, (ROAD_AHEAD - ROAD_BEHIND) / 2);
    mesh.scale.set(width, ROAD_LENGTH, 1);
    mesh.receiveShadow = true;
    return mesh;
  };
  const unitPlane = new PlaneGeometry(1, 1);
  const routeColor = new Color(SCENE_COLORS.graphite);

  // ---------------------------------------------------------------- fields
  const fieldMap = createFieldTexture();
  fieldMap.repeat.set(2400 / FIELD_TILE, 2400 / FIELD_TILE);
  const fieldColor = new Color("#ffffff");
  // Seen at grazing angles by the low camera: environment reflection kept low.
  const fields = new MeshStandardMaterial({
    color: fieldColor,
    map: fieldMap,
    roughness: 1,
    envMapIntensity: 0.3,
  });
  // Large enough that the high route camera never sees its edge.
  const groundPlane = new Mesh(reliefPlane(), fields);
  groundPlane.name = "Road_Fields";
  groundPlane.rotation.x = -Math.PI / 2;
  groundPlane.position.set(0, -0.02, 150);
  groundPlane.receiveShadow = true;

  // Reach: a real Blender-rendered top-down farmland tile (parcels, furrows,
  // hedgerows) crossfades in under the rising camera, richer than the
  // procedural pattern and matching the approved aerial reference's character.
  let aerialPlane: Mesh | null = null;
  let aerialMaterial: MeshStandardMaterial | null = null;
  if (kit) {
    kit.aerial.wrapS = kit.aerial.wrapT = RepeatWrapping;
    kit.aerial.repeat.set(2, 2);
    aerialMaterial = new MeshStandardMaterial({
      map: kit.aerial,
      color: 0xffffff,
      roughness: 1,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      envMapIntensity: 0.25,
    });
    aerialPlane = new Mesh(reliefPlane(0.03), aerialMaterial);
    aerialPlane.name = "Road_Fields_Aerial";
    aerialPlane.rotation.x = -Math.PI / 2;
    aerialPlane.position.set(0, -0.015, 150);
    aerialPlane.renderOrder = 1;
  }

  // Reach: hedgerow / tree-belt geometry on the parcel edges (real height and long sun
  // shadows-by-shading, so the rising camera sees dimensional farmland, not a flat texture).
  const beltCount = 4200;
  // Opaque, and grown out of the ground (uBeltGrow) as the aerial view takes over: faded by
  // opacity they read as translucent ghost blobs over a see-through ground.
  const beltGrow = { value: 0 };
  const beltMaterial = new MeshStandardMaterial({
    color: "#ffffff",
    emissive: "#1c2712",
    emissiveIntensity: 0.85,
    roughness: 1,
  });
  beltMaterial.onBeforeCompile = (shader) => {
    shader.uniforms.uBeltGrow = beltGrow;
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nuniform float uBeltGrow;")
      // The unit blob's base (local y = −1) stays on the ground; its crown rises.
      .replace(
        "#include <begin_vertex>",
        "#include <begin_vertex>\ntransformed.y = (transformed.y + 1.0) * uBeltGrow - 1.0;",
      );
  };
  const belts = new InstancedMesh(new IcosahedronGeometry(1, 1), beltMaterial, beltCount);
  belts.name = "Road_Tree_Belts";
  belts.frustumCulled = false;
  {
    const m = new Matrix4();
    let n = 0;
    const h = (a: number, b: number) => {
      const v = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
      return v - Math.floor(v);
    };
    const tint = new Color();
    for (let line = 0; line < 60 && n < beltCount; line++) {
      const along = h(line, 1) > 0.5; // along X or along Z
      const fixed = (Math.floor(h(line, 2) * 24) - 12) * 90 + 45 + (h(line, 3) - 0.5) * 20;
      if (Math.abs(fixed) < 30 && !along) continue; // keep the motorway corridor clear
      const density = 0.35 + 0.65 * h(line, 4);
      for (let t = -1150; t < 1150 && n < beltCount; t += 4) {
        if (h(line, t) > density * 0.85) continue;
        const r = 2 + 2.6 * h(t, line);
        const height = r * (1.5 + h(line, t + 1));
        const x = along ? t : fixed + (h(t, 9) - 0.5) * 3;
        const z = along ? fixed + (h(t, 8) - 0.5) * 3 : t + 150;
        if (Math.abs(x) < 24) continue;
        m.makeScale(along ? r * 1.9 : r, height * 0.55, along ? r : r * 1.9).setPosition(
          x,
          height * 0.4 + terrainHeight(x, z),
          z,
        );
        belts.setMatrixAt(n, m);
        belts.setColorAt(n, tint.setHSL(0.24 + 0.08 * h(n, 3), 0.5, 0.16 + 0.14 * h(n, 4)));
        n++;
      }
    }
    belts.count = n;
    belts.instanceMatrix.needsUpdate = true;
  }
  belts.visible = false;

  // Long low-sun shadows: each belt segment throws a soft dark strip towards the camera
  // (−Z, the sun is ahead), stretched by its height; and localized morning mist banks in
  // the low ground between parcels (additive-free, alpha-blended noise cards near the ground).
  const shadowMat = new MeshBasicMaterial({
    color: "#0d1208",
    transparent: true,
    opacity: 0,
    depthWrite: false,
    fog: false,
  });
  const shadows = new InstancedMesh(
    new PlaneGeometry(1, 1).rotateX(-Math.PI / 2),
    shadowMat,
    beltCount,
  );
  shadows.name = "Road_Belt_Shadows";
  shadows.frustumCulled = false;
  shadows.renderOrder = 1;
  {
    const m = new Matrix4();
    const src = new Matrix4();
    const pos = new Vector3();
    const sc = new Vector3();
    const q = new Quaternion();
    for (let i = 0; i < belts.count; i++) {
      belts.getMatrixAt(i, src);
      src.decompose(pos, q, sc);
      const len = sc.y * 9;
      m.makeScale(sc.x * 1.1, 1, len).setPosition(
        pos.x,
        terrainHeight(pos.x, pos.z) + 0.08,
        pos.z - len * 0.45,
      );
      shadows.setMatrixAt(i, m);
    }
    shadows.count = belts.count;
    shadows.instanceMatrix.needsUpdate = true;
  }
  shadows.visible = false;
  const mistMap = createGlowTexture(64);
  const mistMat = new MeshBasicMaterial({
    map: mistMap,
    color: "#e8d8c0",
    transparent: true,
    opacity: 0,
    depthWrite: false,
    fog: false,
  });
  const mist = new InstancedMesh(new PlaneGeometry(1, 1).rotateX(-Math.PI / 2), mistMat, 90);
  mist.name = "Road_Morning_Mist";
  mist.frustumCulled = false;
  mist.renderOrder = 2;
  {
    const m = new Matrix4();
    const h = (a: number, b: number) => {
      const v = Math.sin(a * 91.7 + b * 17.3) * 43758.5453;
      return v - Math.floor(v);
    };
    for (let i = 0; i < 90; i++) {
      // Real ground-fog scale (tens of metres, not hundreds): from the air a mist bank
      // reads as a soft, low, irregular haze pooled in one valley — not a giant bright disc.
      const w = 18 + 34 * h(i, 1);
      const mx = (h(i, 3) - 0.5) * 1800;
      const mz = (h(i, 5) - 0.3) * 1500;
      // Mist pools in depressions only: keep banks where the relief is low.
      const low = terrainHeight(mx, mz) < -1.4;
      m.makeScale(low ? w : 0.001, 1, w * (0.55 + 0.35 * h(i, 2))).setPosition(
        mx,
        0.6 + 1.2 * h(i, 4),
        mz,
      );
      mist.setMatrixAt(i, m);
    }
    mist.instanceMatrix.needsUpdate = true;
  }
  mist.visible = false;

  // ---------------------------------------------------------------- road surface
  const width = CARRIAGEWAY[1] - CARRIAGEWAY[0];
  const asphaltColor = new Color("#ffffff");
  let roadMaps: Texture[];
  let oppositeMaps: Texture[];
  let asphalt: MeshStandardMaterial;
  let oppositeAsphalt: MeshStandardMaterial;
  let tileLength = 4;
  if (kit) {
    tileLength = kit.roadTile.length;
    const { map, normalMap, roughnessMap } = kit.road;
    roadMaps = [map, normalMap, roughnessMap].filter((t): t is Texture => Boolean(t));
    for (const t of roadMaps) {
      t.flipY = false;
      t.repeat.set(1, ROAD_LENGTH / tileLength);
      t.needsUpdate = true;
    }
    // The oncoming carriageway: the same tile mirrored across (their right edge is outside).
    oppositeMaps = roadMaps.map((t) => {
      const c = t.clone();
      c.repeat.set(-1, ROAD_LENGTH / tileLength);
      c.offset.x = 1;
      c.needsUpdate = true;
      return c;
    });
    const make = (maps: Texture[]) =>
      new MeshStandardMaterial({
        color: asphaltColor.clone(),
        map: maps[0],
        normalMap: normalMap ? maps[1] : null,
        roughnessMap: roughnessMap ? maps[normalMap ? 2 : 1] : null,
        roughness: 1,
        envMapIntensity: 0.35,
      });
    asphalt = make(roadMaps);
    oppositeAsphalt = make(oppositeMaps);
  } else {
    const procedural = createAsphaltMaps();
    for (const t of [procedural.color, procedural.roughness]) t.repeat.set(3.2, ROAD_LENGTH / 4);
    roadMaps = [procedural.color, procedural.roughness];
    oppositeMaps = [];
    asphalt = new MeshStandardMaterial({
      color: "#2c3032",
      roughness: 1,
      map: procedural.color,
      roughnessMap: procedural.roughness,
      envMapIntensity: 0.35,
    });
    oppositeAsphalt = asphalt;
  }
  const baseAsphalt = asphalt.color.clone();
  // Aggregate micro-surface (1 mm/texel, repeats every 0.5 m), flowing with the road.
  const aggregate = createAggregateDetail();
  aggregate.anisotropy = 16;
  const aggregateUniforms: AggregateUniforms = {
    detailMap: { value: aggregate },
    detailRepeat: { value: new Vector2(width / AGGREGATE_TILE, ROAD_LENGTH / AGGREGATE_TILE) },
    detailOffset: { value: 0 },
    detailStrength: { value: 3.5 },
  };
  withAggregateDetail(asphalt, aggregateUniforms);
  if (oppositeAsphalt !== asphalt) withAggregateDetail(oppositeAsphalt, aggregateUniforms);
  const carriageway = flatAt(
    new Mesh(unitPlane, asphalt),
    (CARRIAGEWAY[0] + CARRIAGEWAY[1]) / 2,
    width,
  );
  carriageway.name = "Road_Surface";
  const opposite = flatAt(new Mesh(unitPlane, oppositeAsphalt), OPPOSITE_X + width / 2, width);
  opposite.name = "Road_Surface_Opposite";

  // Without a kit: simple markings (the kit bakes worn markings into the tile).
  const markingMaterial = new MeshStandardMaterial({
    color: "#dcdcd6",
    roughness: 0.5,
    transparent: true,
  });
  const markings = new Group();
  const dashCount = Math.ceil(ROAD_LENGTH / DASH_SPACING);
  const dashes = new InstancedMesh(new BoxGeometry(0.15, 0.01, 4.5), markingMaterial, dashCount);
  dashes.frustumCulled = false;
  if (!kit) {
    for (const x of [RIGHT_EDGE, LEFT_EDGE]) {
      const line = flatAt(new Mesh(unitPlane, markingMaterial), x, 0.15);
      line.position.y = 0.012;
      markings.add(line);
    }
    markings.add(dashes);
  }

  // ---------------------------------------------------------------- guardrails
  const galvanized = createGalvanizedTexture();
  const railMaterial = new MeshStandardMaterial({
    color: "#ffffff",
    map: galvanized,
    metalness: 0.75,
    roughness: 0.42,
    transparent: true,
  });
  const postMaterial = new MeshStandardMaterial({
    color: "#8c9294",
    metalness: 0.6,
    roughness: 0.5,
  });
  // Right verge (traffic on +X) and the median (traffic on −X, i.e. our side).
  const rails = [
    { x: RIGHT_EDGE - 2.9, facing: 1 as const },
    { x: MEDIAN, facing: -1 as const },
  ];
  const beams = rails.map(({ x, facing }) => {
    const beam = new Mesh(wBeamGeometry(facing), railMaterial);
    beam.name = "Road_Guardrail_Beam";
    beam.position.x = x;
    beam.castShadow = true;
    beam.receiveShadow = true;
    return beam;
  });
  const postCount = Math.ceil(ROAD_LENGTH / POST_SPACING);
  const posts = rails.map(({ facing }) => {
    const mesh = new InstancedMesh(postGeometry(facing), postMaterial, postCount);
    mesh.name = "Road_Guardrail_Posts";
    mesh.frustumCulled = false;
    mesh.castShadow = true;
    return mesh;
  });

  // Lamp columns on the right verge (industrial outskirts and the service corridor).
  const lampCount = Math.ceil(ROAD_LENGTH / LAMP_SPACING);
  // Verge growth at the guardrail bases: dry-grass tufts (crossed blades), weed clumps and a
  // dark dirt/dust strip — the contact evidence that makes the barrier look installed.
  const TUFT_SPACING = 1.1;
  const tuftCount = 300; // covers ~330 m of verge (150 behind → 180 ahead); beyond that the haze and cards carry it
  const tuftGeometry = (() => {
    const blades: BufferGeometry[] = [];
    for (let k = 0; k < 6; k++) {
      const b = new PlaneGeometry(0.03, 0.3 + 0.08 * k, 1, 1).translate(0, (0.3 + 0.08 * k) / 2, 0);
      b.rotateY((k / 6) * Math.PI);
      b.rotateZ((k % 2 ? 1 : -1) * 0.07 * k);
      blades.push(b);
    }
    return mergeGeometries(blades)!;
  })();
  const tuftMaterial = new MeshStandardMaterial({
    color: "#ffffff",
    roughness: 1,
    side: DoubleSide,
    transparent: true,
  });
  const tufts = [-1, 1].map(() => {
    const mesh = new InstancedMesh(tuftGeometry, tuftMaterial, tuftCount);
    mesh.name = "Road_Verge_Tufts";
    mesh.frustumCulled = false;
    for (let i = 0; i < tuftCount; i++) {
      const v = Math.sin(i * 12.9898) * 43758.5453;
      const f = v - Math.floor(v);
      mesh.setColorAt(
        i,
        new Color().setHSL(0.11 + 0.06 * f, 0.35 + 0.2 * f, 0.36 + 0.14 * ((f * 7) % 1)),
      );
    }
    return mesh;
  });
  const dustStrips = rails.map(({ x, facing }) => {
    const strip = new Mesh(
      new PlaneGeometry(0.55, ROAD_LENGTH),
      new MeshBasicMaterial({
        color: "#1c1a15",
        transparent: true,
        opacity: 0.35,
        depthWrite: false,
      }),
    );
    strip.rotation.x = -Math.PI / 2;
    strip.position.set(x - 0.15 * facing, 0.02, (ROAD_AHEAD - ROAD_BEHIND) / 2);
    return strip;
  });
  const lamps = new InstancedMesh(lampGeometry(), postMaterial, lampCount);
  lamps.name = "Road_Lamp_Columns";
  lamps.frustumCulled = false;
  lamps.castShadow = true;

  // Overpass (open road): realtime, it spans the road and casts its shadow across it.
  const concrete = new MeshStandardMaterial({
    color: "#ffffff",
    map: createConcreteTexture(),
    roughness: 0.9,
  });
  concrete.map!.repeat.set(1 / 6, 1 / 3);
  const overpass = createOverpass(concrete);
  overpass.visible = false;

  // ---------------------------------------------------------------- scenery, sky, route
  const scenery = kit ? createRoadScenery(kit, { behind: ROAD_BEHIND }) : null;
  const horizon = kit ? createHorizonPlates(kit) : null;

  const ridge = createRidge(420, 16, 11);
  // A paler, higher range behind it: aerial perspective in two steps.
  const farRidge = createRidge(440, 34, 23);
  farRidge.name = "Backdrop_Ridge_Far";

  // Low sun on the asphalt: a long warm sheen down the road towards the sun,
  // starting ~420 m out under the sun and running back towards the camera
  // (a real specular streak's geometry); it fades as the route takes over.
  let sunGlintLevel = 1;
  const sunSource: GlintSource = {
    x: 0,
    z: 0,
    length: 390,
    width: 8,
    color: "#ffc98a",
    strength: 0.4,
  };
  const sunGlint = createGroundGlints([sunSource], "Road_Sun_Glint", () => sunGlintLevel);
  const aimGlint = sunGlint.mesh.onBeforeRender;
  sunGlint.mesh.onBeforeRender = (renderer, scene, camera, geometry, material, grp) => {
    sunSource.x = camera.position.x + (SUN_DIRECTION.x / SUN_DIRECTION.z) * 420;
    sunSource.z = camera.position.z + 420;
    aimGlint.call(sunGlint.mesh, renderer, scene, camera, geometry, material, grp);
  };

  // Sun disc: a small glow card (additive, unlit) far along the sun direction.
  const sunGlow = new Mesh(
    new PlaneGeometry(1, 1),
    new MeshBasicMaterial({
      map: createGlowTexture(),
      color: "#ffd9a0",
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      fog: false,
      toneMapped: false,
    }),
  );
  sunGlow.name = "Road_Sun_Glow";
  sunGlow.position.copy(SUN_DIRECTION).multiplyScalar(400);
  sunGlow.scale.setScalar(52);
  sunGlow.lookAt(0, 0, 0);
  sunGlow.renderOrder = 1;

  // Beats 5–6: the lane line becomes the route, the route becomes Italy.
  const italy = createItalyStage();

  const ambient = new HemisphereLight("#b9c3cf", "#3a3a30", 0.6);
  ambient.name = "Road_Ambient";
  // Low sun ahead down the road: the truck is backlit and rim-lit, shadows fall
  // back towards the camera.
  const sun = new DirectionalLight("#ffd2a1", SUN_INTENSITY);
  sun.name = "Road_Sun";
  sun.position.set(SUN_DIRECTION.x * 100, 22, SUN_DIRECTION.z * 100);
  sun.target.position.set(0, 0, 0);
  sun.shadow.camera.left = -20;
  sun.shadow.camera.right = 20;
  sun.shadow.camera.top = 20;
  sun.shadow.camera.bottom = -20;

  group.add(
    groundPlane,
    ...(aerialPlane ? [aerialPlane] : []),
    belts,
    shadows,
    mist,
    carriageway,
    opposite,
    markings,
    ...beams,
    ...posts,
    lamps,
    ...tufts,
    ...dustStrips,
    overpass,
    ...(scenery ? [scenery.group] : []),
    ...(horizon ? [horizon.group] : []),
    ridge,
    farRidge,
    sunGlint.mesh,
    sunGlow,
    italy.group,
    ambient,
    sun,
    sun.target,
  );

  const placeRow = (
    mesh: InstancedMesh,
    count: number,
    spacing: number,
    offset: number,
    x: number,
    scaleY = 1,
  ) => {
    const phase = offset % spacing;
    for (let i = 0; i < count; i++) {
      matrix.makeScale(1, scaleY, 1).setPosition(x, 0, -ROAD_BEHIND + i * spacing - phase);
      mesh.setMatrixAt(i, matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  };
  const recycle = (z0: number, offset: number, window: number) =>
    ((((z0 - offset) % window) + window) % window) - ROAD_BEHIND;
  let overpassLastZ = Number.NaN;
  let overpassChapter = false;
  let overpassPhase = 0;
  let lastChapter: string | null = null;
  let wasActive = false;

  return {
    group,
    ambient,
    sun,
    sunDirection: SUN_DIRECTION,
    ridge: ridge.material as MeshBasicMaterial,
    farRidge: farRidge.material as MeshBasicMaterial,
    prepare() {
      scenery?.prepare();
    },
    update(offset, layers, story) {
      const { routeBlend, mapBlend, journey, active } = story;
      const settle = 1 - routeBlend;
      // The physical world dissolves into the information space as the camera rises.
      // The physical ground is gone before Italy's shape is legible (italy-stage.ts): fading
      // together, the leftover farmland showed through the sea and the neighbouring land as one
      // brown mass around the Italian coast.
      const ground = 1 - smooth(0.04, 0.38, mapBlend);
      const chapter = chapterOf(journey);

      // Everything on the ground flows at road speed.
      const flow = -((offset / tileLength) % 1);
      for (const t of [...roadMaps, ...oppositeMaps]) t.offset.y = flow;
      aggregateUniforms.detailOffset.value = -((offset / AGGREGATE_TILE) % 1);
      fieldMap.offset.y = -((offset / FIELD_TILE) % 1);
      galvanized.offset.x = (offset / 4) % 1;
      if (!kit) {
        const phase = offset % DASH_SPACING;
        for (let i = 0; i < dashCount; i++) {
          matrix.makeTranslation(DIVIDER, 0.012, -ROAD_BEHIND + i * DASH_SPACING - phase);
          dashes.setMatrixAt(i, matrix);
        }
        dashes.instanceMatrix.needsUpdate = true;
        markingMaterial.opacity = Math.max(settle, 0.4) * ground;
      }
      sunGlintLevel = settle;

      // Guardrails and posts sink away as the route language takes over.
      railMaterial.opacity = settle;
      for (const beam of beams) beam.visible = settle > 0.02;
      const showPosts = layers >= 3 && settle > 0.02;
      tufts.forEach((mesh, i) => {
        mesh.visible = showPosts;
        if (!showPosts) return;
        const phase = offset % TUFT_SPACING;
        const side = rails[i]!;
        for (let k = 0; k < tuftCount; k++) {
          const v = Math.sin(k * 78.233) * 43758.5453;
          const f = v - Math.floor(v);
          const sc = (0.5 + 0.7 * f) * settle * (f > 0.12 ? 1 : 0.001);
          matrix
            .makeScale(sc, sc * (0.7 + f), sc)
            .setPosition(
              side.x - side.facing * (0.2 + 0.7 * ((f * 13) % 1)) + (f - 0.5) * 0.3,
              terrainHeight(0, 0),
              -ROAD_BEHIND + k * TUFT_SPACING - phase + f * 0.5,
            );
          mesh.setMatrixAt(k, matrix);
        }
        mesh.instanceMatrix.needsUpdate = true;
      });
      posts.forEach((mesh, i) => {
        mesh.visible = showPosts;
        if (showPosts) placeRow(mesh, postCount, POST_SPACING, offset, rails[i]!.x, settle);
      });
      // Lamp columns belong to the built-up chapters.
      lamps.visible = layers >= 4 && settle > 0.02 && journey < 2.05;
      if (lamps.visible) placeRow(lamps, lampCount, LAMP_SPACING, offset, RIGHT_EDGE - 6.2, settle);

      // Overpass: the open road's structural landmark. It enters ~320 m ahead
      // when the chapter begins, then flows past; later ones respawn on the horizon.
      if (active && chapter === "C" && (chapter !== lastChapter || !wasActive)) {
        const base = (((620 - offset) % 900) + 900) % 900;
        overpassPhase = 320 + ROAD_BEHIND - base;
        overpassLastZ = Number.NaN;
        overpassChapter = true;
      }
      lastChapter = active ? chapter : null;
      const oz = recycle(620 + overpassPhase, offset, 900);
      if (
        (active && !wasActive && chapter !== "C") ||
        (!Number.isNaN(overpassLastZ) && oz > overpassLastZ + 450)
      ) {
        overpassChapter = chapter === "C";
      }
      overpassLastZ = oz;
      overpass.visible = overpassChapter && settle > 0.02;
      overpass.position.z = oz;
      overpass.scale.y = Math.max(0.001, settle);
      scenery?.update(offset, { journey, routeBlend, mapBlend, active });
      horizon?.update(journey, settle);
      wasActive = active;

      // Terrain settles to graphite, then dissolves into the carbon information
      // space while Italy emerges under the rising camera.
      // The physical road keeps its own dark, legible colour through the route-line reveal
      // (routeBlend) and only tints towards graphite once the map abstraction genuinely
      // begins (mapBlend) — otherwise the lane markings vanish into the aerial texture's
      // tone at the exact moment they matter most (the route line drawing over a real road).
      asphalt.color.copy(baseAsphalt).lerp(routeColor, mapBlend * 0.8);
      if (oppositeAsphalt !== asphalt) oppositeAsphalt.color.copy(asphalt.color);
      fields.color.copy(fieldColor).lerp(routeColor, routeBlend * 0.9);
      for (const material of [asphalt, oppositeAsphalt, fields]) {
        material.transparent = ground < 0.999;
        // A fading plane must not write depth: from kilometres up it would
        // occlude the route lines lying just above it.
        material.depthWrite = !material.transparent;
        material.opacity = ground;
      }
      carriageway.visible =
        opposite.visible =
        groundPlane.visible =
        markings.visible =
          ground > 0.001;
      if (aerialPlane && aerialMaterial) {
        // The real aerial tile takes over as the terrain tints towards graphite
        // (settle falling), then fades with the rest of the ground into Italy.
        // The aerial tile lies over the field plane, which stays opaque until the whole ground
        // dissolves: two half-transparent layers let ~25 % of the sunrise sky show through the
        // ground mid-crossfade, which read as a flat orange plain.
        const aerialWeight = smooth(0.15, 0.75, routeBlend);
        aerialMaterial.opacity = aerialWeight * ground;
        aerialPlane.visible = aerialMaterial.opacity > 0.001;
        beltGrow.value = aerialWeight * ground;
        belts.visible = beltGrow.value > 0.02;
        shadowMat.opacity = 0.16 * beltGrow.value;
        shadows.visible = belts.visible;
        mistMat.opacity = 0.16 * aerialWeight * ground;
        mist.visible = mistMat.opacity > 0.01;
      }
      // Relief sinks as soon as the camera starts to rise (seen from above it
      // would read as a ring around the world).
      // The ring-shaped relief mesh reads as a believable distant band at low driving-camera
      // height, but from the Reach rise's near-top-down angle it cuts across the frame as an
      // ugly pale stripe — keep it tied to routeBlend (hidden once Reach begins) rather than
      // trying to repurpose it as aerial hill relief.
      ridge.scale.y = farRidge.scale.y = Math.max(0.001, settle);
      ridge.visible = farRidge.visible = settle > 0.001;
      (sunGlow.material as MeshBasicMaterial).opacity = settle;
      // The warm physical light recedes as the informational layer takes over.
      sun.intensity = SUN_INTENSITY * (0.45 + 0.55 * settle);
      italy.update(story);
    },
  };
}
