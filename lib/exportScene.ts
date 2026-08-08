import * as THREE from "three";
import type { GlitchRuntimeUniforms, GlobalViewSettings } from "@/lib/types";

export type ExportCameraState = {
  position: THREE.Vector3;
  quaternion: THREE.Quaternion;
  up: THREE.Vector3;
  zoom: number;
  /** Vertical half-extent of the ortho frustum (before zoom). */
  halfHeight: number;
  near: number;
  far: number;
};

export type ExportGlitchSettings = Pick<
  GlobalViewSettings,
  | "glitchMixCellSize"
  | "glitchDigitalMin"
  | "glitchDigitalMax"
  | "glitchDigitalSpeed"
  | "glitchDeformMin"
  | "glitchDeformMax"
  | "glitchDeformSpeed"
  | "glitchScatterMin"
  | "glitchScatterMax"
  | "glitchScatterSpeed"
  | "glitchTwistMin"
  | "glitchTwistMax"
  | "glitchTwistSpeed"
  | "glitchTpMin"
  | "glitchTpMax"
  | "glitchTpSpeed"
  | "glitchChromaMin"
  | "glitchChromaMax"
  | "glitchChromaSpeed"
  | "glitchMixWireMin"
  | "glitchMixWireMax"
  | "glitchMixWireSpeed"
  | "glitchMixPointsMin"
  | "glitchMixPointsMax"
  | "glitchMixPointsSpeed"
  | "glitchMixSolidMin"
  | "glitchMixSolidMax"
  | "glitchMixSolidSpeed"
>;

export type ExportModelSource = {
  /** Live model root (materials already applied by LoadedModel). */
  modelRoot: THREE.Object3D;
  depthUniforms: {
    uMinDepth: { value: number };
    uMaxDepth: { value: number };
    uInvertDepth: { value: number };
  } | null;
  glitchUniforms: GlitchRuntimeUniforms | null;
  glitchSettings: ExportGlitchSettings | null;
  invertDepthColors: boolean;
  /** Live camera pose snapshot (includes orbit), not just settings sliders. */
  camera: ExportCameraState;
  rotationDirection: 1 | -1 | 0;
  displayMode: "wireframe" | "points" | "solid";
  colorMode: GlobalViewSettings["colorMode"];
  /** Scene clock time used for glitch (photo export). */
  sceneTime: number;
};

/** Clone hierarchy but share geometries + materials (keeps depth shader uniforms). */
export function cloneHierarchyShareMaterials(
  source: THREE.Object3D,
): THREE.Object3D {
  const clone = source.clone(false);
  clone.position.copy(source.position);
  clone.quaternion.copy(source.quaternion);
  clone.scale.copy(source.scale);
  clone.rotation.copy(source.rotation);
  clone.matrix.copy(source.matrix);
  clone.matrixWorld.copy(source.matrixWorld);

  if ((source as THREE.Mesh).isMesh) {
    const srcMesh = source as THREE.Mesh;
    const dstMesh = clone as THREE.Mesh;
    dstMesh.geometry = srcMesh.geometry;
    dstMesh.material = srcMesh.material;
  } else if ((source as THREE.Points).isPoints) {
    const src = source as THREE.Points;
    const dst = clone as THREE.Points;
    dst.geometry = src.geometry;
    dst.material = src.material;
  } else if (
    (source as THREE.Line).isLine ||
    (source as THREE.LineSegments).isLineSegments
  ) {
    const src = source as THREE.Line;
    const dst = clone as THREE.Line;
    dst.geometry = src.geometry;
    dst.material = src.material;
  }

  for (const child of source.children) {
    clone.add(cloneHierarchyShareMaterials(child));
  }
  return clone;
}

export function captureOrthoCameraState(
  camera: THREE.OrthographicCamera,
): ExportCameraState {
  const halfHeight = Math.max(
    1e-6,
    Math.abs(camera.top - camera.bottom) / 2,
  );
  return {
    position: camera.position.clone(),
    quaternion: camera.quaternion.clone(),
    up: camera.up.clone(),
    zoom: camera.zoom,
    halfHeight,
    near: camera.near,
    far: camera.far,
  };
}

/** Apply live camera orientation; rebuild frustum for the export aspect ratio. */
export function applyExportCameraPose(
  camera: THREE.OrthographicCamera,
  width: number,
  height: number,
  state: ExportCameraState,
): void {
  const w = Math.max(width, 1);
  const h = Math.max(height, 1);
  const aspect = w / h;
  const halfH = state.halfHeight;

  camera.position.copy(state.position);
  camera.quaternion.copy(state.quaternion);
  camera.up.copy(state.up);
  camera.zoom = state.zoom;
  camera.left = -halfH * aspect;
  camera.right = halfH * aspect;
  camera.top = halfH;
  camera.bottom = -halfH;
  camera.near = state.near;
  camera.far = state.far;
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld(true);
}

const _box = new THREE.Box3();
const _sphere = new THREE.Sphere();
const _corner = new THREE.Vector3();
const _viewMatrix = new THREE.Matrix4();

export function updateExportDepthUniforms(
  root: THREE.Object3D,
  camera: THREE.Camera,
  uniforms: NonNullable<ExportModelSource["depthUniforms"]>,
  invertDepthColors: boolean,
): void {
  uniforms.uInvertDepth.value = invertDepthColors ? 1 : 0;
  root.updateWorldMatrix(true, true);
  _box.setFromObject(root);
  if (_box.isEmpty()) return;

  _box.getBoundingSphere(_sphere);
  _viewMatrix.copy(camera.matrixWorldInverse);

  let minD = Infinity;
  let maxD = -Infinity;
  for (let i = 0; i < 8; i++) {
    _corner.set(
      i & 1 ? _box.max.x : _box.min.x,
      i & 2 ? _box.max.y : _box.min.y,
      i & 4 ? _box.max.z : _box.min.z,
    );
    _corner.applyMatrix4(_viewMatrix);
    const d = -_corner.z;
    minD = Math.min(minD, d);
    maxD = Math.max(maxD, d);
  }
  const centerView = _corner.copy(_sphere.center).applyMatrix4(_viewMatrix);
  const centerD = -centerView.z;
  minD = Math.min(minD, centerD - _sphere.radius);
  maxD = Math.max(maxD, centerD + _sphere.radius);

  uniforms.uMinDepth.value = minD;
  uniforms.uMaxDepth.value = Math.max(maxD, minD + 1e-4);
}

export function buildExportScene(
  source: ExportModelSource,
): {
  scene: THREE.Scene;
  root: THREE.Object3D;
  camera: THREE.OrthographicCamera;
} {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);

  // Keep in sync with IsoViewer lights (esp. solid + texture Phong MTL)
  const texturedSolid =
    source.displayMode === "solid" && source.colorMode === "texture";
  if (texturedSolid) {
    scene.add(new THREE.AmbientLight(0xffffff, 0.55));
    const key = new THREE.DirectionalLight(0xffffff, 1.1);
    key.position.set(5, 8, 4);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xffffff, 0.35);
    fill.position.set(-4, 2, -3);
    scene.add(fill);
  } else {
    const ambientIntensity = source.displayMode === "solid" ? 0.85 : 1;
    scene.add(new THREE.AmbientLight(0xffffff, ambientIntensity));
    if (source.displayMode === "solid") {
      const dir = new THREE.DirectionalLight(0xffffff, 0.45);
      dir.position.set(4, 6, 2);
      scene.add(dir);
    }
  }

  const root = cloneHierarchyShareMaterials(source.modelRoot);
  scene.add(root);

  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -100, 100);
  return { scene, root, camera };
}
