import {
  BackSide,
  BufferAttribute,
  Color,
  CustomBlending,
  OneFactor,
  OneMinusSrcAlphaFactor,
  SrcAlphaFactor,
  Mesh,
  MeshBasicMaterial,
  SphereGeometry,
  Vector3,
} from "three";

import { createCloudTexture } from "./world-details";

/*
 * Sky dome: a vertex-coloured sphere (standard material, no texture, no custom
 * shader). Colours come from a small set of keyframes along the approved light
 * story — pre-dawn → blue hour → first light → sunrise → early morning — with a
 * warm glow towards the sun. Colour is recomputed only when the light state
 * changes (≈ 4 700 vertices, CPU).
 *
 * ⚠ Interim environment: the production sky/backdrop (clouds, distant relief,
 * city lights) is art production; this dome keeps its role — the light story's
 * colour continuity — and can sit behind a production backdrop.
 */

interface SkyKey {
  /** Position on the light story (StoryValues.dawn). */
  at: number;
  zenith: string;
  horizon: string;
  /** Glow around the sun direction, near the horizon. */
  glow: string;
  glowStrength: number;
}

/** Light-story keyframes (environmental colours, not brand colours). */
const SKY_KEYS: readonly SkyKey[] = [
  { at: 0, zenith: "#0a1530", horizon: "#3a4d74", glow: "#e8914f", glowStrength: 0.75 },
  { at: 0.25, zenith: "#0f1d3d", horizon: "#46598a", glow: "#ec9a55", glowStrength: 0.85 },
  { at: 0.5, zenith: "#1c3358", horizon: "#7a7f94", glow: "#ea8e4c", glowStrength: 0.85 },
  // Sunrise (road): warm, broad glow down the road, blue overhead.
  { at: 0.8, zenith: "#3a5f93", horizon: "#d8b08a", glow: "#f59a45", glowStrength: 1 },
  { at: 1, zenith: "#4a74a8", horizon: "#cfd3cf", glow: "#f7c07a", glowStrength: 0.6 },
];

const zenith = new Color();
const horizon = new Color();
const glow = new Color();
const other = new Color();
const scratch = new Color();
const mid = new Color();
const PALE = new Color("#aeb9c6");

function sampleKeys(dawn: number): number {
  const t = Math.min(1, Math.max(0, dawn));
  let index = 0;
  while (index < SKY_KEYS.length - 2 && t > SKY_KEYS[index + 1]!.at) index++;
  const a = SKY_KEYS[index]!;
  const b = SKY_KEYS[index + 1]!;
  const k = (t - a.at) / (b.at - a.at);
  zenith.set(a.zenith).lerp(other.set(b.zenith), k);
  horizon.set(a.horizon).lerp(other.set(b.horizon), k);
  glow.set(a.glow).lerp(other.set(b.glow), k);
  return a.glowStrength + (b.glowStrength - a.glowStrength) * k;
}

export interface SkyDome {
  mesh: Mesh;
  /** Current horizon colour (fog and clear colour follow it). */
  readonly horizon: Color;
  /** Fades the dome out (0) towards the plain route background. */
  setOpacity(opacity: number): void;
  /** Recolours the dome; no work when nothing changed. */
  update(dawn: number, sunDirection: Vector3): void;
}

/** Radius stays inside the dock camera's far plane (500 m); the dome follows the camera. */
export function createSkyDome(radius = 450): SkyDome {
  // Dense rows: long lenses see only ~15° of sky, which must stay smooth.
  const geometry = new SphereGeometry(radius, 48, 96);
  const count = geometry.attributes.position!.count;
  const colors = new BufferAttribute(new Float32Array(count * 3), 3);
  geometry.setAttribute("color", colors);
  // A background, not a transparent object: drawn first (opaque pass, blended
  // explicitly, no depth) so nothing — e.g. the ground seen from the rising
  // route camera beyond the dome's 450 m radius — is ever painted over.
  const background = {
    transparent: false,
    blending: CustomBlending,
    blendSrc: SrcAlphaFactor,
    blendDst: OneMinusSrcAlphaFactor,
    // Alpha as three's normal blending: the canvas stays opaque.
    blendSrcAlpha: OneFactor,
    blendDstAlpha: OneMinusSrcAlphaFactor,
    depthWrite: false,
    depthTest: false,
  } as const;
  const material = new MeshBasicMaterial({
    vertexColors: true,
    side: BackSide,
    fog: false,
    ...background,
  });
  const mesh = new Mesh(geometry, material);
  mesh.name = "Sky_Dome";
  mesh.renderOrder = -2;
  mesh.frustumCulled = false;

  // Broken cloud layer between ~1° and ~34° elevation: dark against the blue
  // hour, warm-edged towards the glow, lit at sunrise. Tinted per vertex with
  // the same light story as the dome; faded out at the horizon and overhead.
  const CLOUD_LOW = 0.02;
  const CLOUD_HIGH = 0.6;
  const cloudGeometry = new SphereGeometry(
    radius * 0.97,
    96,
    24,
    0,
    Math.PI * 2,
    Math.PI / 2 - CLOUD_HIGH,
    CLOUD_HIGH - CLOUD_LOW,
  );
  const cloudCount = cloudGeometry.attributes.position!.count;
  const cloudColors = new BufferAttribute(new Float32Array(cloudCount * 4), 4);
  cloudGeometry.setAttribute("color", cloudColors);
  const cloudMap = createCloudTexture();
  cloudMap.repeat.set(12, 3);
  const cloudMaterial = new MeshBasicMaterial({
    map: cloudMap,
    vertexColors: true,
    side: BackSide,
    fog: false,
    ...background,
  });
  const clouds = new Mesh(cloudGeometry, cloudMaterial);
  clouds.name = "Sky_Clouds";
  clouds.renderOrder = -1;
  clouds.frustumCulled = false;
  mesh.add(clouds);
  const cloudDark = new Color();
  const cloudLit = new Color();

  const direction = new Vector3();
  const currentHorizon = new Color();
  let lastDawn = Number.NaN;
  const lastSun = new Vector3(Number.NaN, 0, 0);

  return {
    mesh,
    horizon: currentHorizon,
    setOpacity(opacity) {
      material.opacity = opacity;
      cloudMaterial.opacity = opacity;
      mesh.visible = opacity > 0.001;
    },
    update(dawn, sunDirection) {
      if (dawn === lastDawn && sunDirection.equals(lastSun)) return;
      lastDawn = dawn;
      lastSun.copy(sunDirection);
      const glowStrength = sampleKeys(dawn);
      currentHorizon.copy(horizon);
      const sun = direction.copy(sunDirection).setY(0).normalize();
      const t = Math.min(1, Math.max(0, (dawn - 0.4) / 0.4));
      const position = geometry.attributes.position!;
      for (let i = 0; i < count; i++) {
        const x = position.getX(i) / radius;
        const y = position.getY(i) / radius;
        const z = position.getZ(i) / radius;
        // Vertical gradient: horizon band → zenith (below the horizon: horizon).
        // Most of the change happens within ~15° of the horizon: the hero's long
        // lenses only ever see that part of the sky.
        const height = Math.max(0, y);
        // Two-step gradient through a pale neutral, so warm horizons never pass
        // through purple on their way to the blue zenith.
        const g = Math.pow(Math.min(1, height / 0.3), 0.7);
        // Pre-dawn: plain gradient (mid = its 35 % point); sunrise: pale neutral stop.
        mid.copy(horizon).lerp(zenith, 0.35);
        other.copy(horizon).lerp(PALE, 0.55);
        mid.lerp(other, t);
        if (g < 0.35) scratch.copy(horizon).lerp(mid, g / 0.35);
        else scratch.copy(mid).lerp(zenith, (g - 0.35) / 0.65);
        // Warm glow: strongest near the horizon, towards the sun.
        const facing = Math.max(0, (x * sun.x + z * sun.z) / Math.max(1e-6, Math.hypot(x, z)));
        // A narrow warm band on the horizon, never a sky-wide tint.
        // Pre-dawn: a thin band; sunrise: a broader warm sky around the sun.
        const band = Math.exp(-height * (38 - 26 * t));
        const amount = glowStrength * Math.pow(facing, 24 - 18 * t) * band;
        scratch.lerp(glow, Math.min(1, amount));
        colors.setXYZ(i, scratch.r, scratch.g, scratch.b);
      }
      colors.needsUpdate = true;

      // Clouds: darker than the sky at blue hour (silhouettes), sunlit at sunrise.
      cloudDark.copy(zenith).lerp(horizon, 0.2).multiplyScalar(0.5 + 0.55 * t);
      cloudLit.copy(glow).lerp(horizon, 0.45 - 0.2 * t).lerp(PALE, 0.25 * t);
      const cloudPosition = cloudGeometry.attributes.position!;
      const cloudRadius = radius * 0.97;
      for (let i = 0; i < cloudCount; i++) {
        const x = cloudPosition.getX(i) / cloudRadius;
        const y = cloudPosition.getY(i) / cloudRadius;
        const z = cloudPosition.getZ(i) / cloudRadius;
        const elevation = Math.asin(Math.min(1, Math.max(0, y)));
        const facing = Math.max(0, (x * sun.x + z * sun.z) / Math.max(1e-6, Math.hypot(x, z)));
        // Warm only low over the glow (lit undersides); elsewhere cool silhouettes.
        const lit = Math.min(
          1,
          0.6 * glowStrength * Math.pow(facing, 6 - 3 * t) * Math.exp(-elevation * (14 - 8 * t)) +
            0.3 * t,
        );
        scratch.copy(cloudDark).lerp(cloudLit, lit);
        const fadeLow = Math.min(1, Math.max(0, (elevation - CLOUD_LOW) / 0.08));
        const fadeHigh = Math.min(1, Math.max(0, (CLOUD_HIGH - elevation) / 0.25));
        cloudColors.setXYZW(i, scratch.r, scratch.g, scratch.b, 0.85 * fadeLow * fadeHigh);
      }
      cloudColors.needsUpdate = true;
    },
  };
}
