#!/usr/bin/env node
/**
 * Hero real-time benchmark on the machine's real GPU (no software rasteriser).
 *
 * Holds the story at each cinematic checkpoint and lets the real frame driver
 * render continuously (composer, reflection throttle, shadows — the actual
 * pipeline), then reports per checkpoint: average/p90 frame time, fps, draw
 * calls per frame (all passes), geometries, textures, tier and DPR.
 *
 * Needs a production build with the test hooks, served on --url:
 *   BSR_DESIGN_PREVIEW=true NEXT_PUBLIC_BSR_HERO_TEST_HOOKS=true pnpm build && pnpm start
 *   node scripts/bench-hero.mjs --tier low
 *   node scripts/bench-hero.mjs --tier auto --attribute      (draw calls per object)
 *   node scripts/bench-hero.mjs --tier low --dpr 0.75           (force a render scale)
 *
 * `--tier auto` uses the page's own tier decision; a fixed tier holds the tier
 * for the whole run (the step-down monitor is relaxed so it cannot change).
 */
import { parseArgs } from "node:util";

import { chromium } from "@playwright/test";

const { values: args } = parseArgs({
  options: {
    url: { type: "string", default: "http://localhost:3100" },
    tier: { type: "string", default: "auto" },
    width: { type: "string", default: "1920" },
    height: { type: "string", default: "1080" },
    dsf: { type: "string", default: "1.25" },
    seconds: { type: "string", default: "3" },
    attribute: { type: "boolean", default: false },
    only: { type: "string" },
    dpr: { type: "string" },
  },
});

/** Mirrors the photoreal review scenes (scripts/build-photoreal-review.mjs). */
const CHECKPOINTS = [
  ["Preparation", 0.04],
  ["Ready", 0.39],
  ["Loading", 0.49],
  ["Departure", 0.53],
  ["Industrial", 0.665],
  ["Service", 0.705],
  ["Open Road", 0.77],
  ["Reach", 0.885],
];

const only = args.only?.split(",").map((s) => s.trim().toLowerCase());
const fixedTier = args.tier !== "auto";
const query = ["hero-path=realtime", ...(fixedTier ? [`hero-tier=${args.tier}`, "hero-allow-software"] : [])];

const browser = await chromium.launch({ args: ["--ignore-gpu-blocklist", "--enable-gpu"] });
const page = await browser.newPage({
  viewport: { width: Number(args.width), height: Number(args.height) },
  deviceScaleFactor: Number(args.dsf),
});
await page.goto(`${args.url}/?${query.join("&")}`, { waitUntil: "load" });
const status = await page
  .waitForFunction(
    () => ["active", "failed"].includes(window.__BSR_HERO__?.realtime) && window.__BSR_HERO__.realtime,
    null,
    { timeout: 90_000 },
  )
  .then((h) => h.jsonValue())
  .catch(() => "timeout");
const gpu = await page.evaluate(() => {
  const gl = document.createElement("canvas").getContext("webgl2");
  const ext = gl?.getExtension("WEBGL_debug_renderer_info");
  return ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : "unknown";
});
console.log(`GPU: ${gpu}  class: ${await page.evaluate(() => window.__BSR_HERO__?.gpu)}  tier: ${await page.evaluate(() => window.__BSR_HERO__?.tier)}`);
console.log(`viewport ${args.width}x${args.height} @${args.dsf}  requested tier: ${args.tier}  realtime: ${status}`);
if (status !== "active") {
  const info = await page.evaluate(() => ({
    path: window.__BSR_HERO__?.path,
    tier: window.__BSR_HERO__?.tier,
    failure: window.__BSR_HERO__?.failure,
  }));
  console.log("real-time layer not active:", JSON.stringify(info));
  await browser.close();
  process.exit(1);
}

const rows = [];
for (const [name, progress] of CHECKPOINTS) {
  if (only && !only.includes(name.toLowerCase())) continue;
  await page.evaluate((p) => {
    const section = document.querySelector("[data-hero]");
    const range = section.offsetHeight - window.innerHeight;
    window.scrollTo({ top: section.offsetTop + p * range, behavior: "instant" });
  }, progress);
  await page.waitForFunction((p) => Math.abs(window.__BSR_HERO__.progress.displayed - p) < 0.002, progress, {
    timeout: 30_000,
  });
  await page.evaluate(() => {
    const runtime = window.__BSR_HERO__.runtime;
    runtime.snapToProgress();
    if (!runtime.frozen) runtime.toggleFrozen();
  });
  if (args.dpr) await page.evaluate((d) => window.__BSR_HERO__.runtime.bindings.renderer.setPixelRatio(d), Number(args.dpr));
  await page.waitForTimeout(1200); // environment regeneration, first-visit uploads

  const result = await page.evaluate(
    async ({ seconds, attribute }) => {
      const hero = window.__BSR_HERO__;
      const runtime = hero.runtime;
      const renderer = runtime.bindings?.renderer;
      if (!renderer || hero.realtime !== "active") return { failed: hero.failure ?? hero.realtime };
      const info = renderer.info;
      info.autoReset = false;
      info.reset();
      const intervals = [];
      const calls = [];
      let last = null;
      await new Promise((resolve) => {
        const end = performance.now() + seconds * 1000;
        const frame = (now) => {
          if (last !== null) {
            intervals.push(now - last);
            calls.push(info.render.calls);
          }
          info.reset();
          last = now;
          runtime.markDirty();
          if (now < end) requestAnimationFrame(frame);
          else resolve();
        };
        requestAnimationFrame(frame);
      });
      // Frames where nothing rendered (driver's 60 fps cap) carry 0 calls: ignore them.
      const drawn = calls.filter((c) => c > 0);
      let byObject = null;
      if (attribute) {
        const counts = new Map();
        const original = renderer.renderBufferDirect;
        const originalRender = renderer.render;
        let frames = 0;
        let depth = 0;
        // Group by the world branch: the first three names below HeroWorld.
        const label = (object) => {
          const chain = [];
          for (let o = object; o && o.name !== "HeroWorld"; o = o.parent) chain.unshift(o.name || `(${o.type})`);
          return chain.slice(0, 3).join("/");
        };
        renderer.render = function (...a) {
          if (depth === 0) frames++;
          depth++;
          try {
            return originalRender.apply(this, a);
          } finally {
            depth--;
          }
        };
        renderer.renderBufferDirect = function (camera, scene, geometry, material, object, group) {
          const pass = depth > 1 ? "reflect" : renderer.getRenderTarget() === null ? "main" : "rt";
          const key = `${pass} ${label(object)}`;
          counts.set(key, (counts.get(key) ?? 0) + 1);
          return original.call(this, camera, scene, geometry, material, object, group);
        };
        for (let i = 0; i < 6; i++) {
          runtime.markDirty();
          await new Promise((r) => requestAnimationFrame(r));
        }
        renderer.renderBufferDirect = original;
        renderer.render = originalRender;
        byObject = [...counts.entries()]
          .map(([key, count]) => [key, +(count / Math.max(1, frames)).toFixed(1)])
          .sort((a, b) => b[1] - a[1])
          .slice(0, 400);
      }
      info.autoReset = true;
      const sorted = [...intervals].sort((a, b) => a - b);
      const avg = intervals.reduce((a, b) => a + b, 0) / Math.max(1, intervals.length);
      return {
        avgMs: avg,
        p90Ms: sorted[Math.floor(sorted.length * 0.9)] ?? 0,
        fps: 1000 / avg,
        avgCalls: drawn.reduce((a, b) => a + b, 0) / Math.max(1, drawn.length),
        maxCalls: Math.max(0, ...drawn),
        geometries: info.memory.geometries,
        textures: info.memory.textures,
        programs: info.programs?.length ?? 0,
        tier: runtime.settings.tier,
        level: runtime.settings.level,
        settingsDpr: runtime.settings.dpr,
        pixelRatio: renderer.getPixelRatio(),
        buffer: `${renderer.domElement.width}x${renderer.domElement.height}`,
        byObject,
      };
    },
    { seconds: Number(args.seconds), attribute: args.attribute },
  );
  await page.evaluate(() => {
    const runtime = window.__BSR_HERO__.runtime;
    if (runtime?.frozen) runtime.toggleFrozen();
  });
  if (result.failed) {
    console.log(`${name}: real-time layer ${result.failed}`);
    break;
  }
  rows.push({
    scene: name,
    p: progress,
    "avg ms": +result.avgMs.toFixed(1),
    "p90 ms": +result.p90Ms.toFixed(1),
    fps: +result.fps.toFixed(1),
    "calls avg": Math.round(result.avgCalls),
    "calls max": result.maxCalls,
    geo: result.geometries,
    tex: result.textures,
    progs: result.programs,
    level: result.level,
    dpr: result.pixelRatio,
    buffer: result.buffer,
  });
  if (result.byObject) {
    console.log(`\n${name} — draw calls per rendered frame, by world branch (reflect = averaged reflection pass):`);
    for (const [key, count] of result.byObject) console.log(`  ${String(count).padStart(4)}  ${key}`);
  }
}
console.log();
console.table(rows);
await browser.close();
