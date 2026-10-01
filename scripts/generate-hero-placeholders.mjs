/**
 * Generates the hero's DEVELOPMENT PLACEHOLDER stills and clips.
 *
 *   pnpm assets:hero-placeholders
 *
 * These files exist only so the poster / still-ladder / phone-media
 * architecture can be built and tested before approved art exists. Every
 * image and frame is visibly labelled as a placeholder; none is an attempt at
 * final art. Production stills are captured from the approved real-time
 * scene; production clips are offline renders (hero technical spec).
 *
 * Tools: sharp (already installed as a dependency of Next.js) and the ffmpeg
 * binary Playwright installs for browser video (MJPEG in, VP8/WebM out). No new
 * dependencies.
 */
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { homedir } from "node:os";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const require = createRequire(import.meta.url);
const sharp = require(
  require.resolve("sharp", { paths: [path.dirname(require.resolve("next/package.json"))] }),
);

const STILL_DIR = path.join(root, "public/assets/images/fallback/hero");
const CLIP_DIR = path.join(root, "public/assets/video/hero");

const STILLS = [
  { id: "s1", checkpoint: "opening", label: "S1 · OPENING (poster)", sky: ["#0b111b", "#1a2433"] },
  { id: "s2", checkpoint: "hold", label: "S2 · HOLD (full truck)", sky: ["#101a28", "#2b394c"] },
  { id: "s3", checkpoint: "road", label: "S3 · ROAD (sunrise)", sky: ["#3a4656", "#8e98a3"] },
  { id: "s4", checkpoint: "route", label: "S4 · ROUTE (handoff)", sky: ["#090b0b", "#121615"] },
];

const escape = (text) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;");

function stillSvg({ width, height, label, sky, crop, routeLine }) {
  const portrait = crop === "compact";
  // Safe zones mirror the hero's composition rules (see debug overlay).
  const truck = portrait
    ? { x: 0.08 * width, y: 0.1 * height, w: 0.84 * width, h: 0.42 * height }
    : { x: 0.46 * width, y: 0.24 * height, w: 0.48 * width, h: 0.52 * height };
  const text = portrait
    ? { x: 0.06 * width, y: 0.6 * height }
    : { x: 0.06 * width, y: 0.18 * height };
  const size = Math.round(width / (portrait ? 22 : 48));
  const route = routeLine
    ? `<line x1="${0.58 * width}" y1="${height}" x2="${0.62 * width}" y2="${0.45 * height}" stroke="#1a9a63" stroke-width="${Math.max(3, width / 640)}"/>`
    : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
  <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="${sky[0]}"/><stop offset="1" stop-color="${sky[1]}"/></linearGradient>
    <pattern id="grid" width="${size * 4}" height="${size * 4}" patternUnits="userSpaceOnUse">
      <path d="M ${size * 4} 0 L 0 0 0 ${size * 4}" fill="none" stroke="#ffffff" stroke-opacity="0.05"/></pattern></defs>
  <rect width="100%" height="100%" fill="url(#g)"/>
  <rect width="100%" height="100%" fill="url(#grid)"/>
  ${route}
  <rect x="${truck.x}" y="${truck.y}" width="${truck.w}" height="${truck.h}" fill="none" stroke="#ff2bd6" stroke-width="${Math.max(2, width / 900)}" stroke-dasharray="${size} ${size / 2}"/>
  <text x="${truck.x + size}" y="${truck.y + size * 1.6}" fill="#ff2bd6" font-family="monospace" font-size="${size}">TRUCK ZONE</text>
  <g font-family="monospace" fill="#f7f7f2" fill-opacity="0.55">
    <text x="${text.x}" y="${text.y}" font-size="${size * 1.1}">DEVELOPMENT PLACEHOLDER — NOT FINAL ART</text>
    <text x="${text.x}" y="${text.y + size * 1.8}" font-size="${size}">${escape(label)} · ${crop.toUpperCase()} ${width}×${height}</text>
    <text x="${text.x}" y="${text.y + size * 3.4}" font-size="${size * 0.8}">Replace with the approved still captured from the real-time scene.</text>
  </g>
</svg>`;
}

async function generateStills() {
  mkdirSync(STILL_DIR, { recursive: true });
  for (const still of STILLS) {
    for (const [crop, width, height] of [
      ["wide", 2560, 1440],
      ["compact", 1080, 1920],
    ]) {
      const svg = stillSvg({
        width,
        height,
        crop,
        label: still.label,
        sky: still.sky,
        routeLine: still.id === "s4",
      });
      const file = path.join(STILL_DIR, `hero-${still.id}-${still.checkpoint}-${crop}.dev.png`);
      await sharp(Buffer.from(svg)).png({ compressionLevel: 9, palette: true }).toFile(file);
      console.log("still", path.relative(root, file));
    }
  }
}

function findFfmpeg() {
  if (process.env.PLAYWRIGHT_FFMPEG && existsSync(process.env.PLAYWRIGHT_FFMPEG))
    return process.env.PLAYWRIGHT_FFMPEG;
  const caches = [
    process.env.PLAYWRIGHT_BROWSERS_PATH,
    process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, "ms-playwright"),
    path.join(homedir(), ".cache/ms-playwright"),
    path.join(homedir(), "Library/Caches/ms-playwright"),
  ].filter(Boolean);
  for (const cache of caches) {
    if (!existsSync(cache)) continue;
    for (const dir of readdirSync(cache).filter((name) => name.startsWith("ffmpeg"))) {
      for (const binary of ["ffmpeg-win64.exe", "ffmpeg-linux", "ffmpeg-mac"]) {
        const candidate = path.join(cache, dir, binary);
        if (existsSync(candidate)) return candidate;
      }
    }
  }
  return null;
}

async function generateClip(ffmpeg, id, seconds) {
  const fps = 12;
  const width = 720;
  const height = 1280;
  const frames = seconds * fps;
  const file = path.join(CLIP_DIR, `hero-clip-${id}.dev.webm`);
  const encoder = spawn(
    ffmpeg,
    [
      "-y",
      "-f",
      "image2pipe",
      "-c:v",
      "mjpeg",
      "-framerate",
      String(fps),
      "-i",
      "pipe:0",
      "-c:v",
      "libvpx",
      "-b:v",
      "350k",
      "-auto-alt-ref",
      "0",
      "-pix_fmt",
      "yuv420p",
      file,
    ],
    { stdio: ["pipe", "ignore", "inherit"] },
  );
  const done = new Promise((resolve, reject) => {
    encoder.on("error", reject);
    encoder.on("close", (code) =>
      code === 0 ? resolve() : reject(new Error(`ffmpeg exited ${code}`)),
    );
  });
  for (let frame = 0; frame < frames; frame++) {
    const t = frame / (frames - 1);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
      <rect width="100%" height="100%" fill="${id === "a" ? "#101a28" : "#3a4656"}"/>
      <rect x="40" y="${height * 0.12}" width="${(width - 80) * t}" height="12" fill="#ff2bd6"/>
      <g font-family="monospace" fill="#f7f7f2" fill-opacity="0.6" font-size="30">
        <text x="40" y="${height * 0.2}">DEV PLACEHOLDER CLIP ${id.toUpperCase()}</text>
        <text x="40" y="${height * 0.2 + 44}">frame ${frame + 1}/${frames} · not final art</text>
      </g></svg>`;
    encoder.stdin.write(await sharp(Buffer.from(svg)).jpeg({ quality: 85 }).toBuffer());
  }
  encoder.stdin.end();
  await done;
  console.log("clip ", path.relative(root, file));
}

await generateStills();
const ffmpeg = findFfmpeg();
if (!ffmpeg) {
  console.warn(
    "Playwright ffmpeg not found (run `pnpm exec playwright install chromium`): clips skipped.",
  );
} else {
  mkdirSync(CLIP_DIR, { recursive: true });
  await generateClip(ffmpeg, "a", 3);
  await generateClip(ffmpeg, "b", 4);
}
