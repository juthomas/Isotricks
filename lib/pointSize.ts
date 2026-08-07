import * as THREE from "three";

/** Point sizes are authored relative to this render height (CSS px × dpr). */
export const POINT_SIZE_REF_HEIGHT = 1080;

export function clampPointSizeSetting(pointSize: number): number {
  return Math.min(10, Math.max(1, pointSize));
}

/** Pixel size for PointsMaterial (sizeAttenuation: false) at a given buffer height. */
export function resolvePointPixelSize(
  pointSize: number,
  renderHeight: number,
): number {
  const base = clampPointSizeSetting(pointSize);
  const h = Math.max(1, renderHeight);
  return base * (h / POINT_SIZE_REF_HEIGHT);
}

/**
 * Scale all PointsMaterials that store `userData.basePointSize` for the
 * current drawing-buffer height (live canvas or offline export).
 */
export function syncPointSizesForResolution(
  root: THREE.Object3D,
  renderHeight: number,
): void {
  const scale = Math.max(1, renderHeight) / POINT_SIZE_REF_HEIGHT;
  root.traverse((obj) => {
    if (!(obj as THREE.Points).isPoints) return;
    const material = (obj as THREE.Points).material;
    const mats = Array.isArray(material) ? material : [material];
    for (const mat of mats) {
      if (!(mat instanceof THREE.PointsMaterial)) continue;
      const base = mat.userData.basePointSize;
      if (typeof base !== "number" || !Number.isFinite(base)) continue;
      mat.size = clampPointSizeSetting(base) * scale;
    }
  });
}
