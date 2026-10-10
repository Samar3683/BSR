import {
  AdditiveBlending,
  BufferGeometry,
  Color,
  DataTexture,
  Float32BufferAttribute,
  InstancedMesh,
  LinearFilter,
  LinearMipmapLinearFilter,
  Matrix4,
  MeshBasicMaterial,
  PlaneGeometry,
  Points,
  PointsMaterial,
  RepeatWrapping,
  SRGBColorSpace,
  type Texture,
} from "three";

/*
 * Procedural detail shared by the dock and road worlds: small generated
 * textures (no image assets, no DOM) and cheap light cues that stand in for
 * expensive effects — ground glints instead of screen-space reflections,
 * emissive points instead of real lights. Every piece is one draw call.
 */

/** Value noise in [0, 1], tileable over `period` cells. */
export function valueNoise(x: number, y: number, period: number, seed: number): number {
  const hash = (i: number, j: number) => {
    const n =
      Math.sin(
        (((i % period) + period) % period) * 127.1 +
          (((j % period) + period) % period) * 311.7 +
          seed * 74.7,
      ) * 43758.5453;
    return n - Math.floor(n);
  };
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const fx = x - xi;
  const fy = y - yi;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const top = hash(xi, yi) + (hash(xi + 1, yi) - hash(xi, yi)) * sx;
  const bottom = hash(xi, yi + 1) + (hash(xi + 1, yi + 1) - hash(xi, yi + 1)) * sx;
  return top + (bottom - top) * sy;
}

function dataTexture(
  data: Uint8Array,
  width: number,
  height: number,
  options: { srgb?: boolean; repeat?: boolean; mipmaps?: boolean } = {},
): DataTexture {
  const texture = new DataTexture(data, width, height);
  if (options.repeat) texture.wrapS = texture.wrapT = RepeatWrapping;
  texture.magFilter = LinearFilter;
  texture.minFilter = options.mipmaps ? LinearMipmapLinearFilter : LinearFilter;
  texture.generateMipmaps = Boolean(options.mipmaps);
  texture.anisotropy = 8;
  if (options.srgb) texture.colorSpace = SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

/**
 * Insulated sandwich-panel cladding: a real construction system, not a repeated streak
 * pattern. One 6 × 6 m tile (matches the facade's world-scaled UV):
 *   - six 1 m panels with a distinct per-panel tone (each panel a separate sheet);
 *   - a dark joint line between panels, +panel-edge AO;
 *   - very faint vertical ribs carried mostly in roughness (real ribs are a specular/shadow
 *     cue at grazing light, not a strong albedo stripe);
 *   - causal weathering only: a handful of drip stains hang below panel joints (not a
 *     periodic comb), and the bottom of the tile (ground-level splash) darkens diffusely.
 * Returns {color, roughness} — a specular-only rib would otherwise be invisible.
 */
export function createCladdingMaps(size = 512): { color: DataTexture; roughness: DataTexture } {
  const color = new Uint8Array(size * size * 4);
  const roughness = new Uint8Array(size * size * 4);
  const hash = (a: number, b: number) => {
    const v = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
    return v - Math.floor(v);
  };
  // A handful of drip origins per panel row, each a soft downward gradient of limited length.
  const drips: Array<{ px: number; row: number; len: number; strength: number }> = [];
  for (let row = 0; row < 6; row++) {
    const n = 1 + Math.floor(hash(row, 99) * 2);
    for (let k = 0; k < n; k++) {
      drips.push({
        px: hash(row, k) * 6,
        row,
        len: 0.25 + hash(row, k + 10) * 0.5,
        strength: 0.08 + hash(row, k + 20) * 0.1,
      });
    }
  }
  for (let y = 0; y < size; y++) {
    const vy = y / size; // 0 = tile top in UV, but the tile repeats; treat symmetrically
    const panelF = vy * 6;
    const panel = Math.floor(panelF);
    const inPanel = panelF - panel;
    const joint = inPanel < 0.018 || inPanel > 0.982;
    const edgeAO = 1 - 0.12 * Math.exp(-Math.min(inPanel, 1 - inPanel) * 40);
    for (let x = 0; x < size; x++) {
      const vx = x / size;
      const col = Math.floor(vx * 6);
      // Per-panel identity: a distinct base tone per (row, col) sheet.
      const panelTone = 0.88 + 0.16 * hash(panel, col * 3.1 + 7);
      const grain = 0.94 + 0.12 * valueNoise(vx * 60, vy * 60, 64, 5);
      // Faint vertical rib: contributes almost nothing to albedo, mostly to roughness below.
      const ribAlbedo = 1 - 0.012 * (0.5 + 0.5 * Math.cos(vx * 6 * 18 * Math.PI * 2));
      let v = panelTone * grain * ribAlbedo * edgeAO;
      // Causal drips below this panel's joint only.
      for (const d of drips) {
        if (d.row !== panel) continue;
        const dx = Math.abs(vx * 6 - d.px);
        if (dx > 0.12) continue;
        const along = inPanel / d.len;
        if (along > 1) continue;
        v *=
          1 -
          d.strength *
            (1 - dx / 0.12) *
            (1 - along) *
            (0.6 + 0.4 * valueNoise(vx * 40, vy * 200, 64, 9));
      }
      // Ground-level splash: only the lowest ~15% of the whole building (last panel row).
      if (panel === 5)
        v *=
          1 -
          0.1 *
            Math.max(0, (inPanel - 0.5) / 0.5) *
            (0.7 + 0.3 * valueNoise(vx * 30, vy * 30, 64, 13));
      if (joint) v *= 0.5;
      const i = (y * size + x) * 4;
      color[i] = color[i + 1] = Math.min(255, Math.round(v * 210));
      color[i + 2] = Math.min(255, Math.round(v * 206));
      color[i + 3] = 255;
      const ribR = 0.5 + 0.5 * Math.cos(vx * 6 * 18 * Math.PI * 2);
      const r =
        0.55 + 0.14 * (ribR - 0.5) + 0.08 * (hash(panel, col * 3.1 + 7) - 0.5) + (joint ? 0.15 : 0);
      roughness[i] = roughness[i + 2] = 0;
      roughness[i + 1] = Math.round(Math.min(1, Math.max(0.25, r)) * 255);
      roughness[i + 3] = 255;
    }
  }
  return {
    color: dataTexture(color, size, size, { srgb: true, repeat: true, mipmaps: true }),
    roughness: dataTexture(roughness, size, size, { repeat: true, mipmaps: true }),
  };
}

/** Roller-door slats/** Roller-door slats: 0.25 m horizontal slats over a 3 m door (one tile per door). */
export function createSlatTexture(size = 128): DataTexture {
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    const s = ((y / size) * 12) % 1;
    const v = s < 0.08 ? 0.55 : 0.92 + 0.08 * Math.sin(s * Math.PI);
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      data[i] = data[i + 1] = data[i + 2] = Math.round(v * 235);
      data[i + 3] = 255;
    }
  }
  return dataTexture(data, size, size, { srgb: true, repeat: true, mipmaps: true });
}

/** Diagonal yellow/black hazard stripes (safety floor marking near a loading bay). */
export function createHazardStripeTexture(size = 64): DataTexture {
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const diagonal = ((x + y) / size) % 1;
      const black = diagonal < 0.5;
      const i = (y * size + x) * 4;
      if (black) {
        data[i] = data[i + 1] = data[i + 2] = 22;
      } else {
        data[i] = 232;
        data[i + 1] = 178;
        data[i + 2] = 35;
      }
      data[i + 3] = 255;
    }
  }
  return dataTexture(data, size, size, { srgb: true, repeat: true, mipmaps: true });
}

/** Vertical light falloff (bright at the top): lit bay interiors and wall washes. */
export function createFalloffTexture(size = 64): DataTexture {
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const v = y / (size - 1); // 0 = bottom, 1 = top
      const across = Math.exp(-(((x + 0.5) / size - 0.5) ** 2) * 9);
      const value = (0.28 + 0.72 * v ** 1.6) * (0.55 + 0.45 * across);
      const i = (y * size + x) * 4;
      data[i] = data[i + 1] = data[i + 2] = Math.round(value * 255);
      data[i + 3] = 255;
    }
  }
  return dataTexture(data, size, size);
}

/**
 * Asphalt, one 4 × 4 m tile: aggregate speckle over a slightly mottled
 * binder (colour), and matching roughness (green channel) with polished
 * wheel paths lower — so the low sun draws a soft sheen, never a mirror.
 */
export function createAsphaltMaps(size = 256): { color: DataTexture; roughness: DataTexture } {
  const color = new Uint8Array(size * size * 4);
  const roughness = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const v = y / size;
      const speck = valueNoise(u * 128, v * 128, 128, 3);
      const mottle = valueNoise(u * 8, v * 8, 8, 4);
      const tone = 0.82 + 0.3 * (speck > 0.78 ? speck : 0.55 * speck) + 0.1 * (mottle - 0.5);
      const i = (y * size + x) * 4;
      const c = Math.min(255, Math.round(tone * 150));
      color[i] = c;
      color[i + 1] = c;
      color[i + 2] = Math.min(255, Math.round(c * 1.03));
      color[i + 3] = 255;
      const r = 0.78 + 0.12 * (speck - 0.5) - 0.1 * mottle;
      roughness[i] = roughness[i + 2] = 0;
      roughness[i + 1] = Math.round(Math.min(1, Math.max(0, r)) * 255);
      roughness[i + 3] = 255;
    }
  }
  return {
    color: dataTexture(color, size, size, { srgb: true, repeat: true, mipmaps: true }),
    roughness: dataTexture(roughness, size, size, { repeat: true, mipmaps: true }),
  };
}

/**
 * Asphalt aggregate at real scale: one 0.5 × 0.5 m tile at 1 mm/texel (tileable).
 * Height in R: 6–16 mm stones (domed, some chipped bigger ones) bedded in a darker,
 * lower bitumen matrix. The road shader turns it into a micro-normal, a stone-vs-binder
 * albedo split and a stone-top roughness dip (sun glints) — the layer the baked road tile
 * (13 mm/texel) cannot carry when the camera sits 0.4 m above the surface.
 */
export function createAggregateDetail(size = 512): DataTexture {
  const height = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const v = y / size;
      height[y * size + x] =
        0.16 +
        0.07 * valueNoise(u * 24, v * 24, 24, 91) +
        0.04 * valueNoise(u * 96, v * 96, 96, 92);
    }
  }
  let s = 0x9e3779b9;
  const rand = () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 1_000_000) / 1_000_000;
  };
  const stone = (radius: number, top: number) => {
    const cx = rand() * size;
    const cy = rand() * size;
    const r = Math.ceil(radius);
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        const d = Math.hypot(dx, dy) / radius;
        if (d >= 1) continue;
        const i =
          ((((Math.floor(cy) + dy) % size) + size) % size) * size +
          ((((Math.floor(cx) + dx) % size) + size) % size);
        const dome = 0.22 + top * (1 - d * d) ** 0.55;
        if (dome > height[i]!) height[i] = dome;
      }
    }
  };
  for (let n = 0; n < 1500; n++) stone(3 + rand() * 4.5, 0.35 + 0.55 * rand());
  for (let n = 0; n < 26; n++) stone(9 + rand() * 6, 0.5 + 0.45 * rand()); // chipped surface stones
  const data = new Uint8Array(size * size * 4);
  for (let i = 0; i < size * size; i++) {
    const value = Math.round(Math.min(1, height[i]!) * 255);
    data[i * 4] = data[i * 4 + 1] = data[i * 4 + 2] = value;
    data[i * 4 + 3] = 255;
  }
  return dataTexture(data, size, size, { repeat: true, mipmaps: true });
}

/** Glint: a streak bright at its source (v = 0) and fading towards the viewer (v = 1). */
function createGlintTexture(width = 32, height = 128): DataTexture {
  const data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    const v = y / (height - 1);
    const along = Math.exp(-v * 3.2) * Math.min(1, v * 14 + 0.25);
    for (let x = 0; x < width; x++) {
      const across = Math.exp(-((((x + 0.5) / width - 0.5) / 0.2) ** 2));
      const i = (y * width + x) * 4;
      data[i] = data[i + 1] = data[i + 2] = 255;
      data[i + 3] = Math.round(along * across * 255);
    }
  }
  return dataTexture(data, width, height);
}

/** Round soft glow (additive cards and points). */
export function createGlowTexture(size = 64): DataTexture {
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const d = Math.hypot(x + 0.5 - size / 2, y + 0.5 - size / 2) / (size / 2);
      const core = Math.max(0, 1 - d / 0.12);
      const halo = Math.exp(-d * d * 7) * 0.55;
      const v = Math.min(1, core + halo) * (d < 1 ? 1 : 0);
      const i = (y * size + x) * 4;
      data[i] = data[i + 1] = data[i + 2] = 255;
      data[i + 3] = Math.round(v * 255);
    }
  }
  return dataTexture(data, size, size);
}

export interface GlintSource {
  /** Light position projected on the ground. */
  x: number;
  z: number;
  length: number;
  width: number;
  color: string;
  /** Relative strength (instance colour scale). */
  strength: number;
}

/**
 * Wet-ground glints: each bright source gets a streak on the damp ground,
 * stretched from the source towards the camera — how a point light reflects
 * on a damp surface. One instanced draw; the streaks re-aim at the camera
 * before each render; `intensity` scales them all.
 */
export function createGroundGlints(
  sources: readonly GlintSource[],
  name: string,
  /** Read before each render (e.g. the dock lighting level); default 1. */
  intensity: () => number = () => 1,
): { mesh: InstancedMesh; material: MeshBasicMaterial } {
  const geometry = new PlaneGeometry(1, 1).rotateX(-Math.PI / 2).translate(0, 0, 0.5);
  const material = new MeshBasicMaterial({
    map: createGlintTexture(),
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    fog: false,
    toneMapped: false,
  });
  const mesh = new InstancedMesh(geometry, material, sources.length);
  mesh.name = name;
  mesh.frustumCulled = false;
  mesh.renderOrder = 2;
  const tint = new Color();
  const base = sources.map((source) => new Color(source.color).multiplyScalar(source.strength));
  sources.forEach((_, i) => mesh.setColorAt(i, base[i]!));
  const matrix = new Matrix4();
  const rotation = new Matrix4();
  mesh.onBeforeRender = (_renderer, _scene, camera) => {
    material.opacity = intensity();
    sources.forEach((source, i) => {
      const dx = camera.position.x - source.x;
      const dz = camera.position.z - source.z;
      const distance = Math.max(1, Math.hypot(dx, dz));
      // A wet-ground streak is a grazing-angle effect: it fades as the view over the source
      // steepens and never runs under the camera (a fixed-length card drew glowing columns
      // up the bottom of the steep departure frames).
      const elevation = Math.max(0, camera.position.y) / distance;
      const t = Math.min(1, Math.max(0, (elevation - 0.06) / 0.24));
      const grazing = 1 - t * t * (3 - 2 * t);
      rotation.makeRotationY(Math.atan2(dx, dz));
      matrix
        .makeScale(
          source.width,
          1,
          Math.min(source.length, distance * 0.7) * (0.35 + 0.65 * grazing),
        )
        .premultiply(rotation)
        .setPosition(source.x, 0.012, source.z);
      mesh.setMatrixAt(i, matrix);
      mesh.setColorAt(i, tint.copy(base[i]!).multiplyScalar(grazing));
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.instanceColor!.needsUpdate = true;
  };
  return { mesh, material };
}

/**
 * Distant lights (city, yard and road lamps far away): screen-sized warm
 * points, unaffected by fog, placed in a ring sector around the origin.
 */
export function createDistantLights(options: {
  name: string;
  count: number;
  radius: readonly [number, number];
  /** Azimuth sector (radians, from +Z towards +X). */
  sector: readonly [number, number];
  height: readonly [number, number];
  size: number;
  seed: number;
}): { points: Points; material: PointsMaterial } {
  const positions: number[] = [];
  const colors: number[] = [];
  const warm = new Color("#ffc27a");
  const white = new Color("#fff1d8");
  const c = new Color();
  const rand = (i: number, k: number) => {
    const n = Math.sin(i * 91.7 + k * 17.3 + options.seed * 5.1) * 43758.5453;
    return n - Math.floor(n);
  };
  for (let i = 0; i < options.count; i++) {
    // Clustered along the sector: settlements, not an even sprinkle.
    const cluster = Math.floor(rand(i, 1) * 9);
    const a =
      options.sector[0] +
      (options.sector[1] - options.sector[0]) * ((cluster + 0.5) / 9 + (rand(i, 2) - 0.5) * 0.09);
    const r = options.radius[0] + (options.radius[1] - options.radius[0]) * rand(i, 3);
    const h = options.height[0] + (options.height[1] - options.height[0]) * rand(i, 4) ** 3;
    positions.push(Math.sin(a) * r, h, Math.cos(a) * r);
    c.copy(warm)
      .lerp(white, rand(i, 5))
      .multiplyScalar(0.7 + 0.6 * rand(i, 6));
    colors.push(c.r, c.g, c.b);
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new Float32BufferAttribute(colors, 3));
  const material = new PointsMaterial({
    size: options.size,
    sizeAttenuation: false,
    map: createGlowTexture(32),
    vertexColors: true,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    fog: false,
    toneMapped: false,
  });
  const points = new Points(geometry, material);
  points.name = options.name;
  points.frustumCulled = false;
  return { points, material };
}

/**
 * Cloud layer texture (tiles both ways): fractal noise, alpha only — the sky
 * dome tints it per vertex. The dome's mapping (wide tiles around the horizon,
 * short ones vertically) stretches it into layered bands.
 */
export function createCloudTexture(width = 512, height = 512): Texture {
  const data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const u = x / width;
      const v = y / height;
      let n = 0;
      let amplitude = 0.5;
      let frequency = 4;
      for (let octave = 0; octave < 6; octave++) {
        n += amplitude * valueNoise(u * frequency, v * frequency, frequency, 20 + octave);
        amplitude *= 0.5;
        frequency *= 2;
      }
      // Broken, layered cover (altocumulus at blue hour): soft thresholds.
      const cover = Math.min(1, Math.max(0, (n - 0.52) / 0.14));
      const i = (y * width + x) * 4;
      data[i] = data[i + 1] = data[i + 2] = 255;
      data[i + 3] = Math.round(cover * 255);
    }
  }
  return dataTexture(data, width, height, { mipmaps: true, repeat: true });
}
