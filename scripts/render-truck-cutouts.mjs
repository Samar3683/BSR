/**
 * Renders the cut-outs of the BSR truck used by the film below the hero
 * (src/config/cutouts.ts) from the hero's own production models, so the
 * livery, proportions and wheels always match the opening scene.
 *
 *   pnpm assets:truck-cutouts
 *
 * - A tiny static server serves three.js (node_modules) and the models
 *   (public/assets); headless Chromium renders each view with a transparent
 *   background (software WebGL is enough), trims it to its alpha bounds and
 *   encodes WebP — no image library needed.
 * - Side view, facing right, orthographic, in registered layers: the
 *   tractor and the trailer without wheels, and the near-side wheels apart
 *   (one image per wheel type), all placed in percentages of the whole
 *   truck's box. Three-quarter front (perspective, contact shadow) and top
 *   view.
 * - Writes public/assets/images/content/cutouts/*.webp and the placements
 *   module src/config/cutouts-placements.ts (read by src/config/cutouts.ts).
 * - Materials get the hero's refinements (truck-materials.ts); the wheel layer
 *   is lit along the view axis so its shading survives CSS rotation.
 *
 * Re-run whenever the truck models change; replace with photographic
 * cut-outs of the real truck when they exist (docs/cinematic-media-manifest.md).
 */
import { createHash } from "node:crypto";
import { mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import http from "node:http";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { chromium } from "@playwright/test";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
// CUTOUTS_OUT renders elsewhere (to compare before replacing the published set).
const OUT = process.env.CUTOUTS_OUT ?? join(ROOT, "public/assets/images/content/cutouts");
const PORT = 3311;

const PAGE = `<!doctype html><html><body style="margin:0;background:transparent">
<script type="importmap">{"imports":{"three":"/three/build/three.module.js","three/addons/":"/three/examples/jsm/"}}</script>
<script type="module">
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { KTX2Loader } from "three/addons/loaders/KTX2Loader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setClearColor(0x000000, 0);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.75;
const key = new THREE.DirectionalLight(0xfff6ea, 2.4);
key.castShadow = true;
key.shadow.mapSize.set(4096, 4096);
Object.assign(key.shadow.camera, { left: -14, right: 14, top: 14, bottom: -14, near: 1, far: 80 });
key.shadow.bias = -0.0004;
scene.add(key, key.target, new THREE.HemisphereLight(0xf2f6f3, 0x5d6360, 0.55));
const catcher = new THREE.Mesh(new THREE.PlaneGeometry(120, 120), new THREE.ShadowMaterial({ opacity: 0.32 }));
catcher.rotation.x = -Math.PI / 2;
catcher.position.y = 0.001;
catcher.receiveShadow = true;
scene.add(catcher);

const ktx2 = new KTX2Loader().setTranscoderPath("/assets/decoders/basis/").detectSupport(renderer);
const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).setKTX2Loader(ktx2);
const [tractor, trailer] = (await Promise.all([
  loader.loadAsync("/assets/models/truck/bsr-tractor-high.glb"),
  loader.loadAsync("/assets/models/truck/bsr-trailer-high.glb"),
])).map((gltf) => gltf.scene);
const root = new THREE.Group();
root.add(tractor);
tractor.getObjectByName("Hitch_FifthWheel").add(trailer);
root.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
// Same material separation as the hero (src/experiences/home/scenes/truck-materials.ts,
// refineMaterial) — keep the two in step, so the film's truck is the opening's truck.
const tuned = new Set();
root.traverse((o) => {
  if (!o.isMesh) return;
  for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
    if (tuned.has(m)) continue;
    tuned.add(m);
    if (m.name === "MAT_Metal_Steel") { m.roughness = 0.56; m.metalness = 0.75; m.color.setScalar(0.52); m.envMapIntensity = 0.8; }
    if (m.name === "MAT_Curtain") { m.color.set("#e9e8e2"); m.normalScale.multiplyScalar(0.5); m.envMapIntensity = 0.8; }
    if (m.name === "MAT_Plastic_Grille") { m.color.setScalar(0.035); m.roughness = 0.68; }
    if (m.name === "MAT_Light_Tail" || m.name === "MAT_Light_Brake") m.emissive.setRGB(1, 0.015, 0.008);
  }
});
scene.add(root);
const spins = [];
root.traverse((o) => { if (o.name.endsWith("_Spin")) spins.push(o); });

// The framing box: every mesh, whatever is shown, so layers stay registered.
const box = new THREE.Box3();
root.updateMatrixWorld(true);
root.traverse((o) => { if (o.isMesh && !/^(Hitch|Lights)/.test(o.name)) box.expandByObject(o); });

function trim(canvas) {
  const { width: w, height: h } = canvas;
  const data = canvas.getContext("2d").getImageData(0, 0, w, h).data;
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (data[(y * w + x) * 4 + 3] > 6) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  }
  return { left: x0, top: y0, width: x1 - x0 + 1, height: y1 - y0 + 1 };
}
function crop(canvas, r) {
  const out = document.createElement("canvas");
  out.width = r.width; out.height = r.height;
  out.getContext("2d").drawImage(canvas, r.left, r.top, r.width, r.height, 0, 0, r.width, r.height);
  return out.toDataURL("image/webp", 0.86);
}

window.render = ({ w, h, view, pad = 0.015, shadow = true, layer = "all", keyDir }) => {
  renderer.setSize(w, h, false);
  root.traverse((o) => { o.visible = true; });
  if (layer === "tractor") { trailer.visible = false; spins.forEach((s) => (s.visible = false)); }
  if (layer === "trailer") { root.traverse((o) => { if (o.isMesh) o.visible = false; }); trailer.traverse((o) => { if (o.isMesh) o.visible = true; }); spins.forEach((s) => (s.visible = false)); }
  if (layer === "wheels") { root.traverse((o) => { if (o.isMesh) o.visible = false; }); spins.forEach((s) => { s.visible = true; s.traverse((o) => { if (o.isMesh) o.visible = true; }); }); }
  catcher.visible = shadow;
  const c = box.getCenter(new THREE.Vector3());
  const dir = new THREE.Vector3(...view.dir).normalize();
  let cam;
  if (view.ortho) {
    cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 200);
    cam.position.copy(c).addScaledVector(dir, 50);
    cam.up.set(...(view.up ?? [0, 1, 0]));
    cam.lookAt(c);
    cam.updateMatrixWorld();
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) {
      const p = new THREE.Vector3(x, y, z).applyMatrix4(cam.matrixWorldInverse);
      x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y);
    }
    let hw = ((x1 - x0) / 2) * (1 + pad), hh = ((y1 - y0) / 2) * (1 + pad);
    if (hw / hh > w / h) hh = (hw * h) / w; else hw = (hh * w) / h;
    Object.assign(cam, { left: (x0 + x1) / 2 - hw, right: (x0 + x1) / 2 + hw, top: (y0 + y1) / 2 + hh, bottom: (y0 + y1) / 2 - hh });
    cam.updateProjectionMatrix();
  } else {
    cam = new THREE.PerspectiveCamera(view.fov, w / h, 0.1, 300);
    cam.position.copy(c).addScaledVector(dir, box.getSize(new THREE.Vector3()).length() * 1.6);
    cam.lookAt(c);
  }
  // Wheels are rotated by the page (wheel-spin), and their baked light turns with them: lit
  // along the view axis with a quiet environment, a wheel's shading is rotationally even, so
  // no highlight is seen to orbit the hub.
  const wheelsOnly = layer === "wheels";
  key.position.copy(c).add(wheelsOnly ? dir.clone().multiplyScalar(20) : new THREE.Vector3(...keyDir).multiplyScalar(20));
  key.target.position.copy(c);
  key.castShadow = !wheelsOnly;
  scene.environmentIntensity = wheelsOnly ? 0.35 : 0.75;
  renderer.render(scene, cam);
  // Copy to a 2D canvas to read the pixels and encode.
  const flat = document.createElement("canvas");
  flat.width = w; flat.height = h;
  flat.getContext("2d").drawImage(renderer.domElement, 0, 0);
  const bounds = trim(flat);
  const wheels = spins.map((s) => {
    const b = new THREE.Box3().setFromObject(s);
    const centre = b.getCenter(new THREE.Vector3());
    const p = centre.clone().project(cam);
    const top = centre.clone().add(new THREE.Vector3(0, b.getSize(new THREE.Vector3()).y / 2, 0)).project(cam);
    // The spin axis (the node's origin) is what CSS rotates about: measure its offset from the
    // bounds centre the crop is built on, so a drifting wheel is caught here, not on the page.
    const axle = s.getWorldPosition(new THREE.Vector3()).project(cam);
    const offsetPx = Math.hypot((axle.x - p.x) * w / 2, (axle.y - p.y) * h / 2);
    return { name: s.name, x: ((axle.x + 1) / 2) * w, y: ((1 - axle.y) / 2) * h, r: Math.abs(((top.y - p.y) / 2) * h), offsetPx };
  });
  const cropWheel = (wheel) => {
    const r = Math.ceil(wheel.r) + 3;
    const rect = { left: Math.round(wheel.x - r), top: Math.round(wheel.y - r), width: 2 * r, height: 2 * r };
    return { rect, data: crop(flat, rect) };
  };
  return { bounds, data: crop(flat, bounds), wheels, wheelCrops: layer === "wheels" ? wheels.map(cropWheel) : [] };
};
window.ready = true;
</script></body></html>`;

const TYPES = {
  ".js": "text/javascript",
  ".glb": "model/gltf-binary",
  ".wasm": "application/wasm",
};
const server = http
  .createServer(async (req, res) => {
    const url = decodeURIComponent(req.url.split("?")[0]);
    try {
      if (url === "/") {
        res.writeHead(200, { "content-type": "text/html" });
        return res.end(PAGE);
      }
      const file = url.startsWith("/three/")
        ? join(ROOT, "node_modules/three", url.slice(7))
        : join(ROOT, "public", url);
      const body = await readFile(file);
      res.writeHead(200, { "content-type": TYPES[extname(file)] ?? "application/octet-stream" });
      res.end(body);
    } catch {
      res.writeHead(404);
      res.end();
    }
  })
  .listen(PORT);

const browser = await chromium.launch({
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});
const page = await browser.newPage();
await page.goto(`http://localhost:${PORT}/`);
await page.waitForFunction(() => window.ready, null, { timeout: 180_000 });

// Content-addressed names (`truck-side.<hash>.webp`): a re-render never reuses a URL, so no
// browser, CDN or image-optimiser cache serves the previous truck. Older versions are removed.
const files = {};
const save = (name, dataUrl) => {
  const bytes = Buffer.from(dataUrl.split(",")[1], "base64");
  const stem = name.replace(/\.webp$/, "");
  const named = `${stem}.${createHash("sha256").update(bytes).digest("hex").slice(0, 10)}.webp`;
  mkdirSync(OUT, { recursive: true });
  for (const old of readdirSync(OUT)) {
    if ((old === name || (old.startsWith(`${stem}.`) && old.endsWith(".webp"))) && old !== named) {
      rmSync(join(OUT, old));
    }
  }
  writeFileSync(join(OUT, named), bytes);
  files[name] = named;
};
mkdirSync(OUT, { recursive: true });

// Side view, facing right (camera on the truck's right, -X), registered layers.
const SIDE = {
  w: 3200,
  h: 800,
  view: { ortho: true, dir: [-1, 0, 0] },
  keyDir: [-1, 1.6, 1.2],
  shadow: false,
};
const shot = (opts) => page.evaluate((o) => window.render(o), opts);
const full = await shot({ ...SIDE });
const tractor = await shot({ ...SIDE, layer: "tractor" });
const trailer = await shot({ ...SIDE, layer: "trailer" });
const wheels = await shot({ ...SIDE, layer: "wheels" });
save("truck-side.webp", full.data);
save("truck-side-tractor.webp", tractor.data);
save("truck-side-trailer.webp", trailer.data);

const U = full.bounds;
const pct = (r) => ({
  x: +(((r.left - U.left) / U.width) * 100).toFixed(3),
  y: +(((r.top - U.top) / U.height) * 100).toFixed(3),
  w: +((r.width / U.width) * 100).toFixed(3),
  h: +((r.height / U.height) * 100).toFixed(3),
});
const WHEEL_FILES = {
  Wheel_FR_Spin: "truck-wheel-front.webp",
  Wheel_RR_Spin: "truck-wheel-drive.webp",
  Wheel_TR_01_Spin: "truck-wheel-trailer.webp",
};
const placements = [];
wheels.wheels.forEach((wheel, i) => {
  if (!/_(F|R|T)R(_\d+)?_Spin$/.test(wheel.name)) return; // the near (right) side only
  const { rect, data } = wheels.wheelCrops[i];
  const file = WHEEL_FILES[wheel.name] ?? WHEEL_FILES[wheel.name.replace(/_0\d_/, "_01_")];
  if (WHEEL_FILES[wheel.name]) save(file, data);
  placements.push({
    src: file,
    part: wheel.name.startsWith("Wheel_T") ? "trailer" : "tractor",
    ...pct(rect),
  });
});

const front = await shot({
  w: 2400,
  h: 1500,
  view: { dir: [-1, 0.2, 0.95], fov: 22 },
  keyDir: [-1, 1.5, 1.4],
  pad: 0.02,
});
save("truck-front34.webp", front.data);
const top = await shot({
  w: 1800,
  h: 520,
  view: { ortho: true, dir: [0, 1, 0], up: [1, 0, 0] },
  keyDir: [-0.4, 2, 0.6],
  shadow: false,
  pad: 0.03,
});
save("truck-top.webp", top.data);

const placementsModule = {
  files,
  side: {
    width: U.width,
    height: U.height,
    tractor: pct(tractor.bounds),
    trailer: pct(trailer.bounds),
    wheels: placements.map((wheel) => ({ ...wheel, src: files[wheel.src] })),
  },
  front34: { width: front.bounds.width, height: front.bounds.height },
  top: { width: top.bounds.width, height: top.bounds.height },
};
const worst = Math.max(...wheels.wheels.map((wheel) => wheel.offsetPx));
console.log(
  `wheel crops centred on their axles (largest bounds/axle offset ${worst.toFixed(2)} px)`,
);
// Written next to the config that reads it — never copied by hand (placement drift).
// Skipped for CUTOUTS_OUT test renders, which must not change the published placements.
if (!process.env.CUTOUTS_OUT) {
  writeFileSync(
    join(ROOT, "src/config/cutouts-placements.ts"),
    `/** GENERATED by scripts/render-truck-cutouts.mjs (pnpm assets:truck-cutouts) — do not edit. */\n` +
      `export const CUTOUT_PLACEMENTS = ${JSON.stringify(placementsModule, null, 2)} as const;\n`,
  );
}
console.log(JSON.stringify(placementsModule, null, 2));
await browser.close();
server.close();
