import * as THREE from "three";
import type { DemoId } from "./types";
import { TRIPODE_ASSET, TRIPODE_CASE_ASSET } from "./types";

export type DemoDefinition = {
  id: DemoId;
  label: string;
  description: string;
  /** If set, load this public asset instead of procedural geometry */
  assetUrl?: string;
  assetFileName?: string;
};

export const DEMO_LIST: DemoDefinition[] = [
  {
    id: "tripode",
    label: "Tripode",
    description: "T-Display battery · wireless charging",
    assetUrl: TRIPODE_ASSET.url,
    assetFileName: TRIPODE_ASSET.fileName,
  },
  {
    id: "tripode-case",
    label: "Tripode Case",
    description: "Closed case · rebaked",
    assetUrl: TRIPODE_CASE_ASSET.url,
    assetFileName: TRIPODE_CASE_ASSET.fileName,
  },
  {
    id: "necker-cube",
    label: "Necker Cube",
    description: "Classic ambiguous wireframe cube",
  },
  {
    id: "tetrahedron",
    label: "Tetrahedron",
    description: "Reversible four-face solid",
  },
  {
    id: "open-frame",
    label: "Open Frame",
    description: "Impossible-style hollow box",
  },
  {
    id: "torus-knot",
    label: "Torus Knot",
    description: "Twisted ambiguous loop",
  },
];

export function getDemo(id: DemoId): DemoDefinition {
  const demo = DEMO_LIST.find((d) => d.id === id);
  if (!demo) throw new Error(`Unknown demo: ${id}`);
  return demo;
}

function normalizeObject(object: THREE.Object3D, targetSize = 2): THREE.Group {
  const group = new THREE.Group();
  group.add(object);

  const box = new THREE.Box3().setFromObject(group);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z) || 1;

  object.position.sub(center);
  group.scale.setScalar(targetSize / maxDim);

  return group;
}

function createWireMaterial(): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({
    color: 0xa1a1aa,
    wireframe: true,
    transparent: true,
    opacity: 0.95,
  });
}

/** Classic Necker cube — unit cube edges as LineSegments for clean ambiguity */
function createNeckerCube(): THREE.Group {
  const geometry = new THREE.BoxGeometry(1, 1, 1);
  const edges = new THREE.EdgesGeometry(geometry);
  const lines = new THREE.LineSegments(
    edges,
    new THREE.LineBasicMaterial({ color: 0xa1a1aa }),
  );
  geometry.dispose();
  return normalizeObject(lines);
}

function createTetrahedron(): THREE.Group {
  const geometry = new THREE.TetrahedronGeometry(1, 0);
  const mesh = new THREE.Mesh(geometry, createWireMaterial());
  return normalizeObject(mesh);
}

/** Hollow open box / frame — ambiguous depth cues */
function createOpenFrame(): THREE.Group {
  const group = new THREE.Group();
  const material = new THREE.MeshBasicMaterial({
    color: 0xa1a1aa,
    wireframe: true,
  });

  const outer = 1;
  const thickness = 0.18;
  const half = outer / 2;

  // 12 beam segments forming a hollow rectangular frame
  const beams: Array<[number, number, number, number, number, number]> = [
    // bottom square
    [0, -half, -half, outer, thickness, thickness],
    [0, -half, half, outer, thickness, thickness],
    [-half, -half, 0, thickness, thickness, outer],
    [half, -half, 0, thickness, thickness, outer],
    // top square
    [0, half, -half, outer, thickness, thickness],
    [0, half, half, outer, thickness, thickness],
    [-half, half, 0, thickness, thickness, outer],
    [half, half, 0, thickness, thickness, outer],
    // verticals
    [-half, 0, -half, thickness, outer, thickness],
    [half, 0, -half, thickness, outer, thickness],
    [-half, 0, half, thickness, outer, thickness],
    [half, 0, half, thickness, outer, thickness],
  ];

  for (const [x, y, z, sx, sy, sz] of beams) {
    const geo = new THREE.BoxGeometry(sx, sy, sz);
    const mesh = new THREE.Mesh(geo, material.clone());
    mesh.position.set(x, y, z);
    group.add(mesh);
  }

  return normalizeObject(group);
}

function createTorusKnot(): THREE.Group {
  const geometry = new THREE.TorusKnotGeometry(0.6, 0.18, 128, 16, 2, 3);
  const mesh = new THREE.Mesh(geometry, createWireMaterial());
  return normalizeObject(mesh);
}

export function createDemoObject(id: DemoId): THREE.Group {
  switch (id) {
    case "tripode":
    case "tripode-case":
      throw new Error(
        "Asset demo — load via assetUrl, not createDemoObject",
      );
    case "necker-cube":
      return createNeckerCube();
    case "tetrahedron":
      return createTetrahedron();
    case "open-frame":
      return createOpenFrame();
    case "torus-knot":
      return createTorusKnot();
    default:
      return createNeckerCube();
  }
}
