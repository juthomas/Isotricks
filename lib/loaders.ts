import * as THREE from "three";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import { MTLLoader } from "three/examples/jsm/loaders/MTLLoader.js";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";
import { PLYLoader } from "three/examples/jsm/loaders/PLYLoader.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

const MESH_EXTENSIONS = ["obj", "stl", "glb", "gltf", "ply"] as const;
const SIDECAR_EXTENSIONS = [
  "mtl",
  "png",
  "jpg",
  "jpeg",
  "webp",
  "bmp",
  "tga",
  "gif",
] as const;

const IMAGE_EXT = /\.(png|jpe?g|webp|gif|bmp|tga)$/i;
const DEFAULT_LIFT_HEX = 0xa1a1aa;

export type SupportedExtension = (typeof MESH_EXTENSIONS)[number];

export const SUPPORTED_EXTENSIONS = MESH_EXTENSIONS;

export function getExtension(fileName: string): string {
  const parts = fileName.toLowerCase().split(".");
  return parts.length > 1 ? parts[parts.length - 1] : "";
}

export function isSupportedFormat(fileName: string): boolean {
  return MESH_EXTENSIONS.includes(
    getExtension(fileName) as SupportedExtension,
  );
}

export function isSidecarFile(fileName: string): boolean {
  return (SIDECAR_EXTENSIONS as readonly string[]).includes(
    getExtension(fileName),
  );
}

export function normalizeObject(
  object: THREE.Object3D,
  targetSize = 2,
): THREE.Group {
  const wrapper = new THREE.Group();
  wrapper.add(object);

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

/**
 * True when Texture color mode can use authored shading:
 * image maps, vertex colors, or named MTL materials (Kd-only counts).
 */
export function detectHasTextures(object: THREE.Object3D): boolean {
  let found = false;
  object.traverse((child) => {
    if (found) return;
    if (child instanceof THREE.Mesh) {
      const mats = Array.isArray(child.material)
        ? child.material
        : [child.material];
      for (const mat of mats) {
        if (!mat) continue;
        if ("map" in mat && mat.map) {
          found = true;
          return;
        }
        // MTLLoader names materials from `newmtl` — enables Texture for Kd-only MTLs
        if (typeof mat.name === "string" && mat.name.length > 0) {
          found = true;
          return;
        }
      }
      if (child.geometry?.attributes?.color) {
        found = true;
      }
    }
  });
  return found;
}

function ensureRenderable(object: THREE.Object3D): THREE.Object3D {
  object.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      if (!child.material) {
        child.material = new THREE.MeshStandardMaterial({
          color: DEFAULT_LIFT_HEX,
          metalness: 0.1,
          roughness: 0.8,
        });
      }
      const materials = Array.isArray(child.material)
        ? child.material
        : [child.material];
      for (const mat of materials) {
        mat.side = THREE.DoubleSide;
        if ("map" in mat && mat.map instanceof THREE.Texture) {
          if (mat.map.colorSpace !== THREE.SRGBColorSpace) {
            mat.map.colorSpace = THREE.SRGBColorSpace;
            mat.needsUpdate = true;
            mat.map.needsUpdate = true;
          }
        }
        // Keep authored MTL Kd / maps as-is (match obj_origin_modifier)
      }
      if (!child.geometry.attributes.normal) {
        child.geometry.computeVertexNormals();
      }
    }
  });
  return object;
}

function basename(path: string): string {
  const cleaned = path.replace(/\\/g, "/");
  const slash = cleaned.lastIndexOf("/");
  return slash >= 0 ? cleaned.slice(slash + 1) : cleaned;
}

async function blobText(blob: Blob): Promise<string> {
  return blob.text();
}

/**
 * Same approach as obj_origin_modifier: read File/Blob text, MTLLoader.parse,
 * OBJLoader.parse, resolve texture paths via LoadingManager URL modifier.
 */
async function loadObjFromTexts(
  objText: string,
  mtlText: string | null,
  textureBlobs: Map<string, Blob>,
): Promise<THREE.Object3D> {
  const blobUrls: string[] = [];
  const manager = new THREE.LoadingManager();
  manager.setURLModifier((url) => {
    const key = basename(url);
    const keyLower = key.toLowerCase();
    const blob =
      textureBlobs.get(key) ??
      textureBlobs.get(keyLower) ??
      textureBlobs.get(url) ??
      textureBlobs.get(url.toLowerCase());
    if (blob) {
      const blobUrl = URL.createObjectURL(blob);
      blobUrls.push(blobUrl);
      return blobUrl;
    }
    return url;
  });

  let object: THREE.Group;
  if (mtlText) {
    const mtlLoader = new MTLLoader(manager);
    const materials = mtlLoader.parse(mtlText, "");
    materials.preload();
    const objLoader = new OBJLoader(manager);
    objLoader.setMaterials(materials);
    object = objLoader.parse(objText);
  } else {
    const objLoader = new OBJLoader(manager);
    object = objLoader.parse(objText);
  }

  const rendered = ensureRenderable(object);
  rendered.userData.revokeBlobUrls = () => {
    for (const url of blobUrls) URL.revokeObjectURL(url);
  };
  return rendered;
}

function collectTextureBlobs(
  assets: { fileName: string; blob: Blob }[],
): Map<string, Blob> {
  const textures = new Map<string, Blob>();
  for (const asset of assets) {
    if (!IMAGE_EXT.test(asset.fileName)) continue;
    const name = basename(asset.fileName);
    textures.set(name, asset.blob);
    textures.set(name.toLowerCase(), asset.blob);
    textures.set(asset.fileName, asset.blob);
    textures.set(asset.fileName.toLowerCase(), asset.blob);
  }
  return textures;
}

function findMtlAsset(
  objText: string,
  objFileName: string,
  assets: { fileName: string; blob: Blob }[],
): { fileName: string; blob: Blob } | null {
  const byName = new Map(
    assets.map((a) => [basename(a.fileName).toLowerCase(), a]),
  );

  const paired = basename(objFileName.replace(/\.obj$/i, ".mtl")).toLowerCase();
  if (byName.has(paired)) return byName.get(paired)!;

  for (const line of objText.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const parts = trimmed.split(/\s+/);
    if (parts[0]!.toLowerCase() === "mtllib" && parts[1]) {
      const key = basename(parts[1]).toLowerCase();
      if (byName.has(key)) return byName.get(key)!;
      break;
    }
  }

  const mtls = assets.filter((a) => getExtension(a.fileName) === "mtl");
  return mtls.length === 1 ? mtls[0]! : null;
}

async function loadObjPackage(
  primary: { fileName: string; blob: Blob },
  assets: { fileName: string; blob: Blob }[],
): Promise<THREE.Object3D> {
  const objText = await blobText(primary.blob);
  const mtlAsset = findMtlAsset(objText, primary.fileName, assets);
  const mtlText = mtlAsset ? await blobText(mtlAsset.blob) : null;
  const textures = collectTextureBlobs(assets);
  return loadObjFromTexts(objText, mtlText, textures);
}

async function loadFromUrl(
  url: string,
  fileName: string,
): Promise<THREE.Object3D> {
  const extension = getExtension(fileName);
  switch (extension) {
    case "obj": {
      const objText = await (await fetch(url)).text();
      // Try sibling .mtl next to the URL (demos / static assets)
      let mtlText: string | null = null;
      const mtlUrl = url.replace(/\.obj($|\?)/i, ".mtl$1");
      if (mtlUrl !== url) {
        try {
          const res = await fetch(mtlUrl);
          if (res.ok) mtlText = await res.text();
        } catch {
          // no sibling mtl
        }
      }
      if (!mtlText) {
        const mtllib = objText
          .split(/\r?\n/)
          .map((l) => l.trim())
          .find((l) => l.toLowerCase().startsWith("mtllib "));
        if (mtllib) {
          const name = basename(mtllib.split(/\s+/)[1] ?? "");
          const slash = url.lastIndexOf("/");
          const base = slash >= 0 ? url.slice(0, slash + 1) : "";
          try {
            const res = await fetch(`${base}${name}`);
            if (res.ok) mtlText = await res.text();
          } catch {
            // ignore
          }
        }
      }
      return loadObjFromTexts(objText, mtlText, new Map());
    }
    case "stl": {
      const loader = new STLLoader();
      const geometry = await loader.loadAsync(url);
      geometry.computeVertexNormals();
      return new THREE.Mesh(
        geometry,
        new THREE.MeshStandardMaterial({
          color: DEFAULT_LIFT_HEX,
          metalness: 0.1,
          roughness: 0.8,
          side: THREE.DoubleSide,
        }),
      );
    }
    case "ply": {
      const loader = new PLYLoader();
      const geometry = await loader.loadAsync(url);
      if (!geometry.attributes.normal) {
        geometry.computeVertexNormals();
      }
      return new THREE.Mesh(
        geometry,
        new THREE.MeshStandardMaterial({
          color: DEFAULT_LIFT_HEX,
          metalness: 0.1,
          roughness: 0.8,
          side: THREE.DoubleSide,
          vertexColors: Boolean(geometry.attributes.color),
        }),
      );
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

export type LoadedModelResult = {
  object: THREE.Group;
  hasTextures: boolean;
};

export async function loadModelFromUrl(
  url: string,
  fileName: string,
): Promise<THREE.Group> {
  const extension = getExtension(fileName);
  if (!isSupportedFormat(fileName)) {
    throw new Error(`Unsupported format ".${extension}".`);
  }
  const object = await loadFromUrl(url, fileName);
  return normalizeObject(object);
}

export async function loadModelFromPackage(
  primary: { fileName: string; blob: Blob },
  assets: { fileName: string; blob: Blob }[] = [],
): Promise<LoadedModelResult> {
  if (!isSupportedFormat(primary.fileName)) {
    throw new Error(`Unsupported format ".${getExtension(primary.fileName)}".`);
  }

  const extension = getExtension(primary.fileName);
  let object: THREE.Object3D;

  if (extension === "obj") {
    object = await loadObjPackage(primary, assets);
  } else {
    const url = URL.createObjectURL(primary.blob);
    try {
      object = await loadFromUrl(url, primary.fileName);
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  const group = normalizeObject(object);
  const hasMtlAsset = assets.some((a) => getExtension(a.fileName) === "mtl");
  const hasImageAsset = assets.some((a) => IMAGE_EXT.test(a.fileName));
  const hasTextures =
    detectHasTextures(group) || hasMtlAsset || hasImageAsset;
  group.userData.hasTextures = hasTextures;
  if (object.userData.revokeBlobUrls) {
    group.userData.revokeBlobUrls = object.userData.revokeBlobUrls;
  }
  return { object: group, hasTextures };
}

/** Classify a FileList into primary mesh + sidecars. */
export function splitModelFiles(files: File[]): {
  primary: File | null;
  sidecars: File[];
  error: string | null;
} {
  const list = Array.from(files);
  const meshes = list.filter((f) => isSupportedFormat(f.name));
  const sidecars = list.filter((f) => isSidecarFile(f.name));

  if (meshes.length === 0) {
    return {
      primary: null,
      sidecars: [],
      error: `Need a mesh file (${MESH_EXTENSIONS.join(", ").toUpperCase()})`,
    };
  }
  if (meshes.length > 1) {
    return {
      primary: null,
      sidecars: [],
      error: "Select only one mesh file (plus optional .mtl / textures)",
    };
  }

  const primary = meshes[0]!;
  if (getExtension(primary.name) !== "obj" && sidecars.length > 0) {
    return { primary, sidecars: [], error: null };
  }

  return { primary, sidecars, error: null };
}
