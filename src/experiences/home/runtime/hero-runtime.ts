import { Color, Fog, Matrix4, type PerspectiveCamera, type Scene, type WebGLRenderer } from "three";

import { SCENE_COLORS } from "@/lib/three/brand-colors";

import type { HeroQualitySettings } from "../config/hero-quality";
import { HERO_RIG } from "../config/hero-rig";
import { type AspectBucket, aspectBucket } from "../config/hero-shots";
import { HERO_MARKS, heroStateAt, type HeroStateName } from "../config/hero-states";
import {
  buildReturnPath,
  forwardShotParams,
  type ReturnKeyframe,
  returnShotParams,
  type ShotParams,
  shotPose,
} from "../motion/hero-camera";
import type { ProgressController } from "../motion/hero-progress";
import {
  clampStep,
  type DockKinematics,
  exitPathPose,
  isSettled,
  PARKED,
  type Spring,
  stepDock,
  stepRoadSpeed,
  stepSpring,
} from "../motion/hero-simulation";
import {
  COVERAGE_THRESHOLD,
  gateProgress,
  type HeroWorld,
  INITIAL_STORY_CONTROL,
  type StoryControlState,
  stepStoryControl,
} from "../motion/hero-story-control";
import { buildHeroTimeline, createStoryValues, type StoryValues } from "../motion/hero-timeline";
import { applyCameraPose, rigMatrix, trailerCoverage } from "../scenes/hero-three-math";
import type { HeroEnvironment } from "../scenes/hero-environment";
import type { SkyDome } from "../scenes/hero-sky";
import type { DockWorld } from "../scenes/placeholder-worlds";
import { ROAD_FLOW_WRAP, type RoadWorld } from "../scenes/road-world";
import type { TruckRigBinding } from "../scenes/truck-contract";

export interface HeroSceneBindings {
  scene: Scene;
  camera: PerspectiveCamera;
  renderer: WebGLRenderer;
  rig: TruckRigBinding;
  dock: DockWorld;
  road: RoadWorld;
  sky: SkyDome;
  environment: HeroEnvironment;
}

/** Test/debug audit of the forward-only invariants. Only collected when enabled. */
export interface HeroAudit {
  violations: string[];
  rebases: Array<{ progress: number; coverage: number }>;
  switches: Array<{ to: HeroWorld; progress: number; coverage: number }>;
}

export interface HeroMetrics {
  rawProgress: number;
  displayedProgress: number;
  storyProgress: number;
  state: HeroStateName;
  world: HeroWorld;
  mode: StoryControlState["mode"];
  returnFrom: number | null;
  rebased: boolean;
  dockDistance: number;
  dockSpeed: number;
  roadSpeed: number;
  braking: boolean;
  wheelTravel: number;
  coverage: number;
  bucket: AspectBucket;
  settings: HeroQualitySettings;
  /** Actual drawing-buffer pixel ratio (render scale). */
  pixelRatio: number;
  frozen: boolean;
  camera: { position: [number, number, number]; fov: number };
}

const ROUTE_SKY = new Color(SCENE_COLORS.carbon);
const scratchColor = new Color();

/**
 * One runtime per hero mount. Owns every high-frequency value in plain
 * mutable fields (never React state), and turns story progress into a
 * rendered frame: timeline → forward-only simulation → story control
 * (wipe / return mode) → camera → scene.
 */
export class HeroRuntime {
  readonly values: StoryValues = createStoryValues();
  private readonly timeline: gsap.core.Timeline;
  private readonly exitShotT: number;

  control: StoryControlState = INITIAL_STORY_CONTROL;
  dock: DockKinematics = PARKED;
  roadSpeed = 0;
  roadOffset = 0;
  wheelTravel = 0;
  simTime = 0;
  storyProgress = 0;
  coverage = 0;
  bucket: AspectBucket = "wide";
  frozen = false;
  settings: HeroQualitySettings;
  readonly audit: HeroAudit | null;

  private pitch: Spring = { value: 0, velocity: 0 };
  private heave: Spring = { value: 0, velocity: 0 };
  private lag: Spring = { value: 0, velocity: 0 };
  private previousSpeed = 0;
  private previousBrakeRelease = 0;
  private lastNow: number | null = null;
  private returnPath: ReturnKeyframe[] | null = null;
  private returnStartShotT = 0;
  private cameraParams: ShotParams;
  private width = 1;
  private height = 1;
  private dirty = true;
  private bindings: HeroSceneBindings | null = null;
  private readonly world = new Matrix4();
  private readonly fog = new Fog(ROUTE_SKY.getHex(), 40, 220);
  private appliedShadowSize = -1;

  constructor(
    private readonly progress: ProgressController,
    settings: HeroQualitySettings,
    options: { audit?: boolean } = {},
  ) {
    this.settings = settings;
    this.audit = options.audit ? { violations: [], rebases: [], switches: [] } : null;
    this.timeline = buildHeroTimeline(this.values);
    // Forward camera value where the return path hands back (constant).
    this.timeline.progress(HERO_MARKS.returnExit);
    this.exitShotT = this.values.shotT;
    this.timeline.progress(0);
    this.cameraParams = forwardShotParams(0, this.bucket);
  }

  bind(bindings: HeroSceneBindings): void {
    this.bindings = bindings;
    bindings.rig.root.matrixAutoUpdate = false;
    bindings.scene.fog = this.fog;
    this.appliedShadowSize = -1;
    this.dirty = true;
  }

  unbind(): void {
    if (this.bindings) {
      this.bindings.scene.fog = null;
      this.bindings.scene.environment = null;
    }
    this.bindings = null;
  }

  dispose(): void {
    this.unbind();
    this.timeline.kill();
  }

  setViewport(width: number, height: number): void {
    if (width <= 0 || height <= 0) return;
    this.width = width;
    this.height = height;
    const bucket = aspectBucket(width / height);
    if (bucket !== this.bucket) {
      this.bucket = bucket;
      if (this.returnPath) this.rebuildReturnPath();
    }
    this.bindings?.dock.refreshReflection();
    this.dirty = true;
  }

  setSettings(settings: HeroQualitySettings): void {
    this.settings = settings;
    this.dirty = true;
  }

  markDirty(): void {
    this.dirty = true;
  }

  /** Forget the frame clock (paused offscreen / hidden tab): no time jump on resume. */
  pause(): void {
    this.lastNow = null;
  }

  /**
   * Deterministic state for the current progress, in forward mode — used at
   * handoff checkpoints and for styleframe/checkpoint captures.
   */
  snapToProgress(): void {
    const p = this.progress.displayed;
    this.storyProgress = p;
    this.timeline.progress(p);
    const world: HeroWorld = p >= HERO_MARKS.wipeSwitchForward ? "road" : "dock";
    this.control = { ...INITIAL_STORY_CONTROL, world, peak: p };
    this.dock = {
      distance: world === "road" ? HERO_RIG.wipeDistance : this.values.dockTarget,
      speed: 0,
      braking: false,
    };
    this.roadSpeed = world === "road" ? this.values.cruiseTarget : 0;
    this.previousSpeed = this.roadSpeed;
    this.previousBrakeRelease = this.values.brakeRelease;
    this.pitch = { value: 0, velocity: 0 };
    this.heave = { value: 0, velocity: 0 };
    this.lag = { value: 0, velocity: 0 };
    this.returnPath = null;
    this.lastNow = null;
    this.bindings?.dock.refreshReflection();
    this.dirty = true;
  }

  /** Advances one frame. Returns true when the scene needs rendering. */
  update(now: number): boolean {
    const dt = this.frozen ? 0 : clampStep(this.lastNow === null ? 0 : (now - this.lastNow) / 1000);
    this.lastNow = now;

    const previousProgress = this.storyProgress;
    const next = gateProgress(this.control, previousProgress, this.progress.displayed);
    const progressChanged = next !== previousProgress;
    this.storyProgress = next;
    if (progressChanged) this.timeline.progress(next);

    const previousDistance = this.dock.distance;
    const speed = this.stepSimulation(dt);

    this.cameraParams = this.computeCameraParams();
    if (!this.bindings) return false;
    this.applyRig();
    this.applyCamera();

    const coverageRelevant =
      this.control.mode === "return" ||
      this.control.world === "road" ||
      next >= HERO_MARKS.rollStart;
    this.coverage = coverageRelevant
      ? trailerCoverage(
          this.bindings.camera,
          this.bindings.rig.trailerBody,
          this.bindings.rig.trailerBodyBox,
        )
      : 0;

    const before = this.control;
    const result = stepStoryControl(before, {
      progress: next,
      dockDistance: this.dock.distance,
      coverage: this.coverage,
    });
    this.control = result.state;

    if (result.switchedTo === "road") {
      // Hidden by the trailer: continue at the wipe pose with the same speed.
      this.roadSpeed = this.dock.speed;
      this.dock = { distance: HERO_RIG.wipeDistance, speed: 0, braking: false };
      this.recordSwitch("road", next);
    }
    if (result.rebase) {
      this.dock = PARKED;
      this.recordRebase(next);
      if (result.switchedTo === "dock") this.recordSwitch("dock", next);
    }
    if (before.mode === "forward" && this.control.mode === "return") {
      this.returnStartShotT = this.values.shotT;
      this.rebuildReturnPath();
    }
    if (this.control.mode === "forward") this.returnPath = null;

    const structuralChange =
      result.switchedTo !== null || result.rebase || before.mode !== this.control.mode;
    if (structuralChange) {
      this.bindings.dock.refreshReflection();
      this.cameraParams = this.computeCameraParams();
      this.applyRig();
      this.applyCamera();
    }
    this.applyWorld();
    this.checkInvariants(previousDistance, speed, result.rebase);

    const moving =
      speed > 1e-3 ||
      !isSettled(this.pitch, 0) ||
      !isSettled(this.heave, 0) ||
      !isSettled(this.lag, this.pitch.value);
    const needsRender = this.dirty || progressChanged || structuralChange || moving;
    this.dirty = false;
    return needsRender;
  }

  /** Builds the road world's on-demand parts ahead of time (idle-time warm-up). */
  prepareRoad(): void {
    this.bindings?.road.prepare();
  }

  /**
   * Shader warm-up for a world that is not on screen. three.js keys every lit
   * program on the scene's light setup (and shadow-casting lights), and each
   * world has its own lights, so the first frame of the other world would
   * otherwise compile every visible material mid-scroll. `compile` receives the
   * scene staged exactly as that world renders — the other world detached (its
   * lights and materials out of the graph), this one visible, its shadow
   * casters set — and runs synchronously (the programs are created then;
   * completion is awaited by the caller). The current state is restored
   * straight after, the detached world back at its own child index.
   */
  compileWorld(world: HeroWorld, compile: (scene: Scene) => Promise<unknown>): Promise<unknown> {
    if (!this.bindings) return Promise.resolve();
    const { scene, dock, road } = this.bindings;
    const shown = world === "dock" ? dock.group : road.group;
    const other = world === "dock" ? road.group : dock.group;
    const parent = other.parent;
    const index = parent ? parent.children.indexOf(other) : -1;
    const state = [shown.visible, dock.dockLight.castShadow, road.sun.castShadow] as const;
    const shadows = this.settings.shadowMapSize > 0;
    shown.visible = true;
    dock.dockLight.castShadow = shadows && world === "dock";
    road.sun.castShadow = shadows && world === "road";
    if (parent) parent.children.splice(index, 1);
    try {
      return compile(scene);
    } finally {
      if (parent) parent.children.splice(index, 0, other);
      [shown.visible, dock.dockLight.castShadow, road.sun.castShadow] = state;
    }
  }

  /** Debug/test: freezes the continuous simulation (checkpoint captures). */
  toggleFrozen(): void {
    this.frozen = !this.frozen;
    this.dirty = true;
  }

  /** Last rendered frame interval (ms), written by the frame driver. */
  frameMs = 0;

  /** Renderer statistics for the debug panel. */
  rendererInfo(): {
    calls: number;
    triangles: number;
    textures: number;
    geometries: number;
    programs: number;
  } | null {
    const renderer = this.bindings?.renderer;
    if (!renderer) return null;
    const { render, memory, programs } = renderer.info;
    return {
      calls: render.calls,
      triangles: render.triangles,
      textures: memory.textures,
      geometries: memory.geometries,
      programs: programs?.length ?? 0,
    };
  }

  /** Debug/test: forces a WebGL context loss (the hero must fall back quietly). */
  simulateContextLoss(): void {
    this.bindings?.renderer.getContext().getExtension("WEBGL_lose_context")?.loseContext();
  }

  metrics(): HeroMetrics {
    const position = this.bindings?.camera.position;
    return {
      rawProgress: this.progress.raw,
      displayedProgress: this.progress.displayed,
      storyProgress: this.storyProgress,
      state: heroStateAt(this.storyProgress),
      world: this.control.world,
      mode: this.control.mode,
      returnFrom: this.control.mode === "return" ? this.control.returnFrom : null,
      rebased: this.control.rebased,
      dockDistance: this.dock.distance,
      dockSpeed: this.dock.speed,
      roadSpeed: this.roadSpeed,
      braking: this.control.world === "dock" && this.dock.braking,
      wheelTravel: this.wheelTravel,
      coverage: this.coverage,
      bucket: this.bucket,
      settings: this.settings,
      pixelRatio: this.bindings?.renderer.getPixelRatio() ?? 0,
      frozen: this.frozen,
      camera: {
        position: position ? [position.x, position.y, position.z] : [0, 0, 0],
        fov: this.bindings?.camera.fov ?? 0,
      },
    };
  }

  // -------------------------------------------------------------------------

  private stepSimulation(dt: number): number {
    const v = this.values;
    let speed: number;
    if (this.control.world === "dock") {
      // In return mode the truck brakes and holds (target behind it) — it never
      // follows the departure target while the visitor scrolls back.
      const target = this.control.mode === "return" ? 0 : v.dockTarget;
      this.dock = stepDock(this.dock, target, dt);
      speed = this.dock.speed;
    } else {
      this.roadSpeed = stepRoadSpeed(this.roadSpeed, v.cruiseTarget, dt);
      this.roadOffset = (this.roadOffset + this.roadSpeed * dt) % ROAD_FLOW_WRAP;
      speed = this.roadSpeed;
    }
    this.wheelTravel += speed * dt;
    this.simTime += dt;

    if (dt > 0) {
      const acceleration = (speed - this.previousSpeed) / dt;
      const { maxBodyPitch, maxAcceleration, springFrequency } = HERO_RIG;
      // Accelerating lifts the nose (negative X rotation); braking dips it.
      const pitchTarget = Math.max(
        -maxBodyPitch,
        Math.min(maxBodyPitch, (-acceleration / maxAcceleration) * maxBodyPitch * 0.6),
      );
      if (v.brakeRelease >= 0.5 && this.previousBrakeRelease < 0.5) {
        this.heave = { ...this.heave, velocity: this.heave.velocity - 0.12 };
      }
      this.pitch = stepSpring(this.pitch, pitchTarget, dt, springFrequency);
      this.heave = stepSpring(this.heave, 0, dt, springFrequency);
      this.lag = stepSpring(this.lag, this.pitch.value, dt, springFrequency * 0.6);
    }
    this.previousSpeed = speed;
    this.previousBrakeRelease = v.brakeRelease;
    return speed;
  }

  private computeCameraParams(): ShotParams {
    if (this.control.mode === "return" && this.returnPath) {
      return returnShotParams(this.returnPath, this.storyProgress);
    }
    return forwardShotParams(this.values.shotT, this.bucket);
  }

  private rebuildReturnPath(): void {
    this.returnPath = buildReturnPath({
      returnFrom: this.control.returnFrom,
      occlusionAt: this.control.returnOcclusionAt,
      startParams: forwardShotParams(this.returnStartShotT, this.bucket),
      exitParams: forwardShotParams(this.exitShotT, this.bucket),
      bucket: this.bucket,
    });
  }

  private applyRig(): void {
    const rig = this.bindings!.rig;
    const onRoad = this.control.world === "road";
    const pose = onRoad
      ? { x: 0, z: 0, heading: 0, steer: 0, articulation: 0 }
      : exitPathPose(this.dock.distance);
    rigMatrix(this.world, pose.x, pose.z, pose.heading);
    rig.root.matrix.copy(this.world);
    rig.root.matrixWorldNeedsUpdate = true;

    const sway = onRoad ? Math.min(1, this.roadSpeed / HERO_RIG.cruiseSpeed) : 0;
    rig.tractorBody.rotation.x = this.pitch.value;
    rig.tractorBody.rotation.z = Math.sin(this.simTime * 1.3) * HERO_RIG.maxBodyRoll * 0.4 * sway;
    rig.tractorBody.position.y =
      this.heave.value + Math.sin(this.simTime * 2.1) * HERO_RIG.maxHeave * 0.15 * sway;
    for (const node of rig.steerNodes) node.rotation.y = pose.steer;
    rig.trailerRoot.rotation.y = pose.articulation;
    rig.trailerRoot.rotation.x = (this.lag.value - this.pitch.value) * 0.5;
    for (const wheel of rig.wheels) {
      wheel.node.rotation.x = (this.wheelTravel / wheel.radius) % (Math.PI * 2);
    }
    rig.root.updateMatrixWorld(true);
  }

  private applyCamera(): void {
    const { camera } = this.bindings!;
    const onRoad = this.control.world === "road";
    // The route overview is seen from ~2 000 km up: near/far scale with the shot.
    const reach = this.cameraParams.distance;
    camera.near = onRoad ? Math.max(0.5, reach * 0.01) : 0.05;
    camera.far = onRoad ? Math.max(2000, reach * 6) : 500;
    applyCameraPose(camera, shotPose(this.cameraParams), this.world, this.width, this.height);
    this.bindings!.sky.mesh.position.copy(camera.position);
  }

  private applyWorld(): void {
    const { dock, road, rig, renderer, scene, sky, environment } = this.bindings!;
    const v = this.values;
    const onRoad = this.control.world === "road";
    const braking = !onRoad && this.dock.braking;

    dock.group.visible = !onRoad;
    road.group.visible = onRoad;

    const setEmissive = (
      materials: TruckRigBinding["lightMaterials"]["head"],
      intensity: number,
    ) => {
      for (const material of materials) material.emissiveIntensity = intensity;
    };
    setEmissive(rig.lightMaterials.head, v.headlights * 3);
    setEmissive(rig.lightMaterials.marker, v.markers * 2);
    setEmissive(rig.lightMaterials.tail, v.tailLights * 2);
    setEmissive(rig.lightMaterials.brake, braking ? 4 : 0);
    setEmissive(rig.lightMaterials.reverse, 0); // never: scrolling back never reverses the truck
    // Restrained: the beams reveal the front and a pool of ground, never a flare.
    for (const beam of rig.headlights) beam.intensity = v.headlights * 30;
    rig.headlightGlow.opacity = v.headlights * 0.8;

    dock.dockLight.intensity = v.dockLight * 450;
    dock.doorGlow.emissiveIntensity = v.dockLight * 1.2;
    dock.lampGlow.emissiveIntensity = v.dockLight * 3;
    // The environment map carries most of the sky light; the hemisphere only fills.
    dock.ambient.intensity = 1.05 + v.dawn * 0.5;
    dock.update(this.storyProgress);
    road.update(this.roadOffset, this.settings.roadLayers, {
      routeBlend: v.routeBlend,
      mapBlend: v.mapBlend,
      europeBlend: v.europeBlend,
      journey: v.journey,
      active: onRoad,
    });

    renderer.toneMappingExposure = v.exposure;
    // One light story: the sky dome carries the colour; fog and clear colour follow its horizon.
    sky.update(v.dawn, onRoad ? road.sunDirection : dock.sunDirection);
    // Distant relief sits in the atmosphere: a darker cut of the horizon colour.
    dock.ridge.color.copy(sky.horizon).multiplyScalar(0.42);
    road.ridge.color.copy(sky.horizon).multiplyScalar(0.62 * (1 - 0.6 * v.routeBlend));
    road.farRidge.color.copy(sky.horizon).multiplyScalar(0.8 * (1 - 0.6 * v.routeBlend));
    // The route end keeps the sunrise horizon: the physical world recedes under
    // the route language instead of cutting to a void.
    sky.setOpacity(onRoad ? (1 - v.routeBlend * 0.45) * (1 - v.mapBlend) : 1);
    const envChanged = environment.update({
      dawn: v.dawn,
      routeBlend: onRoad ? v.routeBlend : 0,
      world: onRoad ? "road" : "dock",
      dockBayDirection: dock.bayDirection,
      dockLight: v.dockLight,
      sunDirection: onRoad ? road.sunDirection : dock.sunDirection,
      horizon: sky.horizon,
    });
    if (envChanged) scene.environment = environment.texture;
    scratchColor.copy(sky.horizon);
    if (onRoad) {
      scratchColor.lerp(ROUTE_SKY, Math.max(v.routeBlend * 0.55, v.mapBlend));
      // Long, soft morning haze: distant sheds and tree lines stay as silhouettes.
      // As the camera rises the haze recedes with it (never swallowing the view).
      // Capped: during the reach → Italy shot blend cameraParams.distance grows
      // toward the Italy overview's 24 000 m, which would otherwise push the
      // far plane past anything the fog could ever reach — leaving the ground
      // (fogged) and the sky (never fogged) to meet with no atmospheric blend
      // at all, a hard, unnaturally sharp horizon line instead of a dissolve.
      const reach = Math.min(this.cameraParams.distance, 320);
      // The physical road dissolves into it while the route (unfogged) runs on.
      this.fog.near = Math.max(80 - v.routeBlend * 40, reach * 0.5) + v.routeBlend * 150;
      // Aerial (Reach): the farmland must stay readable — haze thickens only towards the horizon.
      this.fog.far = Math.max(620 - v.routeBlend * 280, reach * 2.2) + v.routeBlend * 900;
    } else {
      this.fog.near = 60;
      this.fog.far = 400;
    }
    if (!(scene.background instanceof Color)) scene.background = new Color();
    (scene.background as Color).copy(scratchColor);
    // Fog is set to the exact same colour as the clear/background (scratchColor
    // above), not recomputed with its own lerp: fully fogged ground and the sky
    // seen through the dome must asymptote to one colour, or the horizon where
    // they meet shows as a hard seam (the ground darker or lighter than the sky
    // right above it) instead of a dissolve.
    this.fog.color.copy(scratchColor);

    this.applyShadows(onRoad);
  }

  private applyShadows(onRoad: boolean): void {
    const { dock, road, renderer, scene } = this.bindings!;
    const size = this.settings.shadowMapSize;
    dock.dockLight.castShadow = size > 0 && !onRoad;
    road.sun.castShadow = size > 0 && onRoad;
    if (size === this.appliedShadowSize) return;

    renderer.shadowMap.enabled = size > 0;
    for (const light of [dock.dockLight, road.sun]) {
      light.shadow.mapSize.set(size || 1, size || 1);
      light.shadow.map?.dispose();
      light.shadow.map = null;
    }
    // Shadow toggles change shader programs.
    scene.traverse((object) => {
      const material = (object as { material?: { needsUpdate: boolean } }).material;
      if (material) material.needsUpdate = true;
    });
    this.appliedShadowSize = size;
  }

  private recordRebase(progress: number): void {
    if (!this.audit) return;
    this.audit.rebases.push({ progress, coverage: this.coverage });
    if (this.coverage < COVERAGE_THRESHOLD) {
      this.audit.violations.push(
        `rebase at ${progress.toFixed(3)} with coverage ${this.coverage.toFixed(3)}`,
      );
    }
  }

  private recordSwitch(to: HeroWorld, progress: number): void {
    if (!this.audit) return;
    this.audit.switches.push({ to, progress, coverage: this.coverage });
    if (this.coverage < COVERAGE_THRESHOLD) {
      this.audit.violations.push(
        `world switch at ${progress.toFixed(3)} with coverage ${this.coverage.toFixed(3)}`,
      );
    }
  }

  private checkInvariants(previousDistance: number, speed: number, rebased: boolean): void {
    if (!this.audit) return;
    const decreased = this.dock.distance < previousDistance - 1e-9;
    const allowed = rebased || this.control.world === "road";
    if (decreased && !allowed) {
      this.audit.violations.push(`dock distance decreased without a concealed rebase`);
    }
    if (speed < 0 || this.dock.speed < 0 || this.roadSpeed < 0) {
      this.audit.violations.push(`negative speed`);
    }
  }
}
