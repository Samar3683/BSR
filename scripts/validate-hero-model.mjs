/**
 * Validates a hero GLB against the approved asset pipeline, the model
 * contract and the tier budgets — before it goes into the hero manifest.
 *
 *   pnpm assets:validate-model <file.glb> --role tractor|trailer|dock [--tier high|medium|low]
 *
 * Checks:
 *   - pipeline: GLB, Meshopt geometry, KTX2 textures, no Draco;
 *   - contract (tractor/trailer): required nodes and material slots; unknown
 *     material names are reported as warnings;
 *   - budgets: triangles and estimated GPU texture memory for the tier.
 * Exits non-zero on any error. The logic is the same TypeScript the app and its
 * unit tests use (run by Node's type stripping; no build step, no dependency).
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";

import { HERO_GPU_BUDGETS } from "../src/experiences/home/config/hero-budgets.ts";
import {
  KNOWN_MATERIAL_NAMES,
  missingMaterials,
  TRACTOR_REQUIRED_MATERIALS,
  TRACTOR_REQUIRED_NODES,
  TRAILER_REQUIRED_MATERIALS,
  TRAILER_REQUIRED_NODES,
} from "../src/experiences/home/scenes/truck-contract-spec.ts";
import { inspectGlb, pipelineIssues } from "../src/lib/three/glb-inspect.ts";

const { values: args, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    role: { type: "string" },
    tier: { type: "string", default: "high" },
  },
});

const file = positionals[0];
const ROLES = {
  tractor: {
    nodes: TRACTOR_REQUIRED_NODES,
    materials: TRACTOR_REQUIRED_MATERIALS,
    triangles: "tractorTriangles",
  },
  trailer: {
    nodes: TRAILER_REQUIRED_NODES,
    materials: TRAILER_REQUIRED_MATERIALS,
    triangles: "trailerTriangles",
  },
  dock: { nodes: [], materials: [], triangles: "dockTriangles" },
  // Road kit (Gate B): impostor atlases + road surface; the road world's geometry is procedural.
  road: { nodes: ["RoadKit"], materials: [], triangles: "roadTriangles" },
};
const role = ROLES[args.role];
const budget = HERO_GPU_BUDGETS[args.tier];
if (!file || !role || !budget) {
  console.error(
    "usage: pnpm assets:validate-model <file.glb> --role tractor|trailer|dock|road [--tier high|medium|low]",
  );
  process.exit(2);
}

const report = inspectGlb(new Uint8Array(readFileSync(file)));
const errors = [...pipelineIssues(report)];
const warnings = [];

const nodes = new Set(report.nodeNames);
for (const name of role.nodes) if (!nodes.has(name)) errors.push(`missing node ${name}`);
const materials = new Set(report.materialNames);
for (const name of missingMaterials(materials, role.materials)) {
  errors.push(`missing material slot ${name}`);
}
if (args.role !== "dock" && args.role !== "road") {
  for (const name of materials) {
    if (!KNOWN_MATERIAL_NAMES.has(name)) warnings.push(`material "${name}" is not a contract slot`);
  }
}

const triangles = budget[role.triangles];
if (report.triangles > triangles.hard) {
  errors.push(`triangles ${report.triangles} > hard ${triangles.hard} (${args.tier})`);
} else if (report.triangles > triangles.goal) {
  warnings.push(`triangles ${report.triangles} > goal ${triangles.goal} (${args.tier})`);
}
if (report.textureGpuBytes > budget.textureBytes.hard) {
  errors.push(
    `texture memory ${mb(report.textureGpuBytes)} > hard ${mb(budget.textureBytes.hard)}`,
  );
}
if (["tractor", "trailer"].includes(args.role) && materials.size > budget.truckMaterials) {
  warnings.push(
    `${materials.size} materials in this file; the whole truck may use ${budget.truckMaterials} (${args.tier})`,
  );
}

console.log(`${path.basename(file)} — ${args.role}, tier ${args.tier}`);
console.log(
  `  size ${mb(report.byteLength)} · ${report.triangles} triangles · ${report.primitives} primitives`,
);
console.log(
  `  ${report.materialNames.length} materials · ${report.images.length} images · GPU textures ≈ ${mb(report.textureGpuBytes)}`,
);
console.log(`  extensions: ${report.extensionsUsed.join(", ") || "none"}`);
for (const warning of warnings) console.log(`  warning: ${warning}`);
for (const error of errors) console.log(`  ERROR: ${error}`);
console.log(errors.length ? `FAILED (${errors.length} error(s))` : "OK");
process.exit(errors.length ? 1 : 0);

function mb(bytes) {
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}
