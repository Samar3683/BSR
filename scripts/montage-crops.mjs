import { createRequire } from "node:module";
import path from "node:path";
const require = createRequire(import.meta.url);
const sharp = require(require.resolve("sharp", { paths: [path.dirname(require.resolve("next/package.json"))] }));
const dir = path.resolve(import.meta.dirname, "../docs/styleframes/hero/photoreal-reconstruction/crops");
const [out, ...names] = process.argv.slice(2);
const bufs = await Promise.all(names.map((n) => sharp(path.join(dir, `${n}.png`)).resize(512, 512).png().toBuffer()));
await sharp({ create: { width: 512 * bufs.length, height: 512, channels: 3, background: "#000" } })
  .composite(bufs.map((b, i) => ({ input: b, left: i * 512, top: 0 }))).png().toFile(path.join(dir, `${out}.png`));
