import {
  AdditiveBlending,
  BufferGeometry,
  CanvasTexture,
  CatmullRomCurve3,
  Color,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  LinearFilter,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  type Object3D,
  ShaderMaterial,
  Shape,
  ShapeGeometry,
  Sprite,
  SpriteMaterial,
  Vector2,
  Vector3,
  type WebGLRenderer,
} from "three";

import { SCENE_COLORS } from "@/lib/three/brand-colors";

import { CONTEXT_RINGS, ITALY_RINGS } from "./italy-geo";
import {
  CORRIDORS,
  type Corridor,
  EUROPE_HINTS,
  geoToWorld,
  HUBS,
  ITALY_VIEW_CENTRE,
  LABELS,
  lonLatOf,
  MAP_SCALE,
  type PlaceId,
  PLACES,
} from "./italy-network";

/*
 * Beats 5–6: the road becomes the network, the network becomes Italy.
 *
 * Everything lies on the road world's ground plane (see italy-network.ts for
 * scale and placement). Route lines are one shader: each ribbon is widened in
 * the vertex shader to a constant on-screen width (never thinner than a real
 * lane line), so the same line reads as paint on the asphalt at road level
 * and as a national corridor from 2 000 km up. The network grows outward from
 * Carpi by path distance (one uniform), ferry legs are dashed, and the Europe
 * continuation fades out within a few hundred kilometres of the border.
 */

const Y_LAND = -0.01; // just under the asphalt (hidden while the road is visible)
const Y_ROUTE = 0.03; // over the lane markings
const LAND_ITALY = "#1f2b27";
const LAND_CONTEXT = "#121816";
const COAST = "#6e8a80";
const LABEL_TEXT = "rgba(236, 241, 238, 0.92)";

type Mode = 0 | 1 | 2 | 3; // line, glow, disc, ring

const VERTEX = /* glsl */ `
  attribute vec3 aDir;
  attribute float aSide;
  attribute float aAlong;
  attribute float aDash;
  uniform float uPx;
  uniform float uMin;
  uniform vec2 uViewport;
  varying float vSide;
  varying float vAlong;
  varying float vDash;
  void main() {
    vec4 centre = modelViewMatrix * vec4(position, 1.0);
    float depth = max(1e-3, -centre.z);
    float worldPerPx = 2.0 * depth / (projectionMatrix[1][1] * uViewport.y);
    // Width in screen space: measure how many pixels one world unit along the
    // offset direction covers here, so lines keep their pixel width even at
    // grazing angles (and discs stay round). Capped against extreme grazing.
    vec4 c0 = projectionMatrix * centre;
    vec4 c1 = projectionMatrix * modelViewMatrix * vec4(position + aDir, 1.0);
    float pxPerUnit = c1.w > 0.0
      ? length((c1.xy / c1.w - c0.xy / c0.w) * 0.5 * uViewport)
      : 1.0 / worldPerPx;
    float width = max(uMin, min(uPx / max(pxPerUnit, 1e-6), uPx * worldPerPx * 4.0));
    vec3 p = position + aDir * aSide * width * 0.5;
    vSide = aSide;
    vAlong = aAlong;
    vDash = aDash;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;

const FRAGMENT = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;
  uniform float uGrow;
  uniform float uFadeFrom;
  uniform float uFadeTo;
  uniform int uMode;
  varying float vSide;
  varying float vAlong;
  varying float vDash;
  void main() {
    float edge = abs(vSide);
    float a;
    if (uMode == 0) a = 1.0 - smoothstep(0.5, 1.0, edge);
    else if (uMode == 1) a = (1.0 - edge) * (1.0 - edge);
    else if (uMode == 2) a = 1.0 - smoothstep(0.65, 1.0, edge);
    else a = smoothstep(0.7, 0.84, edge) * (1.0 - smoothstep(0.9, 1.0, edge));
    // Growth front (km along the network from Carpi), softened over 12 km.
    a *= 1.0 - smoothstep(uGrow - 12.0, uGrow, vAlong);
    // Ferry legs: dashed and lighter — a crossing, never a bridge.
    if (vDash > 0.5) a *= step(0.5, fract(vAlong / 10.0)) * 0.7;
    a *= 1.0 - smoothstep(uFadeFrom, uFadeTo, vAlong);
    gl_FragColor = vec4(uColor, a * uOpacity);
    #include <colorspace_fragment>
  }
`;

function routeMaterial(options: {
  color: string;
  px: number;
  mode: Mode;
  min?: number;
  additive?: boolean;
  fade?: [number, number];
}): ShaderMaterial {
  return new ShaderMaterial({
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    uniforms: {
      uColor: { value: new Color(options.color) },
      uOpacity: { value: 0 },
      uPx: { value: options.px },
      uMin: { value: options.min ?? 0 },
      uViewport: { value: new Vector2(1600, 900) },
      uGrow: { value: 0 },
      uFadeFrom: { value: options.fade?.[0] ?? 1e9 },
      uFadeTo: { value: options.fade?.[1] ?? 2e9 },
      uMode: { value: options.mode },
    },
    transparent: true,
    depthWrite: false,
    side: DoubleSide, // flat on the ground: winding is irrelevant
    ...(options.additive ? { blending: AdditiveBlending } : {}),
  });
}

/** Ribbon/disc vertex streams for the route shader. */
class Streams {
  position: number[] = [];
  dir: number[] = [];
  side: number[] = [];
  along: number[] = [];
  dash: number[] = [];
  index: number[] = [];

  ribbon(points: Vector3[], along: number[], dash: boolean): void {
    const base = this.position.length / 3;
    points.forEach((p, i) => {
      const prev = points[Math.max(0, i - 1)]!;
      const next = points[Math.min(points.length - 1, i + 1)]!;
      const dx = next.x - prev.x;
      const dz = next.z - prev.z;
      const len = Math.hypot(dx, dz) || 1;
      for (const side of [1, -1]) {
        this.position.push(p.x, Y_ROUTE, p.z);
        this.dir.push(-dz / len, 0, dx / len);
        this.side.push(side);
        this.along.push(along[i]!);
        this.dash.push(dash ? 1 : 0);
      }
      if (i < points.length - 1) {
        const b = base + i * 2;
        this.index.push(b, b + 1, b + 2, b + 1, b + 3, b + 2);
      }
    });
  }

  disc(x: number, z: number, along: number, segments = 28): void {
    const base = this.position.length / 3;
    this.position.push(x, Y_ROUTE + 0.005, z);
    this.dir.push(0, 0, 0);
    this.side.push(0);
    this.along.push(along);
    this.dash.push(0);
    for (let i = 0; i < segments; i++) {
      const a = (i / segments) * Math.PI * 2;
      this.position.push(x, Y_ROUTE + 0.005, z);
      this.dir.push(Math.cos(a), 0, Math.sin(a));
      this.side.push(1);
      this.along.push(along);
      this.dash.push(0);
      this.index.push(base, base + 1 + i, base + 1 + ((i + 1) % segments));
    }
  }

  geometry(): BufferGeometry {
    const g = new BufferGeometry();
    g.setAttribute("position", new Float32BufferAttribute(this.position, 3));
    g.setAttribute("aDir", new Float32BufferAttribute(this.dir, 3));
    g.setAttribute("aSide", new Float32BufferAttribute(this.side, 1));
    g.setAttribute("aAlong", new Float32BufferAttribute(this.along, 1));
    g.setAttribute("aDash", new Float32BufferAttribute(this.dash, 1));
    g.setIndex(this.index);
    return g;
  }
}

const world = (lonLat: readonly [number, number]) => {
  const [x, z] = geoToWorld(lonLat);
  return new Vector3(x, 0, z);
};

/**
 * Lays corridors out as smooth curves with their path distance (km) from the
 * seeds; returns the distance each named place was reached at.
 */
function layCorridors(
  corridors: readonly Corridor[],
  seed: Map<PlaceId, number>,
  sink: (kind: Corridor["kind"], points: Vector3[], along: number[]) => void,
): Map<PlaceId, number> {
  const reached = new Map(seed);
  for (const corridor of corridors) {
    const first = corridor.via[0]!;
    let along = typeof first === "string" ? (reached.get(first) ?? 0) : 0;
    const control = corridor.via.map((v) => world(lonLatOf(v)));
    const curve = new CatmullRomCurve3(control, false, "centripetal");
    const lengthKm = curve.getLength() / MAP_SCALE;
    const points = curve.getSpacedPoints(Math.max(4, Math.ceil(lengthKm / 3)));
    const alongs = points.map((p, i) => {
      if (i > 0) along += p.distanceTo(points[i - 1]!) / MAP_SCALE;
      return along;
    });
    // Named waypoints are reached at the along of their nearest sample.
    for (const v of corridor.via) {
      if (typeof v !== "string") continue;
      const at = world(PLACES[v]);
      let best = 0;
      points.forEach((p, i) => {
        if (p.distanceToSquared(at) < points[best]!.distanceToSquared(at)) best = i;
      });
      reached.set(v, Math.min(reached.get(v) ?? Infinity, alongs[best]!));
    }
    sink(corridor.kind, points, alongs);
  }
  return reached;
}

function ringsToShapes(rings: readonly (readonly number[])[]): Shape[] {
  return rings.map((ring) => {
    const points: Vector2[] = [];
    for (let i = 0; i < ring.length - 2; i += 2) {
      const [x, z] = geoToWorld([ring[i]!, ring[i + 1]!]);
      points.push(new Vector2(x, -z)); // shape plane → ground via rotateX(−90°)
    }
    return new Shape(points);
  });
}

function landMesh(rings: readonly (readonly number[])[], material: MeshBasicMaterial | ShaderMaterial) {
  const geometry = new ShapeGeometry(ringsToShapes(rings)).rotateX(-Math.PI / 2).translate(0, Y_LAND, 0);
  const mesh = new Mesh(geometry, material);
  mesh.frustumCulled = false;
  return mesh;
}

/** Neighbouring land: one faint mass fading out with distance from Italy (no borders). */
function contextMaterial(): ShaderMaterial {
  return new ShaderMaterial({
    vertexShader: /* glsl */ `
      varying vec2 vWorld;
      void main() {
        vec4 w = modelMatrix * vec4(position, 1.0);
        vWorld = w.xz;
        gl_Position = projectionMatrix * viewMatrix * w;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform float uOpacity;
      uniform vec2 uCentre;
      uniform float uNear;
      uniform float uFar;
      varying vec2 vWorld;
      void main() {
        float fade = 1.0 - smoothstep(uNear, uFar, distance(vWorld, uCentre));
        gl_FragColor = vec4(uColor, uOpacity * fade);
        #include <colorspace_fragment>
      }
    `,
    uniforms: {
      uColor: { value: new Color(LAND_CONTEXT) },
      uOpacity: { value: 0 },
      uCentre: { value: new Vector2(ITALY_VIEW_CENTRE[0], ITALY_VIEW_CENTRE[1]) },
      uNear: { value: 500 * MAP_SCALE },
      uFar: { value: 1100 * MAP_SCALE },
    },
    transparent: true,
    depthWrite: false,
  });
}

function coastLines(rings: readonly (readonly number[])[]): LineSegments {
  const positions: number[] = [];
  for (const ring of rings) {
    for (let i = 0; i < ring.length - 2; i += 2) {
      const j = (i + 2) % (ring.length - 2);
      const [x0, z0] = geoToWorld([ring[i]!, ring[i + 1]!]);
      const [x1, z1] = geoToWorld([ring[j]!, ring[j + 1]!]);
      positions.push(x0, Y_LAND + 0.004, z0, x1, Y_LAND + 0.004, z1);
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  const lines = new LineSegments(
    geometry,
    new LineBasicMaterial({ color: COAST, transparent: true, opacity: 0, depthWrite: false }),
  );
  lines.frustumCulled = false;
  return lines;
}

type Anchor = "left" | "right" | "above";
const LABEL_ANCHORS: Record<string, Anchor> = {
  carpi: "right",
  milano: "above",
  roma: "left",
  napoli: "left",
};

interface Label {
  sprite: Sprite;
  material: SpriteMaterial;
  heightPx: number;
  aspect: number;
}

/**
 * Map labels: decorative canvas text in the site's typeface, kept at a
 * constant on-screen size (the hero canvas is aria-hidden; the coverage
 * message itself lives in the HTML copy).
 */
function createLabel(text: string, origin: boolean, anchor: Anchor): Label | null {
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) return null;
  const fontPx = 44;
  const family = getComputedStyle(document.body).fontFamily || "sans-serif";
  const font = `${origin ? 600 : 500} ${fontPx}px ${family}`;
  context.font = font;
  const width = Math.ceil(context.measureText(text).width) + 8;
  canvas.width = width;
  canvas.height = Math.ceil(fontPx * 1.4);
  const texture = new CanvasTexture(canvas);
  texture.minFilter = LinearFilter;
  texture.generateMipmaps = false;
  const draw = () => {
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.font = font;
    context.fillStyle = LABEL_TEXT;
    context.textBaseline = "middle";
    context.fillText(text, 4, canvas.height / 2);
    texture.needsUpdate = true;
  };
  draw();
  // Redraw once the web font is ready (first draw may use the fallback face).
  void document.fonts?.ready.then(draw);
  const material = new SpriteMaterial({
    map: texture,
    transparent: true,
    opacity: 0,
    depthTest: false,
    depthWrite: false,
    sizeAttenuation: false,
    fog: false,
  });
  const sprite = new Sprite(material);
  sprite.renderOrder = 10;
  const aspect = canvas.width / canvas.height;
  const gap = 0.55 / aspect; // ≈ half a text height between node and label
  if (anchor === "right") sprite.center.set(-gap - 0.25 / aspect, 0.5);
  else if (anchor === "left") sprite.center.set(1 + gap + 0.25 / aspect, 0.5);
  else sprite.center.set(0.5, -0.45);
  return { sprite, material, heightPx: origin ? 15 : 13, aspect };
}

export interface ItalyStage {
  group: Group;
  /** Blends: road → route (reach), route → Italy (map), Italy → "and beyond". */
  update(state: { routeBlend: number; mapBlend: number; europeBlend: number }): void;
}

const smooth = (a: number, b: number, t: number) => {
  const x = Math.min(1, Math.max(0, (t - a) / (b - a)));
  return x * x * (3 - 2 * x);
};

export function createItalyStage(): ItalyStage {
  const group = new Group();
  group.name = "Italy_Stage";

  // ---------------------------------------------------------------- land
  const italyMaterial = new MeshBasicMaterial({
    color: LAND_ITALY,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    fog: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -2,
  });
  const italy = landMesh(ITALY_RINGS, italyMaterial);
  italy.name = "Italy_Land";
  italy.renderOrder = 1;
  const context = contextMaterial();
  const contextLand = landMesh(CONTEXT_RINGS, context);
  contextLand.name = "Europe_Context_Land";
  const coast = coastLines(ITALY_RINGS);
  coast.name = "Italy_Coast";
  coast.renderOrder = 2;

  // ---------------------------------------------------------------- network
  const green = SCENE_COLORS.green500;
  const primary = new Streams();
  const secondary = new Streams();
  const sea = new Streams();
  const reached = layCorridors(CORRIDORS, new Map([["carpi", 0]]), (kind, points, along) => {
    (kind === "primary" ? primary : kind === "sea" ? sea : secondary).ribbon(points, along, kind === "sea");
  });
  const networkKm = Math.max(...primary.along, ...secondary.along, ...sea.along);
  const firstLegKm = reached.get("verona")!;

  // Materials: a fine primary line with a soft glow, lighter secondaries, dashed ferries.
  const primaryLine = routeMaterial({ color: green, px: 2.6, mode: 0, min: 0.15 });
  const primaryGlow = routeMaterial({ color: green, px: 11, mode: 1, additive: true });
  const secondaryLine = routeMaterial({ color: green, px: 1.5, mode: 0, min: 0.1 });
  const seaLine = routeMaterial({ color: green, px: 1.5, mode: 0 });
  const primaryGeometry = primary.geometry();
  const network: Array<[BufferGeometry, ShaderMaterial, string]> = [
    [primaryGeometry, primaryGlow, "Route_Primary_Glow"],
    [primaryGeometry, primaryLine, "Route_Primary"],
    [secondary.geometry(), secondaryLine, "Route_Secondary"],
    [sea.geometry(), seaLine, "Route_Ferry"],
  ];

  // Hubs: small cores; the origin gets a ring pair.
  const cores = new Streams();
  for (const hub of HUBS) {
    const [x, z] = geoToWorld(PLACES[hub]);
    if (hub !== "carpi") cores.disc(x, z, reached.get(hub) ?? 0);
  }
  const origin = new Streams();
  const [ox, oz] = geoToWorld(PLACES.carpi);
  origin.disc(ox, oz, 0);
  const coreMaterial = routeMaterial({ color: "#8fe0b8", px: 4.2, mode: 2 });
  const originCore = routeMaterial({ color: "#b8f0d4", px: 6.5, mode: 2 });
  const originRing = routeMaterial({ color: green, px: 17, mode: 3 });
  const originHalo = routeMaterial({ color: green, px: 30, mode: 3 });
  const originGeometry = origin.geometry();
  network.push(
    [cores.geometry(), coreMaterial, "Route_Hubs"],
    [originGeometry, originCore, "Route_Origin"],
    [originGeometry, originRing, "Route_Origin_Ring"],
    [originGeometry, originHalo, "Route_Origin_Halo"],
  );

  // Europe: faint continuations toward the confirmed corridors, fading out.
  const europe = new Streams();
  const gateways = new Map<PlaceId, number>(HUBS.map((hub) => [hub, 0]));
  layCorridors(EUROPE_HINTS, gateways, (kind, points, along) => europe.ribbon(points, along, kind === "sea"));
  const europeLine = routeMaterial({ color: green, px: 1.3, mode: 0, fade: [140, 520] });
  network.push([europe.geometry(), europeLine, "Route_Europe_Hint"]);

  const viewSize = new Vector2();
  const routeMeshes: Mesh[] = network.map(([geometry, material, name]) => {
    const mesh = new Mesh(geometry, material);
    mesh.name = name;
    mesh.frustumCulled = false;
    mesh.renderOrder = 3;
    mesh.onBeforeRender = (renderer: WebGLRenderer) => {
      renderer.getSize(material.uniforms.uViewport!.value as Vector2);
    };
    return mesh;
  });

  // ---------------------------------------------------------------- labels
  const labels: Label[] = [];
  for (const { place, text, origin: isOrigin } of LABELS) {
    const label = createLabel(text, Boolean(isOrigin), LABEL_ANCHORS[place] ?? "right");
    if (!label) continue;
    const [x, z] = geoToWorld(PLACES[place]);
    label.sprite.position.set(x, Y_ROUTE, z);
    label.sprite.name = `Label_${place}`;
    label.sprite.onBeforeRender = (renderer, _scene, camera) => {
      const p11 = camera.projectionMatrix.elements[5]!;
      const h = renderer.getSize(viewSize).y;
      const s = (label.heightPx * 2) / (p11 * h);
      label.sprite.scale.set(s * label.aspect, s, 1);
    };
    labels.push(label);
  }

  group.add(contextLand, italy, coast, ...routeMeshes, ...labels.map((l) => l.sprite));
  const children: Object3D[] = [...group.children];

  return {
    group,
    update({ routeBlend, mapBlend, europeBlend }) {
      const visible = routeBlend > 0.001;
      for (const child of children) child.visible = visible;
      if (!visible) return;

      // Reach: the lane line turns green and runs ahead to Verona; the map
      // then grows outward from Carpi across the whole country.
      const grow = routeBlend * firstLegKm + smooth(0.02, 0.75, mapBlend) * (networkKm - firstLegKm + 20);
      const route = smooth(0, 0.35, routeBlend);
      for (const m of [primaryLine, primaryGlow, secondaryLine, seaLine, coreMaterial]) {
        m.uniforms.uGrow!.value = grow;
      }
      primaryLine.uniforms.uOpacity!.value = route;
      primaryGlow.uniforms.uOpacity!.value = route * 0.22;
      secondaryLine.uniforms.uOpacity!.value = route * 0.6;
      seaLine.uniforms.uOpacity!.value = route * 0.75;
      coreMaterial.uniforms.uOpacity!.value = smooth(0.2, 0.6, mapBlend) * 0.9;
      originCore.uniforms.uOpacity!.value = smooth(0.1, 0.5, mapBlend);
      originRing.uniforms.uOpacity!.value = smooth(0.15, 0.55, mapBlend) * 0.8;
      originHalo.uniforms.uOpacity!.value = smooth(0.2, 0.6, mapBlend) * 0.3;
      for (const m of [originCore, originRing, originHalo]) m.uniforms.uGrow!.value = 1e9;

      italyMaterial.opacity = smooth(0.05, 0.55, mapBlend);
      (coast.material as LineBasicMaterial).opacity = smooth(0.15, 0.6, mapBlend) * 0.55;
      context.uniforms.uOpacity!.value = smooth(0.35, 0.9, mapBlend) * (0.55 + 0.45 * europeBlend);

      europeLine.uniforms.uGrow!.value = europeBlend * 620;
      europeLine.uniforms.uOpacity!.value = smooth(0, 0.6, europeBlend) * 0.5;

      const labelOpacity = smooth(0.65, 1, mapBlend);
      for (const label of labels) label.material.opacity = labelOpacity;
    },
  };
}
