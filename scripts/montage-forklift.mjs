import { createRequire } from "node:module";
import path from "node:path";
const require = createRequire(import.meta.url);
const sharp = require(require.resolve("sharp", { paths: [path.dirname(require.resolve("next/package.json"))] }));
const dir = path.resolve(import.meta.dirname, "../docs/styleframes/hero/photoreal-reconstruction/crops");
const names = ["a-approach", "b-threshold", "c-staging", "d-reverse"];
const bufs = await Promise.all(names.map((x) => sharp(path.join(dir, `forklift-${x}.png`)).extract({ left: 150, top: 350, width: 700, height: 500 }).resize(512, 366).png().toBuffer()));
await sharp({ create: { width: 1024, height: 732, channels: 3, background: "#000" } })
  .composite(bufs.map((b, i) => ({ input: b, left: (i % 2) * 512, top: Math.floor(i / 2) * 366 })))
  .png().toFile(path.join(dir, "forklift-states.png"));
