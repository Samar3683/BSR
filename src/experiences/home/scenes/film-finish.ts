import {
  CustomBlending,
  DstColorFactor,
  Mesh,
  PlaneGeometry,
  ShaderMaterial,
  ZeroFactor,
} from "three";

/*
 * Photographic finish, one full-screen multiply pass drawn last: natural lens
 * vignette (≈ −0.35 EV in the corners) and fine luminance grain (a sensor at
 * ~ISO 800), which breaks the perfectly clean CG gradients and helps hide
 * compression banding in skies. Deliberately restrained; it does not read the
 * scene (no bloom/halation here — those live on the light sources themselves).
 * Grain is frozen while the story is frozen (deterministic captures).
 */
export function createFilmFinish(): Mesh {
  const material = new ShaderMaterial({
    uniforms: { seed: { value: 0 } },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = vec4(position.xy, 0.0, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform float seed;
      varying vec2 vUv;
      float hash(vec2 p) {
        p = fract(p * vec2(123.34, 456.21) + seed);
        p += dot(p, p + 45.32);
        return fract(p.x * p.y);
      }
      void main() {
        vec2 c = vUv * 2.0 - 1.0;
        float r = length(c * vec2(0.92, 1.0));
        float vignette = 1.0 - 0.16 * smoothstep(0.6, 1.4, r);
        float g = hash(gl_FragCoord.xy) + hash(gl_FragCoord.xy * 0.5 + 7.0) - 1.0;
        float grain = 1.0 + g * 0.035;
        gl_FragColor = vec4(vec3(vignette * grain), 1.0);
      }`,
    transparent: true,
    blending: CustomBlending,
    blendSrc: DstColorFactor,
    blendDst: ZeroFactor,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
  });
  const quad = new Mesh(new PlaneGeometry(2, 2), material);
  quad.name = "Film_Finish";
  quad.frustumCulled = false;
  quad.renderOrder = 1000;
  return quad;
}
