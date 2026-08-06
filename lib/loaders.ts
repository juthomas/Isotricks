import * as THREE from "three";
import { OBJLoader } from "three-stdlib";
import { STLLoader } from "three-stdlib";
import { PLYLoader } from "three-stdlib";
import { GLTFLoader } from "three-stdlib";

const SUPPORTED_EXTENSIONS = ["obj", "stl", "glb", "gltf", "ply"] as const;
export type SupportedExtension = (typeof SUPPORTED_EXTENSIONS)[number];

export function getExtension(fileName: string): string {
  const parts = fileName.toLowerCase().split(".");
  return parts.length > 1 ? parts[parts.length - 1] : "";
}

export function isSupportedFormat(fileName: string): boolean {
  return SUPPORTED_EXTENSIONS.includes(
    getExtension(fileName) as SupportedExtension,
  );
}

export function normalizeObject(
  object: THREE.Object3D,
  targetSize = 2,
): THREE.Group {
  const wrapper = new THREE.Group();
  wrapper.add(object);

  // Ensure matrices are up to date before measuring
  wrapper.updateMatrixWorld(true);

  const box = new THREE.Box3().setFromObject(wrapper);
  if (box.isEmpty()) {
    return wrapper;
  }

  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z) || 1;

  object.position.sub(center);
  wrapper.scale.setScalar(targetSize / maxDim);
  wrapper.updateMatrixWorld(true);

  return wrapper;
}

function ensureRenderable(object: THREE.Object3D): THREE.Object3D {
  object.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      if (!child.material) {
        child.material = new THREE.MeshStandardMaterial({
          color: 0xa1a1aa,
          metalness: 0.1,
          roughness: 0.8,
        });
      }
      const materials = Array.isArray(child.material)
        ? child.material
        : [child.material];
      for (const mat of materials) {
        mat.side = THREE.DoubleSide;
      }
      if (!child.geometry.attributes.normal) {
        child.geometry.computeVertexNormals();
      }
    }
  });
  return object;
}

async function loadFromUrl(
  url: string,
  extension: string,
): Promise<THREE.Object3D> {
  switch (extension) {
    case "obj": {
      const loader = new OBJLoader();
      const group = await loader.loadAsync(url);
      return ensureRenderable(group);
    }
    case "stl": {
      const loader = new STLLoader();
      const geometry = await loader.loadAsync(url);
      geometry.computeVertexNormals();
      const mesh = new THREE.Mesh(
        geometry,
        new THREE.MeshStandardMaterial({
          color: 0xa1a1aa,
          metalness: 0.1,
          roughness: 0.8,
          side: THREE.DoubleSide,
        }),
      );
      return mesh;
    }
    case "ply": {
      const loader = new PLYLoader();
      const geometry = await loader.loadAsync(url);
      if (!geometry.attributes.normal) {
        geometry.computeVertexNormals();
      }
      const mesh = new THREE.Mesh(
        geometry,
        new THREE.MeshStandardMaterial({
          color: 0xa1a1aa,
          metalness: 0.1,
          roughness: 0.8,
          side: THREE.DoubleSide,
          vertexColors: Boolean(geometry.attributes.color),
        }),
      );
      return mesh;
    }
    case "glb":
    case "gltf": {
      const loader = new GLTFLoader();
      const gltf = await loader.loadAsync(url);
      return ensureRenderable(gltf.scene);
    }
    default:
      throw new Error(`Unsupported format: .${extension}`);
  }
}

export async function loadModelFromUrl(
  url: string,
  fileName: string,
): Promise<THREE.Group> {
  const extension = getExtension(fileName);
  if (!isSupportedFormat(fileName)) {
    throw new Error(`Unsupported format ".${extension}".`);
  }
  const object = await loadFromUrl(url, extension);
  return normalizeObject(object);
}

export { SUPPORTED_EXTENSIONS };
