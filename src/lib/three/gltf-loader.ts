import type { WebGLRenderer } from "three";
import { type GLTF, GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { KTX2Loader } from "three/examples/jsm/loaders/KTX2Loader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";

import { assetUrl } from "@/config/assets";

/**
 * glTF loading for the approved asset pipeline: GLB + Meshopt geometry + KTX2
 * (Basis Universal) textures. Draco is deliberately not configured — an asset
 * that requires it fails to load with a clear error instead of pulling in
 * another decoder.
 *
 * Decoders are self-hosted: Meshopt ships inside the JavaScript chunk; the
 * Basis transcoder is served from /assets/decoders/basis/ (synced from the
 * installed three version by `pnpm assets:decoders`).
 */
export const BASIS_TRANSCODER_PATH = assetUrl("decoders", "basis/");

export interface GltfAssetLoader {
  load(url: string): Promise<GLTF>;
  /** Terminates the KTX2 transcoder workers. */
  dispose(): void;
}

export function createGltfLoader(renderer: WebGLRenderer): GltfAssetLoader {
  const ktx2 = new KTX2Loader().setTranscoderPath(BASIS_TRANSCODER_PATH).detectSupport(renderer);
  // Fetch the transcoder alongside the models: left to the loader, it is only requested
  // once a GLB has fully downloaded and its first KTX2 texture is parsed (≈ 0.6 s later
  // on a fast 4G connection, all of it on the critical path).
  void ktx2.init().catch(() => {});
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).setKTX2Loader(ktx2);
  return {
    load: (url) => loader.loadAsync(url),
    dispose: () => ktx2.dispose(),
  };
}
