import {
  BackSide,
  type BufferGeometry,
  Color,
  CylinderGeometry,
  DoubleSide,
  Float32BufferAttribute,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  PMREMGenerator,
  RingGeometry,
  Scene,
  SphereGeometry,
  type Texture,
  type Vector3,
  type WebGLRenderer,
  type WebGLRenderTarget,
} from "three";

/*
 * Image-based lighting generated from the hero's own sky (no HDR asset, no
 * dependency): the sky dome's colours plus one warm card for the lit dock bay
 * are prefiltered with Three's PMREMGenerator into `scene.environment`. This
 * gives paint, glass and damp concrete their blue-hour reflections and keeps
 * reflections consistent with the visible sky through the light story.
 *
 * Regenerated only when the light state moves by a quantised step (a few
 * times over the whole story, each a few milliseconds on a GPU), never per
 * frame. A production HDR/EXR environment can replace `sky` later without
 * touching materials.
 */

/** Light-story steps: the environment regenerates at most this many times over dawn 0→1. */
const DAWN_STEPS = 12;
const ROUTE_STEPS = 4;

export interface HeroEnvironment {
  readonly texture: Texture | null;
  /** Regenerates when the quantised state changed; returns true if it did. */
  update(state: {
    dawn: number;
    routeBlend: number;
    world: "dock" | "road";
    dockBayDirection: Vector3;
    dockLight: number;
    /** Direction of the sun / pre-dawn glow (world space). */
    sunDirection: Vector3;
    /** Horizon haze colour (ground reflections fade into it). */
    horizon: Color;
  }): boolean;
  dispose(): void;
}

/**
 * Scene-specific reflection content, added to the sky dome so paint, glass and wheels
 * reflect the place they stand in rather than a bare gradient:
 *  - a ground disc (dark damp concrete at the dock, warm-grey asphalt on the road) fading
 *    into the horizon haze, so lower body panels and wheel hubs mirror the ground;
 *  - dock: a dark cladding wall along the facade with its warm bay openings;
 *  - road: a dark tree/building line at the horizon and the sun disc (an HDR value, so sun
 *    glints on paint are the real hot specular they are in a photograph).
 * All of it is coarse on purpose: PMREM blurs it into roughness-dependent reflection.
 */
function createReflectionProps() {
  const RADIUS = 78;
  const groundGeometry = new RingGeometry(0.5, RADIUS, 48, 6).rotateX(-Math.PI / 2);
  const groundColors = new Float32BufferAttribute(new Float32Array(groundGeometry.attributes.position!.count * 3), 3);
  groundGeometry.setAttribute("color", groundColors);
  const ground = new Mesh(groundGeometry, new MeshBasicMaterial({ vertexColors: true, side: DoubleSide }));
  ground.position.y = -1.7;
  const scratch = new Color();
  /** Ground colour that fades into the horizon haze towards the rim (aerial perspective). */
  const paintGround = (base: Color, haze: Color, hazeStart: number) => {
    const position = groundGeometry.attributes.position!;
    for (let i = 0; i < position.count; i++) {
      const r = Math.hypot(position.getX(i), position.getZ(i)) / RADIUS;
      const k = Math.min(1, Math.max(0, (r - hazeStart) / (1 - hazeStart)));
      scratch.copy(base).lerp(haze, k * k);
      groundColors.setXYZ(i, scratch.r, scratch.g, scratch.b);
    }
    groundColors.needsUpdate = true;
  };
  const wall = new Mesh(new PlaneGeometry(70, 14), new MeshBasicMaterial({ color: "#26303c", side: DoubleSide }));
  const lineMaterial = new MeshBasicMaterial({ color: "#1c2416", side: BackSide });
  const line = new Mesh(new CylinderGeometry(RADIUS - 2, RADIUS - 2, 5, 48, 1, true), lineMaterial);
  line.position.y = 0.6;
  const sunMaterial = new MeshBasicMaterial({ color: "#ffd6a0", toneMapped: false });
  const sunDisc = new Mesh(new SphereGeometry(2.1, 12, 8), sunMaterial);
  return { ground, wall, line, lineMaterial, sunDisc, sunMaterial, paintGround };
}

/**
 * `cubeSize`: the smooth procedural sky needs little resolution (128 ≈ a
 * 512×256 map, the approved size for rough-surface lighting); smaller sizes
 * cut the prefilter cost on weaker GPUs.
 */
export function createHeroEnvironment(
  renderer: WebGLRenderer,
  skyGeometry: BufferGeometry,
  cubeSize = 128,
): HeroEnvironment {
  const pmrem = new PMREMGenerator(renderer);
  const envScene = new Scene();
  // Shares the dome's geometry, so its vertex colours are always current.
  const skyMaterial = new MeshBasicMaterial({ vertexColors: true, side: BackSide });
  const sky = new Mesh(skyGeometry, skyMaterial);
  // Scaled into the cube camera's range; only direction matters for IBL.
  sky.scale.setScalar(80 / (skyGeometry.boundingSphere?.radius ?? 450));
  const bayMaterial = new MeshBasicMaterial({ color: "#ffc98f" });
  const bay = new Mesh(new PlaneGeometry(14, 6), bayMaterial);
  const props = createReflectionProps();
  envScene.add(sky, bay, props.ground, props.wall, props.line, props.sunDisc);
  const groundDock = new Color("#23252b");
  const groundRoad = new Color("#4a4640");
  const base = new Color();

  let target: WebGLRenderTarget | null = null;
  let key = "";

  return {
    get texture() {
      return target?.texture ?? null;
    },
    update({ dawn, routeBlend, world, dockBayDirection, dockLight, sunDirection, horizon }) {
      const nextKey = [
        world,
        Math.round(dawn * DAWN_STEPS),
        Math.round(routeBlend * ROUTE_STEPS),
        Math.round(dockLight * 4),
      ].join(":");
      if (nextKey === key) return false;
      key = nextKey;

      skyGeometry.computeBoundingSphere();
      sky.scale.setScalar(80 / skyGeometry.boundingSphere!.radius);
      const onDock = world === "dock";
      bay.visible = onDock && dockLight > 0.01;
      if (bay.visible) {
        bay.position.copy(dockBayDirection).setY(0).normalize().multiplyScalar(30).setY(3);
        bay.lookAt(0, 3, 0);
        bayMaterial.color.set("#ffc98f").multiplyScalar(2.5 * dockLight);
      }
      // Scene-specific reflection content (ground, facade wall / tree line, sun disc).
      base.copy(onDock ? groundDock : groundRoad).multiplyScalar(0.55 + 0.6 * dawn);
      props.paintGround(base, horizon, onDock ? 0.55 : 0.35);
      props.wall.visible = onDock;
      if (onDock) {
        props.wall.position.copy(dockBayDirection).setY(0).normalize().multiplyScalar(34).setY(5);
        props.wall.lookAt(0, 5, 0);
      }
      props.line.visible = !onDock;
      props.lineMaterial.color.copy(horizon).multiplyScalar(0.28);
      props.sunDisc.visible = !onDock && routeBlend < 0.6;
      if (props.sunDisc.visible) {
        props.sunDisc.position.copy(sunDirection).setY(0).normalize().multiplyScalar(70).setY(3.2);
        props.sunMaterial.color.set("#ffd6a0").multiplyScalar(10 * (1 - routeBlend));
      }
      // Towards the route language the reflections settle to the plain graphite world.
      skyMaterial.color.setScalar(1 - routeBlend * 0.85);

      const next = pmrem.fromScene(envScene, 0, 0.1, 200, { size: cubeSize });
      target?.dispose();
      target = next;
      return true;
    },
    dispose() {
      target?.dispose();
      target = null;
      pmrem.dispose();
      skyMaterial.dispose();
      bayMaterial.dispose();
      bay.geometry.dispose();
      for (const mesh of [props.ground, props.wall, props.line, props.sunDisc]) {
        mesh.geometry.dispose();
        (mesh.material as MeshBasicMaterial).dispose();
      }
    },
  };
}
