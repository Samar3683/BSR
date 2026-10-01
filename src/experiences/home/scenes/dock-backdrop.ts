import {
  CanvasTexture,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  type PerspectiveCamera,
  SRGBColorSpace,
  Texture,
  TextureLoader,
  Vector3,
} from "three";

import { assetUrl } from "@/config/assets";

/*
 * Preparation → Ready → Departure backdrop: the approved photographic
 * references themselves (not a procedural re-creation), billboarded exactly
 * like the road world's horizon plates (dock-backdrop.ts's road counterpart,
 * road-scenery.ts's createHorizonPlates): positioned every frame along the
 * camera's real view direction, auto-sized to fill whichever dock shot is
 * active (opening/headlight/raking/hero/rear-three-quarter/trailer-side all
 * have different FOV and distance), so the plate is never a visible rectangle.
 *
 * Four references crossfade across the beat, driven by story progress:
 *   0.00–0.12  blue-hour arrival        (04)
 *   0.12–0.24  loading operation        (05)
 *   0.24–0.42  ready / hero reveal      (06)
 *   0.42–0.60  yard departure           (07)
 * Real geometry (ground, bumpers, hazard markings, the forklift, the truck
 * itself) sits far closer to the camera and occludes this normally.
 */

const PLATES = [
  { id: "blue-hour", file: "blue-hour.png", from: 0, to: 0.13 },
  { id: "loading", file: "loading.png", from: 0.1, to: 0.26 },
  { id: "ready", file: "ready.png", from: 0.22, to: 0.44 },
  { id: "departure", file: "departure.png", from: 0.4, to: 0.62 },
] as const;

/** The reference photos, aspect ~2.37:1; feather only a thin edge margin. */
function featherMask(w = 512, h = 512): CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  const gx = ctx.createLinearGradient(0, 0, w, 0);
  gx.addColorStop(0, "rgba(0,0,0,0)");
  gx.addColorStop(0.05, "rgba(255,255,255,1)");
  gx.addColorStop(0.95, "rgba(255,255,255,1)");
  gx.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = gx;
  ctx.fillRect(0, 0, w, h);
  const gy = ctx.createLinearGradient(0, 0, 0, h);
  gy.addColorStop(0, "rgba(0,0,0,0)");
  gy.addColorStop(0.05, "rgba(255,255,255,1)");
  gy.addColorStop(0.95, "rgba(255,255,255,1)");
  gy.addColorStop(1, "rgba(0,0,0,0)");
  ctx.globalCompositeOperation = "multiply";
  ctx.fillStyle = gy;
  ctx.fillRect(0, 0, w, h);
  return new CanvasTexture(canvas);
}

export interface DockBackdrop {
  group: Mesh[];
  update(progress: number): void;
}

const smooth = (a: number, b: number, t: number) => {
  const x = Math.min(1, Math.max(0, (t - a) / (b - a)));
  return x * x * (3 - 2 * x);
};

/** Loads the four references (small, ~200 KB together) ahead of scene build. */
export async function loadDockPlateTextures(): Promise<Record<(typeof PLATES)[number]["id"], Texture>> {
  const loader = new TextureLoader();
  const entries = await Promise.all(
    PLATES.map(async (p) => {
      const texture = await loader.loadAsync(assetUrl("images", `hero-dock/${p.file}`));
      texture.colorSpace = SRGBColorSpace;
      return [p.id, texture] as const;
    }),
  );
  return Object.fromEntries(entries) as Record<(typeof PLATES)[number]["id"], Texture>;
}

/**
 * Builds the crossfading backdrop meshes. `textures` may be null (falls back
 * to no backdrop, e.g. if the small images ever fail to load) — the dock
 * still renders correctly without it, just without this photographic layer.
 */
export function createDockBackdrop(
  textures: Record<(typeof PLATES)[number]["id"], Texture> | null,
): DockBackdrop {
  if (!textures) return { group: [], update: () => {} };
  const mask = featherMask();
  const DISTANCE = 46;
  // The source photos are cropped to their left ~20% (the building facade and
  // sky, before their own reference truck begins) so nothing here duplicates
  // our own truck or its BSR wordmark. That crop is a narrow, roughly-square
  // strip, not the full frame — it is sized to its own aspect and held to the
  // upper-left, where our composition already keeps clear sky/building space
  // (our truck dominates the centre-right at these distances), rather than
  // stretched to fill the whole shot.
  // Full height (with margin so top/bottom feathering falls off-screen) and
  // pushed mostly past the left edge, so only its right edge is ever visible
  // in frame — a bleeding strip, not a floating framed window.
  const HEIGHT_FRACTION = 1.3;
  const SHIFT_X = 0.62;
  const SHIFT_Y = 0;
  const forward = new Vector3();
  const target = new Vector3();
  const meshes = PLATES.map((p) => {
    const texture = textures[p.id];
    const image = texture.image as { width: number; height: number } | undefined;
    const imageAspect = image ? image.width / image.height : 0.6;
    const material = new MeshBasicMaterial({
      map: texture,
      alphaMap: mask,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      fog: false,
      toneMapped: true,
    });
    const mesh = new Mesh(new PlaneGeometry(1, 1), material);
    mesh.name = `Dock_Backdrop_${p.id}`;
    mesh.renderOrder = -0.5;
    mesh.frustumCulled = false;
    mesh.onBeforeRender = (_renderer, _scene, cam) => {
      const camera = cam as PerspectiveCamera;
      camera.getWorldDirection(forward);
      target.copy(camera.position);
      mesh.position.copy(camera.position).addScaledVector(forward, DISTANCE);
      mesh.lookAt(target);
      // Sized to the shot's own frustum height (whichever dock shot is
      // active) at DISTANCE, kept at the crop's own aspect ratio — not
      // stretched to the camera's (much wider) aspect.
      const verticalFov = (camera.fov * Math.PI) / 180;
      const frustumHeight = 2 * DISTANCE * Math.tan(verticalFov / 2);
      const frustumWidth = frustumHeight * camera.aspect;
      const height = frustumHeight * HEIGHT_FRACTION;
      const width = height * imageAspect;
      mesh.scale.set(width, height, 1);
      // Positive local X reads as screen-left for this billboard's orientation
      // (verified empirically: a negative value here pushed it screen-right).
      mesh.translateX(frustumWidth * SHIFT_X);
      mesh.translateY(frustumHeight * SHIFT_Y);
      mesh.updateMatrix();
      mesh.updateMatrixWorld(true);
    };
    return mesh;
  });
  return {
    group: meshes,
    update(progress) {
      PLATES.forEach((p, i) => {
        const material = meshes[i]!.material as MeshBasicMaterial;
        const fadeIn = smooth(p.from, p.from + (p.to - p.from) * 0.35, progress);
        const fadeOut = 1 - smooth(p.to - (p.to - p.from) * 0.35, p.to, progress);
        material.opacity = Math.max(0, Math.min(fadeIn, fadeOut));
      });
    },
  };
}
