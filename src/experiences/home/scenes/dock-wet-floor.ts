import { type DataTexture, PlaneGeometry, type ShaderMaterial, Vector4 } from "three";

import { Reflector } from "three/examples/jsm/objects/Reflector.js";

import { DAMP_BOUNDS } from "./dock-damp";

/*
 * Damp-concrete planar reflection for the dock apron: the scene really is
 * mirrored in the floor (truck, facade, lit bays, lamps, sky) — but only where
 * physics puts water. Coverage follows broad damp patches (fbm) and slab
 * low-spots, never a uniform mirror; the reflection is roughened (noise-warped,
 * vertically stretched taps) and weighted by Fresnel so it is faint looking
 * down and strong at grazing angles, like a wet surface photographed low.
 * Rendered at reduced resolution; visible only with the dock world.
 */
const SHADER = {
  name: "DockWetFloor",
  uniforms: {
    color: { value: null },
    tDiffuse: { value: null },
    dampMap: { value: null },
    dampBounds: { value: null },
    textureMatrix: { value: null },
  },
  vertexShader: /* glsl */ `
    uniform mat4 textureMatrix;
    varying vec4 vUv;
    varying vec3 vWorld;
    void main() {
      vUv = textureMatrix * vec4(position, 1.0);
      vec4 w = modelMatrix * vec4(position, 1.0);
      vWorld = w.xyz;
      gl_Position = projectionMatrix * viewMatrix * w;
    }`,
  fragmentShader: /* glsl */ `
    uniform vec3 color;
    uniform sampler2D tDiffuse;
    uniform sampler2D dampMap;
    uniform vec4 dampBounds;
    varying vec4 vUv;
    varying vec3 vWorld;
    float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
    float vnoise(vec2 p) {
      vec2 i = floor(p), f = fract(p);
      f = f * f * (3.0 - 2.0 * f);
      return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
    }
    float fbm(vec2 p) { float a = 0.5, s = 0.0; for (int i = 0; i < 4; i++) { s += a * vnoise(p); p *= 2.03; a *= 0.5; } return s; }
    void main() {
      vec2 uv = vUv.xy / vUv.w;
      // Damp map (shared with the ground material): reflection exists only where it is wet,
      // and its sharpness follows wetness (film = broken/blurred, standing water = sharp).
      vec2 duv = (vWorld.xz - dampBounds.xy) / dampBounds.z;
      float damp = (duv.x < 0.0 || duv.y < 0.0 || duv.x > 1.0 || duv.y > 1.0) ? 0.25 : texture2D(dampMap, duv).r;
      float sharp = smoothstep(0.35, 0.95, damp);
      // Aggregate breakup: high-frequency warp strongest on film, weak in pools.
      vec2 warp = (vec2(fbm(vWorld.xz * 40.0), fbm(vWorld.xz * 40.0 + 17.0)) - 0.5) * mix(0.014, 0.002, sharp)
                + (vec2(fbm(vWorld.xz * 5.0), fbm(vWorld.xz * 5.0 + 31.0)) - 0.5) * 0.006;
      float spread = mix(0.014, 0.003, sharp);
      vec3 c = vec3(0.0);
      float total = 0.0;
      for (int i = -2; i <= 2; i++) {
        float w = 1.0 - abs(float(i)) / 3.0;
        c += texture2D(tDiffuse, uv + warp + vec2(0.0, float(i) * spread) * 1.0).rgb * w;
        total += w;
      }
      c /= total;
      vec3 view = normalize(cameraPosition - vWorld);
      // Schlick-like: a few per cent looking down, strong only towards grazing. A flat 0.4
      // floor made the steep near-field views (departure) glow with lamp streaks.
      float fres = pow(1.0 - clamp(view.y, 0.0, 1.0), 4.0);
      float alpha = clamp((0.08 + 0.92 * fres) * smoothstep(0.04, 0.5, damp) * (0.5 + 0.5 * sharp), 0.0, 0.85);
      gl_FragColor = vec4(c * color, alpha);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`,
};

export interface WetFloor {
  mesh: Reflector;
  /** Re-render the reflection on the next frame (the camera jumped: snap, switch, resize). */
  refresh(): void;
}

export function createWetFloor(mask: DataTexture, size = 264, textureSize = 512): WetFloor {
  const floor = new Reflector(new PlaneGeometry(size, size), {
    textureWidth: textureSize,
    textureHeight: textureSize,
    clipBias: 0.003,
    color: 0xb8c4d6,
    shader: SHADER,
  });
  floor.name = "Dock_Wet_Floor";
  floor.rotation.x = -Math.PI / 2;
  floor.renderOrder = 1;
  const material = floor.material as ShaderMaterial;
  material.uniforms.dampMap!.value = mask;
  material.uniforms.dampBounds!.value = new Vector4(
    DAMP_BOUNDS.x0,
    DAMP_BOUNDS.z0,
    DAMP_BOUNDS.size,
    0,
  );
  material.transparent = true;
  material.depthWrite = false;
  // The reflection is already blurred/broken by the shader above, so it never needs
  // per-frame fidelity: Reflector re-renders the whole scene into its target on every
  // call, which is the single most expensive thing on this page (a second full scene
  // pass every frame). During camera motion it updates every 3rd call and reuses the
  // previous texture otherwise. Discontinuities (snap to a checkpoint, world switch,
  // rebase, resize) call refresh(): frames are rendered on demand, so a reflection from
  // another viewpoint could otherwise stay on screen once rendering stops. Fast but
  // continuous motion keeps the throttle — that is when frames are tightest.
  const renderReflection = floor.onBeforeRender;
  let skip = 0;
  floor.onBeforeRender = (renderer, scene, camera, ...rest) => {
    if (skip++ % 3 !== 0) return;
    renderReflection.call(floor, renderer, scene, camera, ...rest);
  };
  return {
    mesh: floor,
    refresh() {
      skip = 0;
    },
  };
}
