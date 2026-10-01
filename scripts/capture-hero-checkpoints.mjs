/**
 * Captures the real-time hero at the four styleframe checkpoints and composes
 * each capture against its approved styleframe (hero Phase 2B overlay workflow).
 *
 *   node scripts/capture-hero-checkpoints.mjs [--url http://localhost:3100]
 *     [--tier high|medium|low] [--width 1600] [--height 900] [--out <dir>]
 *     [--only 01-opening,02-reveal]
 *
 * Needs a running test build (NEXT_PUBLIC_BSR_HERO_TEST_HOOKS=true), e.g. the
 * Playwright web server. For every checkpoint it navigates, snaps the story
 * deterministically, freezes the simulation (pointer input is not wired) at a
 * fixed tier and DPR 1, then writes:
 *
 *   <name>.png          clean plate (copy, scrim and header hidden)
 *   <name>-copy.png     with the HTML copy (safe-zone check)
 *   <name>-overlay.jpg  clean plate over the styleframe at 50 %
 *   <name>-side.jpg     styleframe | clean plate (composites are JPEG: review-size files)
 *
 * Captures from software WebGL are for composition review only — never for
 * visual or performance approval. Tools: Playwright and sharp (via Next.js).
 */
import { mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { parseArgs } from "node:util";

import { chromium } from "@playwright/test";

const root = path.resolve(import.meta.dirname, "..");
const require = createRequire(import.meta.url);
const sharp = require(
  require.resolve("sharp", { paths: [path.dirname(require.resolve("next/package.json"))] }),
);

const { values: args } = parseArgs({
  options: {
    url: { type: "string", default: "http://localhost:3100" },
    tier: { type: "string", default: "high" },
    width: { type: "string", default: "1600" },
    height: { type: "string", default: "900" },
    out: { type: "string", default: path.join(root, "docs/styleframes/hero/captures") },
    only: { type: "string" },
  },
});

const width = Number(args.width);
const height = Number(args.height);
const STYLEFRAME_DIR = path.join(root, "docs/styleframes/hero");

/** Mirrors HERO_CHECKPOINTS (src/experiences/home/config/hero-states.ts). */
const CHECKPOINTS = [
  { name: "01-opening", progress: 0.04, styleframe: "01-opening-blue-hour.png" },
  { name: "02-reveal", progress: 0.39, styleframe: "02-full-truck-reveal.png" },
  { name: "03-road", progress: 0.77, styleframe: "03-road-sunrise-movement.png" },
  { name: "04-route", progress: 0.97, styleframe: "04-road-to-route-handoff.png" },
  // Cinematic beats without a styleframe (clean plate only; request with --only).
  { name: "05-reach", progress: 0.885, styleframe: null, optional: true },
  { name: "06-italy", progress: 0.99, styleframe: null, optional: true },
  // Gate B journey chapters (roadOffset: road flow position held for the frame).
  { name: "07-industrial", progress: 0.665, styleframe: null, optional: true },
  { name: "08-service", progress: 0.705, styleframe: null, optional: true },
  { name: "09-open-road", progress: 0.77, styleframe: null, optional: true },
  { name: "10-road-to-reach", progress: 0.8, styleframe: null, optional: true },
  // Full cinematic pass primary review frames (docs/styleframes/hero/cinematic-final/).
  { name: "cf-01-preparation", progress: 0.04, styleframe: null, optional: true },
  { name: "cf-02-loading", progress: 0.49, styleframe: null, optional: true },
  { name: "cf-03-ready", progress: 0.39, styleframe: null, optional: true },
  { name: "cf-04-departure", progress: 0.53, styleframe: null, optional: true },
];

const HIDE_COPY = `
  [data-hero] > div:first-child, [data-hero] > p, [data-hero] [class*="scrim"],
  body > header, [data-site-header] { visibility: hidden !important; }
`;

mkdirSync(args.out, { recursive: true });

/**
 * Opens the hero with the real-time layer active. Software WebGL readiness is
 * timing-dependent (not a hardware signal), so each attempt uses a fresh browser.
 */
async function openRealtime(attempts = 3) {
  for (let attempt = 1; ; attempt++) {
    const browser = await chromium.launch({ args: ["--enable-unsafe-swiftshader"] });
    const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
    await page.goto(`${args.url}/?hero-path=realtime&hero-allow-software&hero-tier=${args.tier}`);
    const status = await page
      .waitForFunction(
        () =>
          ["active", "failed"].includes(window.__BSR_HERO__?.realtime) &&
          window.__BSR_HERO__.realtime,
        null,
        { timeout: 90_000 },
      )
      .then((handle) => handle.jsonValue())
      .catch(() => "timeout");
    if (status === "active") return { browser, page };
    await browser.close();
    if (attempt >= attempts)
      throw new Error(`real-time layer not active after ${attempts} attempts (${status})`);
  }
}

const only = args.only?.split(",");
for (const checkpoint of CHECKPOINTS.filter((c) => (only ? only.includes(c.name) : !c.optional))) {
  const { browser, page } = await openRealtime();
  await page.evaluate((p) => {
    const section = document.querySelector("[data-hero]");
    const range = section.offsetHeight - window.innerHeight;
    window.scrollTo({ top: section.offsetTop + p * range, behavior: "instant" });
  }, checkpoint.progress);
  await page.waitForFunction(
    (p) => Math.abs(window.__BSR_HERO__.progress.displayed - p) < 0.002,
    checkpoint.progress,
  );
  await page.evaluate((roadOffset) => {
    const runtime = window.__BSR_HERO__.runtime;
    runtime.snapToProgress();
    if (!runtime.frozen) runtime.toggleFrozen();
    // Hold the road flow at a chosen position (composition review of the journey).
    if (roadOffset !== undefined) runtime.roadOffset = roadOffset;
  }, checkpoint.roadOffset);
  await page.waitForTimeout(1500);

  const base = path.join(args.out, checkpoint.name);
  await page.screenshot({ path: `${base}-copy.png` });
  await page.addStyleTag({ content: HIDE_COPY });
  await page.waitForTimeout(200);
  const clean = await page.screenshot({ path: `${base}.png` });
  await browser.close();
  if (!checkpoint.styleframe) {
    console.log(`captured ${checkpoint.name}`);
    continue;
  }

  const styleframe = await sharp(path.join(STYLEFRAME_DIR, checkpoint.styleframe))
    .resize(width, height, { fit: "cover" })
    .png()
    .toBuffer();
  const faded = await sharp(clean)
    .ensureAlpha()
    .composite([
      {
        input: {
          create: { width, height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0.5 } },
        },
        blend: "dest-in",
      },
    ])
    .png()
    .toBuffer();
  await sharp(styleframe)
    .composite([{ input: faded }])
    .jpeg({ quality: 82 })
    .toFile(`${base}-overlay.jpg`);
  await sharp({ create: { width: width * 2, height, channels: 3, background: "#000" } })
    .composite([
      { input: styleframe, left: 0, top: 0 },
      { input: clean, left: width, top: 0 },
    ])
    .jpeg({ quality: 82 })
    .toFile(`${base}-side.jpg`);
  console.log(`captured ${checkpoint.name}`);
}
