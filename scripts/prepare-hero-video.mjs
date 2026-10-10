/**
 * Prepares the scroll-scrubbed hero video from the generated source footage.
 *
 *   pnpm assets:hero-video
 *   node scripts/prepare-hero-video.mjs [--source public/assets/video/bsr-hero-source.mp4]
 *
 * Requirements: ffmpeg and ffprobe on the PATH, ffmpeg built with libx264
 * (macOS: `brew install ffmpeg`).
 *
 * The source is never modified. Outputs:
 *   public/assets/video/bsr-hero.mp4       full size (≤ 1080 p, never upscaled)
 *   public/assets/video/bsr-hero-720.mp4   720 p — phones and slow connections
 *   public/assets/images/hero/bsr-hero-poster.jpg   the encoded video's first frame
 *   src/experiences/home/config/hero-video-media.ts  measured facts (generated)
 *
 * Encoding (both files): H.264 High, yuv420p, BT.709 tagged, no audio, faststart,
 * a closed GOP of 12 frames (0.5 s at 24 fps) and no scene-cut keyframes. Scrubbing
 * seeks to arbitrary frames, often backwards: a seek decodes from the previous
 * keyframe, so the GOP bounds the work per seek (≤ 11 frames). Measured on the
 * 15 s source (Chromium, M3 Pro): the source's 7.5 s GOP took 158 ms (p50) per
 * reverse seek; a 12-frame GOP presents within one display frame at ~8 MB (1080 p),
 * where all-intra adds nothing measurable and doubles the size (17 MB).
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";

const root = path.resolve(import.meta.dirname, "..");
const { values: args } = parseArgs({
  options: { source: { type: "string", default: "public/assets/video/bsr-hero-source.mp4" } },
});
const source = path.resolve(root, args.source);
const VIDEO_DIR = path.join(root, "public/assets/video");
const POSTER = path.join(root, "public/assets/images/hero/bsr-hero-poster.jpg");
const MANIFEST = path.join(root, "src/experiences/home/config/hero-video-media.ts");
const GOP = 12;

if (!existsSync(source)) {
  console.error(`Source video not found: ${path.relative(root, source)}
Put the generated footage there (MP4/MOV, any codec ffmpeg reads) and run this again.`);
  process.exit(1);
}

const probe = (file) =>
  JSON.parse(
    execFileSync("ffprobe", [
      "-v",
      "error",
      "-select_streams",
      "v:0",
      "-show_entries",
      "stream=codec_name,width,height,r_frame_rate,nb_frames,pix_fmt:format=duration,size",
      "-of",
      "json",
      file,
    ]).toString(),
  );

const info = probe(source);
const stream = info.streams[0];
const [num, den] = stream.r_frame_rate.split("/").map(Number);
const fps = num / den;
console.log(
  `source  ${path.relative(root, source)}: ${stream.width}×${stream.height}, ${fps} fps, ` +
    `${Number(info.format.duration).toFixed(3)} s, ${stream.codec_name} ${stream.pix_fmt}, ` +
    `${(info.format.size / 1048576).toFixed(1)} MB`,
);

function encode(out, height, crf) {
  // Never upscale: a smaller source keeps its own height.
  const h = Math.min(height, stream.height);
  execFileSync(
    "ffmpeg",
    [
      "-v",
      "error",
      "-y",
      "-i",
      source,
      "-an",
      "-sn",
      "-dn",
      "-map_metadata",
      "-1",
      "-vf",
      `scale=-2:${h}:flags=lanczos,format=yuv420p`,
      "-c:v",
      "libx264",
      "-preset",
      "slow",
      "-profile:v",
      "high",
      "-crf",
      String(crf),
      "-x264-params",
      `keyint=${GOP}:min-keyint=${GOP}:scenecut=0:bframes=2:open-gop=0:colorprim=bt709:transfer=bt709:colormatrix=bt709`,
      "-color_primaries",
      "bt709",
      "-color_trc",
      "bt709",
      "-colorspace",
      "bt709",
      "-movflags",
      "+faststart",
      out,
    ],
    { stdio: "inherit" },
  );
  const result = probe(out);
  const s = result.streams[0];
  console.log(
    `encoded ${path.relative(root, out)}: ${s.width}×${s.height}, ${s.nb_frames} frames, ` +
      `${(result.format.size / 1048576).toFixed(2)} MB`,
  );
  return {
    width: s.width,
    height: s.height,
    bytes: Number(result.format.size),
    frames: Number(s.nb_frames),
  };
}

mkdirSync(VIDEO_DIR, { recursive: true });
const full = encode(path.join(VIDEO_DIR, "bsr-hero.mp4"), 1080, 23);
const compact = encode(path.join(VIDEO_DIR, "bsr-hero-720.mp4"), 720, 24);
const encoded = probe(path.join(VIDEO_DIR, "bsr-hero.mp4"));

// The poster is the encoded file's own first frame, so the handoff to video never shifts
// colour or framing.
mkdirSync(path.dirname(POSTER), { recursive: true });
execFileSync("ffmpeg", [
  "-v",
  "error",
  "-y",
  "-i",
  path.join(VIDEO_DIR, "bsr-hero.mp4"),
  "-frames:v",
  "1",
  "-q:v",
  "2",
  POSTER,
]);
console.log(
  `poster  ${path.relative(root, POSTER)} (${(statSync(POSTER).size / 1024).toFixed(0)} KB)`,
);

const media = {
  duration: Number(Number(encoded.format.duration).toFixed(4)),
  fps,
  frames: full.frames,
  width: full.width,
  height: full.height,
  files: {
    full: { width: full.width, height: full.height, bytes: full.bytes },
    compact: { width: compact.width, height: compact.height, bytes: compact.bytes },
  },
};
writeFileSync(
  MANIFEST,
  `/** GENERATED by scripts/prepare-hero-video.mjs (pnpm assets:hero-video) — do not edit. */\n` +
    `export const HERO_VIDEO_MEDIA = ${JSON.stringify(media, null, 2)} as const;\n`,
);
console.log(`facts   ${path.relative(root, MANIFEST)}`);
