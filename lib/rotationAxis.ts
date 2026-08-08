import * as THREE from "three";

export type RotationAxisWeights = {
  rotationAxisX: number;
  rotationAxisY: number;
  rotationAxisZ: number;
};

const AXIS_EPS = 1e-8;

/** Normalize mix weights to a unit spin axis; fallback to +Y if near-zero. */
export function normalizeRotationAxis(
  weights: RotationAxisWeights,
  out = new THREE.Vector3(),
): THREE.Vector3 {
  out.set(weights.rotationAxisX, weights.rotationAxisY, weights.rotationAxisZ);
  if (out.lengthSq() < AXIS_EPS) {
    return out.set(0, 1, 0);
  }
  return out.normalize();
}

/**
 * Absolute spin around a fixed parent/world axis (matches the red gizmo):
 * result = axisAngle(axis, angle) * base
 */
export function applyAxisSpin(
  target: THREE.Quaternion,
  base: THREE.Quaternion,
  axis: THREE.Vector3,
  angle: number,
  scratch = new THREE.Quaternion(),
): void {
  scratch.setFromAxisAngle(axis, angle);
  target.copy(scratch).multiply(base);
}

/**
 * Rebase so current = axisAngle(axis, angle) * base still holds:
 * base = axisAngle(axis, angle)^-1 * current
 */
export function rebaseAxisSpin(
  current: THREE.Quaternion,
  axis: THREE.Vector3,
  angle: number,
  outBase: THREE.Quaternion,
  scratch = new THREE.Quaternion(),
): void {
  scratch.setFromAxisAngle(axis, angle).invert();
  outBase.copy(scratch).multiply(current);
}
