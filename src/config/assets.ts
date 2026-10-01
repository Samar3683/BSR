/**
 * Central asset locations under /public/assets. Components resolve paths
 * through `assetUrl` instead of hard-coding them.
 *
 * Naming convention: lowercase kebab-case, descriptive, optional quality
 * suffix — e.g. `models/truck/bsr-truck-high.glb`,
 * `textures/materials/road-asphalt-normal.ktx2`.
 */
export type AssetCategory =
  "images" | "video" | "models" | "textures" | "hdr" | "icons" | "decoders";

const ASSET_ROOT = "/assets";

export function assetUrl(category: AssetCategory, path: string): string {
  return `${ASSET_ROOT}/${category}/${path.replace(/^\/+/, "")}`;
}
