import {
  type Box3,
  Euler,
  Matrix4,
  type Object3D,
  type PerspectiveCamera,
  Quaternion,
  Ray,
  Vector3,
} from "three";

import type { CameraPose } from "../motion/hero-camera";

/*
 * Three.js-side math shared by the runtime and by geometry tests:
 * truck-space → world transforms, camera application (with lens shift)
 * and trailer coverage of the frame.
 */

const scratchQuaternion = new Quaternion();
const scratchEuler = new Euler();
const unitScale = new Vector3(1, 1, 1);

/** World matrix for a truck pose on the ground plane. */
export function rigMatrix(target: Matrix4, x: number, z: number, heading: number): Matrix4 {
  scratchQuaternion.setFromEuler(scratchEuler.set(0, heading, 0));
  return target.compose(new Vector3(x, 0, z), scratchQuaternion, unitScale);
}

const position = new Vector3();
const lookAt = new Vector3();

/**
 * Places the camera for a truck-space pose. Lens shift uses a view offset
 * (a shift lens): the subject moves across the frame without perspective change.
 */
export function applyCameraPose(
  camera: PerspectiveCamera,
  pose: CameraPose,
  rigWorld: Matrix4,
  width: number,
  height: number,
): void {
  position.set(...pose.position).applyMatrix4(rigWorld);
  lookAt.set(...pose.target).applyMatrix4(rigWorld);
  camera.position.copy(position);
  camera.up.set(0, 1, 0);
  camera.lookAt(lookAt);
  camera.fov = pose.fov;
  camera.aspect = width / height;
  if (pose.lensShiftX !== 0 || pose.lensShiftY !== 0) {
    camera.setViewOffset(
      width,
      height,
      -pose.lensShiftX * width,
      pose.lensShiftY * height,
      width,
      height,
    );
  } else {
    camera.clearViewOffset();
  }
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld(true);
}

export const COVERAGE_GRID = { columns: 16, rows: 9 } as const;

const inverse = new Matrix4();
const ray = new Ray();
const ndc = new Vector3();
const origin = new Vector3();

/**
 * Fraction of the frame covered by the trailer body: rays through a 16×9
 * grid of pixel centres, tested against the body's oriented bounding box.
 * Deterministic and cheap (no mesh raycasting).
 */
export function trailerCoverage(
  camera: PerspectiveCamera,
  trailerBody: Object3D,
  localBox: Box3,
): number {
  trailerBody.updateWorldMatrix(true, false);
  inverse.copy(trailerBody.matrixWorld).invert();
  camera.getWorldPosition(origin);

  const { columns, rows } = COVERAGE_GRID;
  let hits = 0;
  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      ndc
        .set(((column + 0.5) / columns) * 2 - 1, ((row + 0.5) / rows) * 2 - 1, 0.5)
        .unproject(camera);
      ray.origin.copy(origin);
      ray.direction.copy(ndc).sub(origin).normalize();
      ray.applyMatrix4(inverse);
      if (ray.intersectsBox(localBox)) hits++;
    }
  }
  return hits / (columns * rows);
}
