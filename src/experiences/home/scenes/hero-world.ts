import { Group, type Object3D, type WebGLRenderer } from "three";

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
  road: RoadWorld;
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
}): Promise<HeroWorldParts> {
  const { renderer, models, tier } = options;
  const needsLoader = Boolean(models.tractor || models.trailer || models.dock || models.roadKit);
  const loader = needsLoader ? createGltfLoader(renderer) : null;
  try {
    const [tractor, trailer, dockKit, roadKitScene] = await Promise.all([
      models.tractor ? loadRoot(loader!, models.tractor, "Tractor") : createPlaceholderTractor(),
      models.trailer ? loadRoot(loader!, models.trailer, "Trailer") : createPlaceholderTrailer(),
      models.dock ? loader!.load(models.dock).then((gltf) => gltf.scene) : null,
      // Road kit (Gate B): impostor atlases, card metadata and the baked road surface.
      models.roadKit ? loader!.load(models.roadKit).then((gltf) => gltf.scene) : null,
    ]);
    const roadKit = roadKitScene ? readRoadKit(roadKitScene) : null;
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
    const dock = createDockWorld(roadKit?.interior ?? null);
    if (dockKit) {
      dock.blocking.visible = false;
      dock.group.add(dockKit);
    }
    const road = createRoadWorld(roadKit);
    const sky = createSkyDome();
    const root = new Group();
    root.name = "HeroWorld";
    root.add(rig.root, dock.group, road.group, sky.mesh, createFilmFinish());
    return {
      root,
      rig,
      dock,
      road,
      sky,
      stats,
      production,
    };
  } finally {
    loader?.dispose();
  }
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
