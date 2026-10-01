import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { BASIS_TRANSCODER_PATH } from "./gltf-loader";

const require = createRequire(import.meta.url);
const threeBasis = path.dirname(
  require.resolve("three/examples/jsm/libs/basis/basis_transcoder.js"),
);

describe("self-hosted KTX2 transcoder", () => {
  it("is served from the path the loader uses", () => {
    expect(BASIS_TRANSCODER_PATH).toBe("/assets/decoders/basis/");
  });

  for (const file of ["basis_transcoder.js", "basis_transcoder.wasm"]) {
    it(`${file} matches the installed three version (run pnpm assets:decoders)`, () => {
      const served = readFileSync(path.join(process.cwd(), "public/assets/decoders/basis", file));
      const installed = readFileSync(path.join(threeBasis, file));
      expect(served.equals(installed)).toBe(true);
    });
  }
});
