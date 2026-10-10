
import { mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const require = createRequire(import.meta.url);
const sharp = require(
  require.resolve("sharp", { paths: [path.dirname(require.resolve("next/package.json"))] }),
);
const ref = (f) => path.join(root, "docs/styleframes/hero/reference", f);
const raw = path.join(root, "docs/styleframes/hero/photoreal-reconstruction/raw");
const out = path.join(root, "docs/styleframes/hero/photoreal-reconstruction");

const SCENES = [
  ["01-preparation", "cf-01-preparation", "04-loading-dock-blue-hour-reference.png"],
  ["02-loading", "cf-02-loading", "05-warehouse-loading-operation-reference.png"],
  ["03-ready", "cf-03-ready", "06-truck-ready-reveal-reference.png"],
  ["04-departure", "cf-04-departure", "07-yard-departure-reference.png"],
  ["05-industrial", "07-industrial", "01-industrial-outskirts-reference.png"],
  ["06-service", "08-service", "02-service-corridor-reference.png"],
  ["07-open-road", "09-open-road", "03-open-road-reference.png"],
  ["08-reach", "05-reach", "08-road-to-italy-transition-reference.png"],
];
const W = 1600;
const H = 900;
mkdirSync(out, { recursive: true });
const edges = (buf) =>
  sharp(buf)
    .greyscale()
    .convolve({ width: 3, height: 3, kernel: [-1, -1, -1, -1, 8, -1, -1, -1, -1] })
    .normalise()
    .png()
    .toBuffer();

for (const [name, captured, reference] of SCENES) {
  const beauty = await sharp(path.join(raw, `${captured}.png`)).resize(W, H).png().toBuffer();
  await sharp(beauty).toFile(path.join(out, `${name}.png`));
  const refBuf = await sharp(ref(reference)).resize(W, H, { fit: "cover" }).png().toBuffer();
  const half = await sharp(beauty)
    .ensureAlpha(0.5)
    .png()
    .toBuffer();
  await sharp(refBuf).composite([{ input: half }]).jpeg({ quality: 82 }).toFile(path.join(out, `${name}-overlay.jpg`));
  const grey = (b) => sharp(b).greyscale().png().toBuffer();
  await sharp({ create: { width: W * 2, height: H, channels: 3, background: "#000" } })
    .composite([
      { input: await grey(beauty), left: 0, top: 0 },
      { input: await grey(refBuf), left: W, top: 0 },
    ])
    .jpeg({ quality: 82 })
    .toFile(path.join(out, `${name}-luma.jpg`));
  await sharp({ create: { width: W * 2, height: H, channels: 3, background: "#000" } })
    .composite([
      { input: await edges(beauty), left: 0, top: 0 },
      { input: await edges(refBuf), left: W, top: 0 },
    ])
    .jpeg({ quality: 82 })
    .toFile(path.join(out, `${name}-edges.jpg`));
  // 512 anti-CG crops: ground (lower-left quadrant) and horizon band.
  await sharp(beauty).extract({ left: 100, top: 380, width: 512, height: 512 }).toFile(path.join(out, `${name}-crop-ground.png`));
  await sharp(beauty).extract({ left: 40, top: 250, width: 512, height: 512 }).toFile(path.join(out, `${name}-crop-horizon.png`));
  console.log("built", name);
}
