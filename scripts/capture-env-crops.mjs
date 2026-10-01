/**
 * Truck-hidden environment validation renders (custom close cameras) at fixed story
 * progress values:  node scripts/capture-env-crops.mjs [--out dir]
 * Writes 1024x1024 frames for: interior, loading bay, wet concrete (dock), each with the
 * BSR truck hidden. The 512 crops used in review are cut from these.
 */
import { mkdirSync } from "node:fs";
import path from "node:path";
import { chromium } from "@playwright/test";

const root = path.resolve(import.meta.dirname, "..");
const out = path.join(root, "docs/styleframes/hero/photoreal-reconstruction/crops");
mkdirSync(out, { recursive: true });

const SHOTS = [
  { name: "industrial-asphalt", progress: 0.665, pos: [2, 0.55, -6], look: [1, 0, 30], fov: 45 },
  { name: "industrial-building", progress: 0.665, pos: [8, 2.5, -10], look: [48, 7, 140], fov: 40 },
  { name: "industrial-vegetation", progress: 0.665, pos: [10, 1.6, -5], look: [40, 5, 90], fov: 45 },
  { name: "service-asphalt", progress: 0.705, pos: [2, 0.55, -6], look: [1, 0, 30], fov: 45 },
  { name: "service-canopy", progress: 0.705, pos: [10, 1.8, -5], look: [45, 4, 120], fov: 40 },
  { name: "service-glazing", progress: 0.705, pos: [14, 1.7, 40], look: [58, 2.4, 128], fov: 22 },
  { name: "service-vegetation", progress: 0.705, pos: [10, 1.6, -5], look: [40, 5, 90], fov: 45 },
  { name: "openroad-asphalt", progress: 0.77, pos: [2, 0.55, -6], look: [1, 0, 30], fov: 45 },
  { name: "openroad-vegetation", progress: 0.77, pos: [10, 1.6, -5], look: [42, 6, 120], fov: 45 },
  { name: "guardrail", progress: 0.77, pos: [-3.2, 1.1, -3], look: [-4.8, 0.6, 9], fov: 45 },
  { name: "reach", progress: 0.885, std: true },
  { name: "horizon", progress: 0.77, pos: [2, 1.6, -5], look: [-2, 6, 400], fov: 30 },
  { name: "forklift-a-approach", progress: 0.42, pos: [-4, 2.0, 1], look: [10, 1.0, -8], fov: 40 },
  { name: "forklift-b-threshold", progress: 0.47, pos: [-4, 2.0, 1], look: [10, 1.0, -8], fov: 40 },
  { name: "forklift-c-staging", progress: 0.5, pos: [-4, 2.0, 1], look: [10, 1.0, -8], fov: 40 },
  { name: "forklift-d-reverse", progress: 0.57, pos: [-4, 2.0, 1], look: [10, 1.0, -8], fov: 40 },
  { name: "interior", progress: 0.49, pos: [3.5, 2.6, -8], look: [16, 3.2, -8], fov: 55 },
  { name: "loading-bay", progress: 0.49, pos: [-3, 1.9, -1], look: [9, 2.0, -8], fov: 42 },
  { name: "wet-concrete-loading", progress: 0.49, pos: [-3, 1.0, -14], look: [-3, 0, -30], fov: 50 },
  { name: "wet-concrete-departure", progress: 0.53, pos: [4, 0.9, 6], look: [0, 0, 40], fov: 50 },
  { name: "facade", progress: 0.49, pos: [-4, 1.8, -20], look: [9, 5.5, -30], fov: 45 },
  { name: "departure-yard", progress: 0.53, pos: [-16, 2.2, 60], look: [-26, 2.0, 130], fov: 55 },
];

const only = process.argv[2] === "--only" ? process.argv[3]?.split(",") : null;
const shots = only ? SHOTS.filter((s) => only.includes(s.name)) : SHOTS;
for (const shot of shots) {
  const browser = await chromium.launch({ args: ["--enable-unsafe-swiftshader"] });
  const page = await browser.newPage({ viewport: { width: 1024, height: 1024 }, deviceScaleFactor: 1 });
  await page.goto("http://localhost:3100/?hero-path=realtime&hero-allow-software&hero-tier=high");
  await page.waitForFunction(() => window.__BSR_HERO__?.realtime === "active", null, { timeout: 120000 });
  await page.evaluate((p) => {
    const section = document.querySelector("[data-hero]");
    const range = section.offsetHeight - window.innerHeight;
    window.scrollTo({ top: section.offsetTop + p * range, behavior: "instant" });
  }, shot.progress);
  await page.waitForFunction((p) => Math.abs(window.__BSR_HERO__.progress.displayed - p) < 0.002, shot.progress);
  await page.addStyleTag({
    content: `[data-hero] > div:first-child, [data-hero] > p, [data-hero] [class*="scrim"], body > header, [data-site-header]{visibility:hidden!important}`,
  });
  await page.evaluate((s) => {
    const rt = window.__BSR_HERO__.runtime;
    rt.snapToProgress();
    if (!rt.frozen) rt.toggleFrozen();
    rt.update(performance.now());
    const b = rt.bindings;
    b.rig.root.visible = s.std ? false : false;
    if (s.std) { b.renderer.render(b.scene, b.camera); return; }
    b.camera.position.set(...s.pos);
    b.camera.fov = s.fov;
    b.camera.near = 0.05;
    b.camera.lookAt(...s.look);
    b.camera.updateProjectionMatrix();
    b.camera.updateMatrixWorld(true);
    b.renderer.render(b.scene, b.camera);
  }, shot);
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(out, `${shot.name}.png`) });
  console.log("crop", shot.name);
  await browser.close();
}
