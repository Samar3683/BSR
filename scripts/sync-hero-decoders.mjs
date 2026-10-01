/**
 * Copies the Basis Universal transcoder (KTX2 textures) from the installed
 * three package into /public, so the decoder is self-hosted and always matches
 * the three version in use.
 *
 *   pnpm assets:decoders
 *
 * src/lib/three/decoders.test.ts fails when the copies drift (e.g. after a
 * three upgrade without re-running this script). Meshopt needs no copy: its
 * decoder is bundled into the real-time JavaScript chunk.
 */
import { copyFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const require = createRequire(import.meta.url);
// Resolved through three's exported examples path (its package.json is not exported).
const source = path.dirname(require.resolve("three/examples/jsm/libs/basis/basis_transcoder.js"));
const target = path.join(root, "public/assets/decoders/basis");

mkdirSync(target, { recursive: true });
for (const file of ["basis_transcoder.js", "basis_transcoder.wasm"]) {
  copyFileSync(path.join(source, file), path.join(target, file));
  console.log(`copied ${file}`);
}
