/**
 * Final web encoding of the Blender exports (tools/blender/export_web.py for the
 * vehicle, build_roadkit.py for the road kit): PNG textures -> KTX2 (mipmaps,
 * KHR_texture_basisu) — base-colour maps as ETC1S sRGB (compact, alpha-capable),
 * normal and ORM maps as UASTC + Zstandard — then geometry -> Meshopt
 * (gltf-transform, run with `pnpm dlx`; not a repo dependency — see
 * docs/hero-asset-pipeline.md §7).
 *
 *   node tools/encode-vehicle-web.mjs <in.glb> <out.glb> [--scale 0.5]
 *
 * --scale resizes every texture first (lower tiers).
 *
 * The Basis Universal encoder (basis_encoder.js/.wasm from BinomialLLC/basis_universal
 * v1_50_0, webgl/encoder/build) lives outside the repo; BASIS_ENCODER_DIR points at it
 * (default C:/Users/Hp/Tools/basis-encoder).
 */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const [input, output, flag, scaleArg] = process.argv.slice(2);
const scale = flag === "--scale" ? Number(scaleArg) : 1;
const sharp = createRequire(import.meta.url)(
  createRequire(import.meta.url).resolve("sharp", {
    paths: [path.dirname(createRequire(import.meta.url).resolve("next/package.json"))],
  }),
);
if (!input || !output) {
  console.error("usage: node tools/encode-vehicle-web.mjs <in.glb> <out.glb>");
  process.exit(2);
}
// Encoded textures are cached by source hash (UASTC RDO in wasm is slow).
const cacheDir = path.resolve(import.meta.dirname, "../assets/work/truck/export/ktx2-cache");
mkdirSync(cacheDir, { recursive: true });
const encoderDir = process.env.BASIS_ENCODER_DIR ?? "C:/Users/Hp/Tools/basis-encoder";
const BASIS = createRequire(import.meta.url)(path.join(encoderDir, "basis_encoder.js"));
const basis = await BASIS();
basis.initializeBasis();

// ---------------------------------------------------------------- GLB parse
const glb = readFileSync(input);
const jsonLength = glb.readUInt32LE(12);
const json = JSON.parse(glb.subarray(20, 20 + jsonLength).toString("utf8"));
const binStart = 20 + jsonLength + 8;
const bin = glb.subarray(binStart, binStart + glb.readUInt32LE(20 + jsonLength));
const views = json.bufferViews.map((v) => bin.subarray(v.byteOffset ?? 0, (v.byteOffset ?? 0) + v.byteLength));

// Base-colour maps (sRGB) → ETC1S; normal maps (no perceptual metrics) and data maps → UASTC.
const colourImages = new Set(
  (json.materials ?? [])
    .map((m) => m.pbrMetallicRoughness?.baseColorTexture?.index)
    .filter((i) => i !== undefined)
    .map((i) => json.textures[i].source),
);
const normalImages = new Set(
  (json.materials ?? [])
    .map((m) => m.normalTexture?.index)
    .filter((i) => i !== undefined)
    .map((i) => json.textures[i].source),
);

for (const [index, image] of (json.images ?? []).entries()) {
  if (image.mimeType !== "image/png") throw new Error(`image ${index}: ${image.mimeType} not handled`);
  let png = views[image.bufferView];
  const meta = await sharp(png).metadata();
  if (scale !== 1) {
    png = await sharp(png)
      .resize(Math.max(4, Math.round(meta.width * scale)), Math.max(4, Math.round(meta.height * scale)))
      .png()
      .toBuffer();
  }
  const normal = normalImages.has(index);
  const colour = colourImages.has(index);
  // This wasm Basis encoder build produces a corrupt mip chain (level 0 only
  // transcodes; every level above fails) for non-square images — verified by
  // transcoding each level with the same basis_transcoder the browser uses.
  // Square images (our atlases, the aerial tile) are unaffected; skip mip
  // generation for the rest rather than ship a texture that only renders at
  // its base level (flat/blank once any minification picks a higher level).
  const square = meta.width === meta.height;
  const mode = (normal ? "n" : colour ? "e" : "c") + (square ? "" : "1");
  const cached = path.join(cacheDir, createHash("sha256").update(png).update(mode).digest("hex").slice(0, 24) + ".ktx2");
  if (existsSync(cached)) {
    views[image.bufferView] = readFileSync(cached);
    image.mimeType = "image/ktx2";
    console.log(`  ${image.name}: cached KTX2`);
    continue;
  }
  const encoder = new basis.BasisEncoder();
  encoder.setCreateKTX2File(true);
  encoder.setSliceSourceImage(0, new Uint8Array(png), 0, 0, true);
  encoder.setMipGen(square);
  if (colour) {
    encoder.setUASTC(false); // ETC1S (BasisLZ)
    encoder.setQualityLevel(210);
    encoder.setCompressionLevel(2);
    encoder.setKTX2SRGBTransferFunc(true);
    encoder.setMipSRGB(true);
    encoder.setPerceptual(true);
  } else {
    encoder.setKTX2UASTCSupercompression(true);
    encoder.setKTX2SRGBTransferFunc(false);
    encoder.setUASTC(true);
    encoder.setPackUASTCFlags(2); // UASTC level 2 (default quality)
    encoder.setRDOUASTC(true);
    encoder.setRDOUASTCQualityScalar(normal ? 0.5 : 1.0);
    encoder.setMipSRGB(false);
    encoder.setPerceptual(false);
    if (normal) encoder.setNormalMap();
  }
  const out = new Uint8Array(64 * 1024 * 1024);
  const size = encoder.encode(out);
  encoder.delete();
  if (!size) throw new Error(`image ${index} (${image.name}): KTX2 encoding failed`);
  views[image.bufferView] = Buffer.from(out.subarray(0, size));
  writeFileSync(cached, views[image.bufferView]);
  image.mimeType = "image/ktx2";
  console.log(`  ${image.name}: PNG ${kb(png.length)} -> KTX2 ${kb(size)} (${colour ? "ETC1S sRGB" : normal ? "UASTC normal" : "UASTC"})`);
}
for (const texture of json.textures ?? []) {
  texture.extensions = { ...texture.extensions, KHR_texture_basisu: { source: texture.source } };
  delete texture.source;
}
if (json.textures?.length) {
  for (const key of ["extensionsUsed", "extensionsRequired"]) {
    json[key] = [...new Set([...(json[key] ?? []), "KHR_texture_basisu"])];
  }
}

// ---------------------------------------------------------------- GLB write (4-byte aligned views)
let offset = 0;
const chunks = [];
for (const [i, view] of views.entries()) {
  const pad = (4 - (offset % 4)) % 4;
  if (pad) chunks.push(Buffer.alloc(pad));
  offset += pad;
  json.bufferViews[i].byteOffset = offset;
  json.bufferViews[i].byteLength = view.length;
  chunks.push(view);
  offset += view.length;
}
const binOut = Buffer.concat([...chunks, Buffer.alloc((4 - (offset % 4)) % 4)]);
json.buffers[0].byteLength = binOut.length;
let jsonOut = Buffer.from(JSON.stringify(json), "utf8");
jsonOut = Buffer.concat([jsonOut, Buffer.alloc((4 - (jsonOut.length % 4)) % 4, 0x20)]);
const header = Buffer.alloc(12);
header.write("glTF", 0);
header.writeUInt32LE(2, 4);
header.writeUInt32LE(12 + 8 + jsonOut.length + 8 + binOut.length, 8);
const chunkHeader = (length, type) => {
  const h = Buffer.alloc(8);
  h.writeUInt32LE(length, 0);
  h.write(type, 4);
  return h;
};
const intermediate = input.replace(/\.glb$/, ".ktx2.glb");
writeFileSync(
  intermediate,
  Buffer.concat([header, chunkHeader(jsonOut.length, "JSON"), jsonOut, chunkHeader(binOut.length, "BIN\0"), binOut]),
);

// ---------------------------------------------------------------- Meshopt (reorder + quantize + compress)
execFileSync(
  "pnpm",
  ["dlx", "@gltf-transform/cli@4", "meshopt", intermediate, output, "--level", "medium", "--quantize-texcoord", "14"],
  { stdio: ["ignore", "ignore", "inherit"], shell: true },
);
console.log(`${path.basename(output)}: ${kb(glb.length)} -> ${kb(readFileSync(output).length)}`);

function kb(bytes) {
  return `${(bytes / 1024).toFixed(0)} KB`;
}
