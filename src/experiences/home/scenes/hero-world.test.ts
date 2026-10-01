import {
  Group,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  PlaneGeometry,
  Texture,
  type WebGLRenderer,
} from "three";
import { describe, expect, it } from "vitest";

import { HERO_GPU_BUDGETS } from "../config/hero-budgets";
import { buildHeroWorld, type HeroAssetStats, heroBudgetViolations } from "./hero-world";
import { chapterOf, readRoadKit } from "./road-scenery";

// Placeholders need no loader, so no renderer is touched.
const renderer = {} as WebGLRenderer;
const PLACEHOLDERS = { tractor: null, trailer: null, dock: null, roadKit: null };

describe("hero world builder", () => {
  for (const tier of ["high", "medium", "low"] as const) {
    it(`${tier}: builds the contract-compliant placeholder world and measures it`, async () => {
      const world = await buildHeroWorld({ renderer, models: PLACEHOLDERS, tier });
      expect(world.production).toEqual({ tractor: false, trailer: false, dock: false });
      expect(world.stats.tractor.triangles).toBeGreaterThan(0);
      expect(world.stats.trailer.triangles).toBeGreaterThan(0);
      expect(world.stats.truckMaterials).toBeGreaterThan(0);
      expect(world.dock.blocking.visible).toBe(true);
    });
  }

  it(
    "fits the headlight beams into each tier's punctual-light budget (flood + beams)",
    async () => {
      for (const tier of ["high", "medium", "low"] as const) {
        const world = await buildHeroWorld({ renderer, models: PLACEHOLDERS, tier });
        const punctual = 1 + world.rig.headlights.length;
        expect(punctual, tier).toBeLessThanOrEqual(HERO_GPU_BUDGETS[tier].punctualLights);
      }
    },
    20_000, // three full placeholder worlds (dock incl. forklift, road, truck) per tier
  );

});

describe("road kit (Gate B)", () => {
  const kitScene = (withRoad = true) => {
    const root = new Group();
    root.userData.road = JSON.stringify({ x0: -4.475, x1: 9, length: 36 });
    const names = [
      "RK_Atlas_Built",
      "RK_Atlas_Nature",
      "RK_Aerial",
      "RK_Plate_A",
      "RK_Plate_B",
      "RK_Plate_C",
      "RK_Interior",
      ...(withRoad ? ["RK_Road"] : []),
    ];
    for (const name of names) {
      const mesh = new Mesh(new PlaneGeometry(), new MeshStandardMaterial({ map: new Texture() }));
      mesh.name = name;
      root.add(mesh);
    }
    const card = new Object3D();
    card.name = "Card_fuel_station";
    card.userData.card = JSON.stringify({
      atlas: "RK_Atlas_Built",
      uv: [0, 0, 0.5, 0.1],
      size: [104, 15],
      anchor: [0.4, 0.9],
    });
    root.add(card);
    return root;
  };

  it("reads atlases, the road surface and card metadata", () => {
    const kit = readRoadKit(kitScene());
    expect(kit.cards.get("fuel_station")?.size).toEqual([104, 15]);
    expect(kit.roadTile.length).toBe(36);
    expect(kit.road.map).toBeInstanceOf(Texture);
  });

  it("rejects a kit without its road surface (the hero falls back to stills)", () => {
    expect(() => readRoadKit(kitScene(false))).toThrow(/road surface/);
  });

  it("chapters follow the journey coordinate", () => {
    expect([0.2, 1.2, 1.7, 2.3, 2.9].map(chapterOf)).toEqual(["A", "B1", "B2", "C", "Reach"]);
  });
});

describe("production asset budgets (hard limits)", () => {
  const stats = (overrides: Partial<HeroAssetStats> = {}): HeroAssetStats => {
    const empty = {
      triangles: 0,
      drawCalls: 0,
      shadowCasters: 0,
      materials: 0,
      textures: 0,
      textureBytes: 0,
    };
    return { tractor: empty, trailer: empty, dock: empty, truckMaterials: 0, ...overrides };
  };
  const heavyTractor = stats({
    tractor: {
      triangles: 400_000,
      drawCalls: 40,
      shadowCasters: 30,
      materials: 12,
      textures: 6,
      textureBytes: 200 * 1024 * 1024,
    },
    truckMaterials: 16,
  });

  it("rejects a production tractor over its triangle, material and texture budgets", () => {
    const violations = heroBudgetViolations(heavyTractor, "high", {
      tractor: true,
      trailer: false,
      dock: false,
    });
    expect(violations.join(" ")).toMatch(/tractor triangles 400000 > 250000/);
    expect(violations.join(" ")).toMatch(/truck materials 16 > 15/);
    expect(violations.join(" ")).toMatch(/texture memory/);
  });

  it("a tier's limits are tighter than the tier above", () => {
    const within = stats({
      tractor: { ...heavyTractor.tractor, triangles: 100_000, textureBytes: 0 },
      truckMaterials: 10,
    });
    const production = { tractor: true, trailer: false, dock: false };
    expect(heroBudgetViolations(within, "medium", production)).toEqual([]);
    expect(heroBudgetViolations(within, "low", production).join(" ")).toMatch(/tractor triangles/);
  });

  it("development placeholders are measured, not gated", () => {
    expect(
      heroBudgetViolations(heavyTractor, "low", { tractor: false, trailer: false, dock: false }),
    ).toEqual([]);
  });
});
