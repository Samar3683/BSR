import {
  DataTexture,
  LinearFilter,
  type MeshStandardMaterial,
  RedFormat,
  UnsignedByteType,
  Vector4,
} from "three";

import { valueNoise } from "./world-details";

/*
 * Physical dampness map for the dock apron (world-space, one texture, 0.25 m/texel).
 * Water lies where the ground holds it, not in random blobs:
 *   - slab dishing: each 6 m slab is a few mm lower at its middle than at its joints, so
 *     slab centres hold water and joints dry first;
 *   - drainage: a trench drain runs in front of the bays and grates sit in the yard; the
 *     apron falls gently towards them, so dampness rises with proximity;
 *   - wheel paths: tyre-polished lanes stay wetter (compacted, low roughness);
 *   - shelter: the strip against the facade under the canopy stays dry;
 *   - drying: a noisy threshold gives irregular, feathered dry edges and partial patches.
 * Value 0 = dry, ~0.5 = damp (darker, rougher-than-wet), 1 = standing water (mirror-ish).
 */
export const DAMP_BOUNDS = { x0: -110, z0: -110, size: 200 };
const N = 512;

/** Trench drain along the bay frontage and yard grates (world x, z). */
export const DRAINS = {
  trench: { x: 5.2, z0: -56, z1: 0 },
  grates: [
    [-3, -6],
    [-3, -30],
    [-16, -20],
    [-14, 12],
  ] as ReadonlyArray<readonly [number, number]>,
};

/** Wheel paths (world): the truck's approach lane and the forklift arcs. */
const PATHS: ReadonlyArray<readonly [number, number, number, number, number]> = [
  // x0, z0, x1, z1, half-width
  [-1, 40, -1, -10, 1.3],
  [-1.8, 40, -1.8, -10, 0.6],
  [1.4, 40, 1.4, -10, 0.6],
  [12, -8, 4, -8, 0.5],
  [12, -16, 4, -16, 0.5],
];

function distToSegment(px: number, pz: number, x0: number, z0: number, x1: number, z1: number) {
  const dx = x1 - x0;
  const dz = z1 - z0;
  const t = Math.max(0, Math.min(1, ((px - x0) * dx + (pz - z0) * dz) / (dx * dx + dz * dz)));
  return Math.hypot(px - (x0 + t * dx), pz - (z0 + t * dz));
}

export function createDampMask(): DataTexture {
  const data = new Uint8Array(N * N);
  const cell = DAMP_BOUNDS.size / N;
  for (let j = 0; j < N; j++) {
    for (let i = 0; i < N; i++) {
      const x = DAMP_BOUNDS.x0 + (i + 0.5) * cell;
      const z = DAMP_BOUNDS.z0 + (j + 0.5) * cell;
      // Slab dishing: distance to the nearest joint (6 m grid, offset like the joints).
      const sx = (((x + 2 + 3) % 6) + 6) % 6;
      const sz = (((z + 20 + 3) % 6) + 6) % 6;
      const toJoint = Math.min(sx, 6 - sx, sz, 6 - sz); // 0 at joints, 3 at slab centre
      const dish = Math.min(1, toJoint / 2.4);
      // Fall towards drains.
      let drain = Math.abs(x - DRAINS.trench.x) / 9 + (z < DRAINS.trench.z0 || z > DRAINS.trench.z1 ? 1 : 0);
      for (const [gx, gz] of DRAINS.grates) drain = Math.min(drain, Math.hypot(x - gx, z - gz) / 14);
      drain = 1 - Math.min(1, drain);
      let path = 0;
      for (const [x0, z0, x1, z1, w] of PATHS) path = Math.max(path, 1 - Math.min(1, distToSegment(x, z, x0, z0, x1, z1) / w));
      // Sheltered strip under the canopy / against the facade stays dry.
      const shelter = 1 - Math.max(0, Math.min(1, (x - 3.2) / 1.6));
      const fbm =
        0.5 * valueNoise(x * 0.09 + 5, z * 0.09, 512, 71) +
        0.3 * valueNoise(x * 0.31, z * 0.31 + 9, 512, 72) +
        0.2 * valueNoise(x * 1.3, z * 1.3, 512, 73);
      // Water depth potential: broad wetness (rain fell everywhere) shaped by where it drains to.
      const potential = 0.74 + 0.3 * dish * 0.8 + 0.28 * drain + 0.18 * path + (fbm - 0.5) * 0.85;
      // Drying front: feathered threshold with a noisy edge.
      const wet = Math.max(0, Math.min(1, (potential - 0.42) / 0.22)) * (1 - 0.9 * shelter);
      const pool = Math.max(0, Math.min(1, (potential - 0.78) / 0.12)) * dish * 0.9 + (drain > 0.85 ? 0.6 : 0);
      data[j * N + i] = Math.round(Math.min(1, wet * 0.75 + pool * 0.5) * 255);
    }
  }
  const t = new DataTexture(data, N, N, RedFormat, UnsignedByteType);
  t.magFilter = LinearFilter;
  t.minFilter = LinearFilter;
  t.needsUpdate = true;
  return t;
}

export const dampUniform = () => ({
  dampMap: { value: null as unknown as DataTexture },
  dampBounds: { value: new Vector4(DAMP_BOUNDS.x0, DAMP_BOUNDS.z0, DAMP_BOUNDS.size, 0) },
});

/**
 * Wet response on the ground material: damp darkens the albedo (up to ~40 %) and lowers
 * roughness where wet; standing water (mask → 1) drops it to a near-mirror. The aggregate
 * roughness map still breaks the reflections everywhere else. Also adds screen-space-cheap
 * construction evidence directly in albedo: aggregate speckle, macro slab tone, tyre-rubber
 * streaks along the truck/forklift lanes, oil spotting under the bays, a dirt line where the
 * slab meets the wall, and darker/damper saw-cut joints — so the surface reads as photographed
 * concrete up close, not a flat grey plane.
 */
export function withDamp(material: MeshStandardMaterial, mask: DataTexture): void {
  const uniforms = dampUniform();
  uniforms.dampMap.value = mask;
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vDampWorld;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvDampWorld = (modelMatrix * vec4(position, 1.0)).xyz;");
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        "#include <common>\nuniform sampler2D dampMap;\nuniform vec4 dampBounds;\nvarying vec3 vDampWorld;\nfloat dampAt() { vec2 uv = (vDampWorld.xz - dampBounds.xy) / dampBounds.z; return (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) ? 0.25 : texture2D(dampMap, uv).r; }",
      )
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
float damp = dampAt();
vec2 gp = vDampWorld.xz;
float near = 1.0 - smoothstep(6.0, 40.0, length(vViewPosition));
float ag = fract(sin(dot(floor(gp * 110.0), vec2(12.9898, 78.233))) * 43758.5453);
float ag2 = fract(sin(dot(floor(gp * 34.0), vec2(39.3468, 11.135))) * 24634.6345);
diffuseColor.rgb *= 1.0 + near * (0.30 * (ag - 0.5) + 0.24 * (ag2 - 0.5));
vec2 slab = floor((gp + vec2(5.0, 23.0)) / 6.0);
diffuseColor.rgb *= 0.88 + 0.20 * fract(sin(dot(slab, vec2(41.7, 17.3))) * 9173.7);
float lane = min(abs(gp.x + 1.8), abs(gp.x - 1.4));
float rub = (1.0 - smoothstep(0.0, 0.22, lane)) * smoothstep(-12.0, 30.0, gp.y) * (0.5 + 0.5 * ag2);
diffuseColor.rgb *= 1.0 - 0.32 * rub;
float oil = (1.0 - smoothstep(0.1, 0.5, length(gp - vec2(4.2, -8.2)))) + (1.0 - smoothstep(0.1, 0.4, length(gp - vec2(3.6, -16.4))));
diffuseColor.rgb *= 1.0 - 0.4 * clamp(oil, 0.0, 1.0);
diffuseColor.rgb *= 1.0 - 0.3 * smoothstep(5.5, 8.6, gp.x) * (0.6 + 0.4 * ag2);
vec2 jp = mod(gp + vec2(5.0, 23.0), 6.0); float jd = min(min(jp.x, 6.0 - jp.x), min(jp.y, 6.0 - jp.y));
diffuseColor.rgb *= 1.0 - 0.45 * (1.0 - smoothstep(0.0, 0.05, jd)) * (0.4 + 0.6 * smoothstep(0.1, 0.5, damp));
diffuseColor.rgb *= 1.0 - 0.5 * smoothstep(0.05, 0.6, damp);`,
      )
      .replace(
        "#include <roughnessmap_fragment>",
        "#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, roughnessFactor * 0.35, smoothstep(0.1, 0.6, damp));\nroughnessFactor = mix(roughnessFactor, 0.04, smoothstep(0.62, 0.95, damp));",
      );
  };
  material.customProgramCacheKey = () => "bsr-dock-damp";
}
