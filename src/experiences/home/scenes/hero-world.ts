import {
  DirectionalLight,
  Group,
  HemisphereLight,
  MeshBasicMaterial,
  type Object3D,
  Vector3,
  type WebGLRenderer,
} from "three";

import type { RealtimeQuality } from "@/lib/performance/quality";
import { createGltfLoader, type GltfAssetLoader } from "@/lib/three/gltf-loader";
import { measureObject, type SceneStats } from "@/lib/three/scene-stats";
import { batchStatic } from "@/lib/three/static-batch";

import type { HeroModelSet } from "../config/hero-assets";
import { HERO_GPU_BUDGETS } from "../config/hero-budgets";
import { createFilmFinish } from "./film-finish";
import { createSkyDome, type SkyDome } from "./hero-sky";
import { createDockWorld, type DockWorld } from "./placeholder-worlds";
import { readRoadKit } from "./road-scenery";
import { createRoadWorld, type RoadWorld } from "./road-world";
import { createPlaceholderTractor, createPlaceholderTrailer } from "./placeholder-truck";
import {
  assembleTruckRig,
  materialNames,
  TruckContractError,
  type TruckRigBinding,
} from "./truck-contract";
import { prepareTruckMaterials } from "./truck-materials";

export interface HeroWorldParts {
  root: Group;
  rig: TruckRigBinding;
  dock: DockWorld;
  /**
   * The road world — or, while the road kit is still downloading, an empty stand-in
   * (`roadKitUrl` set): the kit is only needed from the trailer wipe on, so it never
   * delays the first frame. See `buildRoadWorld` and `HeroRuntime.attachRoad`.
   */
  road: RoadWorld;
  /** Road kit still to load after the first frame (null: `road` is final). */
  roadKitUrl: string | null;
  sky: SkyDome;
  /** Measured cost of what was loaded (debug panel, tests). */
  stats: HeroAssetStats;
  /** Which parts are production assets (the rest are development placeholders). */
  production: { tractor: boolean; trailer: boolean; dock: boolean };
}

export interface HeroAssetStats {
  tractor: SceneStats;
  trailer: SceneStats;
  dock: SceneStats;
  /** Distinct material slots across tractor + trailer (shared slots count once). */
  truckMaterials: number;
}

export type HeroProductionParts = HeroWorldParts["production"];

/** A production asset over its approved hard budget is rejected, never loaded anyway. */
export class HeroAssetBudgetError extends Error {}

/**
 * Builds the hero world for a tier: production GLBs where the manifest names
 * them, labelled development placeholders elsewhere. Every truck — production
 * or placeholder — goes through the same material preparation, model
 * contract and budget checks. Any failure rejects the promise; the real-time
 * layer then falls back to the still ladder.
 */
export async function buildHeroWorld(options: {
  renderer: WebGLRenderer;
  models: HeroModelSet;
  tier: RealtimeQuality;
  /** Shared with `buildRoadWorld` (one transcoder); owned — and disposed — by the caller. */
  loader?: GltfAssetLoader;
}): Promise<HeroWorldParts> {
  const { renderer, models, tier } = options;
  // Only what the opening needs: the road kit (about half of the tier's bytes) loads
  // after the first frame (buildRoadWorld), so it never competes for bandwidth with it.
  const needsLoader = Boolean(models.tractor || models.trailer || models.dock);
  const ownLoader = needsLoader && !options.loader ? createGltfLoader(renderer) : null;
  const loader = options.loader ?? ownLoader;
  try {
    const [tractor, trailer, dockKit] = await Promise.all([
      models.tractor ? loadRoot(loader!, models.tractor, "Tractor") : createPlaceholderTractor(),
      models.trailer ? loadRoot(loader!, models.trailer, "Trailer") : createPlaceholderTrailer(),
      models.dock ? loader!.load(models.dock).then((gltf) => gltf.scene) : null,
    ]);
    // Dock photo-backdrop (dock-backdrop.ts): built but not wired in yet — the
    // low-resolution, truck-filled source crops didn't produce a clean result
    // (see the module's own notes). Left in place for a future attempt with
    // better source material rather than shipping a visible seam.

    prepareTruckMaterials(tractor, tier);
    prepareTruckMaterials(trailer, tier);
    const budget = HERO_GPU_BUDGETS[tier];
    const stats: HeroAssetStats = {
      tractor: measureObject(tractor),
      trailer: measureObject(trailer),
      dock: dockKit ? measureObject(dockKit) : emptyStats(),
      truckMaterials: new Set([...materialNames(tractor), ...materialNames(trailer)]).size,
    };
    const production: HeroProductionParts = {
      tractor: Boolean(models.tractor),
      trailer: Boolean(models.trailer),
      dock: Boolean(models.dock),
    };
    const over = heroBudgetViolations(stats, tier, production);
    if (over.length > 0) {
      throw new HeroAssetBudgetError(`Hero assets over the ${tier} budget: ${over.join("; ")}`);
    }

    // One dock flood + headlight beams must fit the tier's punctual-light budget.
    const headlightBeams = budget.punctualLights >= 3 ? 2 : 1;
    const rig = assembleTruckRig(tractor, trailer, { headlightBeams });
    // One draw call per truck material: every mesh is rigidly skinned to the rig node that
    // moves it (wheel spin, steer, body, trailer), so the rig animates exactly as before.
    // Only existing material instances are used (no folding): the approved truck look is
    // untouched. glTF vertex-colour clones of one material share an instance.
    batchStatic(rig.root, {
      bones: [
        rig.tractor,
        rig.tractorBody,
        rig.trailerRoot,
        ...rig.steerNodes,
        ...rig.wheels.map((wheel) => wheel.node),
      ],
      fold: false,
    });
    const dock = createDockWorld();
    if (dockKit) {
      dock.blocking.visible = false;
      dock.group.add(dockKit);
    }
    // No kit in the manifest: the procedural road is final at once.
    const road = models.roadKit ? createRoadStandIn() : createRoadWorld(null);
    const sky = createSkyDome();
    const root = new Group();
    root.name = "HeroWorld";
    root.add(rig.root, dock.group, road.group, sky.mesh, createFilmFinish());
    return {
      root,
      rig,
      dock,
      road,
      roadKitUrl: models.roadKit,
      sky,
      stats,
      production,
    };
  } finally {
    ownLoader?.dispose();
  }
}

/**
 * Loads the road kit (Gate B: impostor atlases, card metadata, the baked road
 * surface) and builds the road world from it. Runs after the first frame; the
 * runtime swaps it in for the stand-in (`HeroRuntime.attachRoad`).
 */
export async function buildRoadWorld(options: {
  loader: GltfAssetLoader;
  url: string;
}): Promise<RoadWorld> {
  const gltf = await options.loader.load(options.url);
  return createRoadWorld(readRoadKit(gltf.scene));
}

/**
 * Empty road world held by the runtime until the real one arrives. Never shown:
 * the runtime does not enter the road while it is bound (`HeroRuntime.waitingForRoad`).
 * Its lights live in an invisible group, so they are not part of any program key.
 */
function createRoadStandIn(): RoadWorld {
  const group = new Group();
  group.name = "RoadWorldPending";
  group.visible = false;
  const sun = new DirectionalLight();
  const ambient = new HemisphereLight();
  group.add(sun, ambient);
  return {
    group,
    ambient,
    sun,
    sunDirection: new Vector3(0, 1, 0),
    ridge: new MeshBasicMaterial(),
    farRidge: new MeshBasicMaterial(),
    update: () => {},
    prepare: () => {},
  };
}

async function loadRoot(loader: GltfAssetLoader, url: string, name: string): Promise<Object3D> {
  const gltf = await loader.load(url);
  const root = gltf.scene.getObjectByName(name);
  if (!root) throw new TruckContractError(`${url}: no "${name}" root node`);
  root.removeFromParent();
  return root;
}

/**
 * Hard-budget violations of the production parts for a tier (empty = within
 * budget). The approved budgets describe production assets; the development
 * placeholders are measured and reported, not gated.
 */
export function heroBudgetViolations(
  stats: HeroAssetStats,
  tier: RealtimeQuality,
  production: HeroProductionParts,
): string[] {
  const budget = HERO_GPU_BUDGETS[tier];
  const truck = production.tractor || production.trailer;
  const textureBytes =
    (production.tractor ? stats.tractor.textureBytes : 0) +
    (production.trailer ? stats.trailer.textureBytes : 0) +
    (production.dock ? stats.dock.textureBytes : 0);
  return [
    ...(production.tractor
      ? overBudget("tractor triangles", stats.tractor.triangles, budget.tractorTriangles.hard)
      : []),
    ...(production.trailer
      ? overBudget("trailer triangles", stats.trailer.triangles, budget.trailerTriangles.hard)
      : []),
    ...(production.dock
      ? overBudget("dock triangles", stats.dock.triangles, budget.dockTriangles.hard)
      : []),
    ...(truck ? overBudget("truck materials", stats.truckMaterials, budget.truckMaterials) : []),
    ...overBudget("texture memory", textureBytes, budget.textureBytes.hard),
  ];
}

function overBudget(label: string, value: number, limit: number): string[] {
  return value > limit ? [`${label} ${value} > ${limit}`] : [];
}

function emptyStats(): SceneStats {
  return {
    triangles: 0,
    drawCalls: 0,
    shadowCasters: 0,
    materials: 0,
    textures: 0,
    textureBytes: 0,
  };
}
