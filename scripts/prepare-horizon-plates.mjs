/**
 * Prepares the journey's horizon plates from the approved photographic references
 * (docs/styleframes/hero/reference/01-03) into vehicle-free, brand-free SKY plates:
 *
 *   node scripts/prepare-horizon-plates.mjs
 *
 * The references carry lorries, cars, a fuel-canopy in real fuel-company colours and baked
 * lamp columns. Production plates may contain none of that (only the controlled realtime
 * BSR truck, realtime lamps and Blender scenery). So per plate:
 *   1. thin baked structures above the cut (lamp columns / arms / heads) are removed with a
 *      large median (anything narrower than the kernel is replaced by its surroundings);
 *   2. everything below the cut row (the ground-level content: buildings, yards, vehicles,
 *      canopy) is replaced by a smooth horizon haze sampled from the plate's own horizon
 *      colour, so the sky, sun, clouds and the natural silhouettes above the cut stay
 *      photographic while the realtime ground / cards / haze continue below.
 *
 * Output: assets/work/roadkit/plates/plate_{A,B,C}.png (2048 x 1024 for KTX2 mips).
 */
import { mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const require = createRequire(import.meta.url);
const sharp = require(
  require.resolve("sharp", { paths: [path.dirname(require.resolve("next/package.json"))] }),
);

/** cut = last row (of 941) kept from the photograph; haze rows are synthesised below it. */
const PLATES = [
  { id: "A", file: "01-industrial-outskirts-reference.png", cut: 437 },
  { id: "B", file: "02-service-corridor-reference.png", cut: 468, erase: [[0, 120, 300, 468]] },
  { id: "C", file: "03-open-road-reference.png", cut: 514, erase: [[0, 320, 215, 514]] },
];

const outDir = path.join(root, "assets/work/roadkit/plates");
mkdirSync(outDir, { recursive: true });

for (const { id, file, cut, erase = [] } of PLATES) {
  const src = path.join(root, "docs/styleframes/hero/reference", file);
  const { data, info } = await sharp(src).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info;
  const median = await sharp(src).removeAlpha().median(25).raw().toBuffer();
  const out = Buffer.from(data);
  const lum = (buf, i) => 0.299 * buf[i] + 0.587 * buf[i + 1] + 0.114 * buf[i + 2];

  // 1. Remove thin baked structures above the cut (mask dilated by 3 px).
  const mask = new Uint8Array(w * h);
  for (let y = 0; y < cut; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 3;
      if (Math.abs(lum(data, i) - lum(median, i)) > 11) mask[y * w + x] = 1;
    }
  }
  for (let y = 0; y < cut; y++) {
    for (let x = 0; x < w; x++) {
      let hit = false;
      for (let dy = -3; dy <= 3 && !hit; dy++) {
        for (let dx = -3; dx <= 3; dx++) {
          const yy = y + dy;
          const xx = x + dx;
          if (yy >= 0 && yy < cut && xx >= 0 && xx < w && mask[yy * w + xx]) {
            hit = true;
            break;
          }
        }
      }
      if (hit) {
        // Only structures: keep the soft cloud detail where the median agrees within a wider band.
        const i = (y * w + x) * 3;
        if (Math.abs(lum(data, i) - lum(median, i)) > 5 || mask[y * w + x]) {
          out[i] = median[i];
          out[i + 1] = median[i + 1];
          out[i + 2] = median[i + 2];
        }
      }
    }
  }

  // 1b. Erase large baked silhouettes (trees): carry the sky beside them across, then blur
  // the patch so no per-row streaks remain.
  for (const [x0, y0, x1, y1] of erase) {
    for (let y = y0; y < y1; y++) {
      const ref = (y * w + Math.min(w - 1, x1 + 4)) * 3;
      for (let x = x0; x <= x1; x++) {
        const i = (y * w + x) * 3;
        const t = Math.min(1, (y - y0) / 25);
        for (let c = 0; c < 3; c++) out[i + c] = Math.round(out[i + c] * (1 - t) + out[ref + c] * t);
      }
    }
    const pw = x1 - x0 + 1;
    const ph = y1 - y0;
    const patch = Buffer.alloc(pw * ph * 3);
    for (let y = 0; y < ph; y++) out.copy(patch, y * pw * 3, ((y0 + y) * w + x0) * 3, ((y0 + y) * w + x0 + pw) * 3);
    const blurred = await sharp(patch, { raw: { width: pw, height: ph, channels: 3 } }).blur(38).raw().toBuffer();
    for (let y = 0; y < ph; y++) {
      for (let x = 0; x < pw; x++) {
        const a = Math.min(1, (pw - 1 - x) / 140); // feather into the untouched sky at the right edge
        const t = Math.min(1, y / 30);
        const k = a * a * (3 - 2 * a) * t;
        const i = ((y0 + y) * w + x0 + x) * 3;
        for (let c = 0; c < 3; c++) out[i + c] = Math.round(out[i + c] * (1 - k) + blurred[(y * pw + x) * 3 + c] * k);
      }
    }
  }

  // 2. Below the cut: the horizon row, heavily smoothed across x, fading a touch darker.
  const row = new Float32Array(w * 3);
  const band = 6;
  for (let x = 0; x < w; x++) {
    for (let c = 0; c < 3; c++) {
      let sum = 0;
      for (let y = cut - band; y < cut - 1; y++) sum += out[(y * w + x) * 3 + c];
      row[x * 3 + c] = sum / (band - 1);
    }
  }
  const smooth = new Float32Array(w * 3);
  const radius = 520;
  for (let x = 0; x < w; x++) {
    const lo = Math.max(0, x - radius);
    const hi = Math.min(w - 1, x + radius);
    for (let c = 0; c < 3; c++) {
      let sum = 0;
      for (let xx = lo; xx <= hi; xx++) sum += row[xx * 3 + c];
      smooth[x * 3 + c] = sum / (hi - lo + 1);
    }
  }
  for (let y = cut; y < h; y++) {
    const t = Math.min(1, (y - cut) / 70);
    const k = 1 - 0.14 * t * t;
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 3;
      for (let c = 0; c < 3; c++) out[i + c] = Math.round(smooth[x * 3 + c] * k);
    }
  }
  // Blend the last few real rows into the fill so the cut is not a visible line.
  for (let y = cut - 6; y < cut; y++) {
    const t = (y - (cut - 6)) / 6;
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 3;
      for (let c = 0; c < 3; c++) out[i + c] = Math.round(out[i + c] * (1 - t * t) + smooth[x * 3 + c] * t * t);
    }
  }

  await sharp(out, { raw: { width: w, height: h, channels: 3 } })
    .resize(2048, 1024, { fit: "fill", kernel: "lanczos3" })
    .png()
    .toFile(path.join(outDir, `plate_${id}.png`));
  console.log(`plate_${id}: cut row ${cut}/${h}`);
}
