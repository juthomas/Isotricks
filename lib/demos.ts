import * as THREE from "three";
import type { DemoId } from "./types";
import { EXTERNAL_ASSETS, TRIPODE_ASSET, TRIPODE_CASE_ASSET } from "./types";

export type DemoCategory =
  | "models"
  | "solids"
  | "illusions"
  | "faces"
  | "music"
  | "gadgets";

export type DemoDefinition = {
  id: DemoId;
  label: string;
  description: string;
  category: DemoCategory;
  /** If set, load this public asset instead of procedural geometry */
  assetUrl?: string;
  assetFileName?: string;
};

export const DEMO_CATEGORIES: { id: DemoCategory; label: string }[] = [
  { id: "models", label: "Models" },
  { id: "gadgets", label: "Gadgets" },
  { id: "music", label: "Instruments" },
  { id: "faces", label: "Faces" },
  { id: "illusions", label: "Illusions" },
  { id: "solids", label: "Solids" },
];

export const DEMO_LIST: DemoDefinition[] = [
  {
    id: "tripode",
    label: "Tripode",
    description: "T-Display · wireless charging",
    category: "models",
    assetUrl: TRIPODE_ASSET.url,
    assetFileName: TRIPODE_ASSET.fileName,
  },
  {
    id: "tripode-case",
    label: "Tripode Case",
    description: "Closed case · rebaked",
    category: "models",
    assetUrl: TRIPODE_CASE_ASSET.url,
    assetFileName: TRIPODE_CASE_ASSET.fileName,
  },
  {
    id: "raspberry-pi",
    label: "Raspberry Pi",
    description: "Rough dimensional board",
    category: "gadgets",
    assetUrl: EXTERNAL_ASSETS["raspberry-pi"].url,
    assetFileName: EXTERNAL_ASSETS["raspberry-pi"].fileName,
  },
  {
    id: "arduino",
    label: "Arduino",
    description: "Uno-style microcontroller",
    category: "gadgets",
    assetUrl: EXTERNAL_ASSETS.arduino.url,
    assetFileName: EXTERNAL_ASSETS.arduino.fileName,
  },
  {
    id: "guitar",
    label: "Guitar",
    description: "Low-poly electric guitar",
    category: "music",
    assetUrl: EXTERNAL_ASSETS.guitar.url,
    assetFileName: EXTERNAL_ASSETS.guitar.fileName,
  },
  {
    id: "piano",
    label: "Piano",
    description: "Upright piano",
    category: "music",
    assetUrl: EXTERNAL_ASSETS.piano.url,
    assetFileName: EXTERNAL_ASSETS.piano.fileName,
  },
  {
    id: "drum",
    label: "Drum Set",
    description: "Full kit",
    category: "music",
    assetUrl: EXTERNAL_ASSETS.drum.url,
    assetFileName: EXTERNAL_ASSETS.drum.fileName,
  },
  {
    id: "trumpet",
    label: "Trumpet",
    description: "Brass instrument",
    category: "music",
    assetUrl: EXTERNAL_ASSETS.trumpet.url,
    assetFileName: EXTERNAL_ASSETS.trumpet.fileName,
  },
  {
    id: "violin",
    label: "Violin",
    description: "Bowed strings",
    category: "music",
    assetUrl: EXTERNAL_ASSETS.violin.url,
    assetFileName: EXTERNAL_ASSETS.violin.fileName,
  },
  {
    id: "saxophone",
    label: "Saxophone",
    description: "Woodwind",
    category: "music",
    assetUrl: EXTERNAL_ASSETS.saxophone.url,
    assetFileName: EXTERNAL_ASSETS.saxophone.fileName,
  },
  {
    id: "headphones",
    label: "Headphones",
    description: "Over-ear cans",
    category: "music",
    assetUrl: EXTERNAL_ASSETS.headphones.url,
    assetFileName: EXTERNAL_ASSETS.headphones.fileName,
  },
  {
    id: "face-janus",
    label: "Janus",
    description: "Two faces, opposite directions",
    category: "faces",
  },
  {
    id: "face-mask",
    label: "Mask",
    description: "Hollow theatrical mask",
    category: "faces",
  },
  {
    id: "face-robot",
    label: "Robot Head",
    description: "Blocky mechanical face",
    category: "faces",
  },
  {
    id: "face-cat",
    label: "Cat Face",
    description: "Pointy ears and whiskers",
    category: "faces",
  },
  {
    id: "head-bust",
    label: "Bust",
    description: "Stylized head and neck",
    category: "faces",
  },
  {
    id: "necker-cube",
    label: "Necker Cube",
    description: "Classic ambiguous cube",
    category: "illusions",
  },
  {
    id: "open-frame",
    label: "Open Frame",
    description: "Impossible-style hollow box",
    category: "illusions",
  },
  {
    id: "stairs",
    label: "Schröder Stairs",
    description: "Ambiguous ascending steps",
    category: "illusions",
  },
  {
    id: "cross",
    label: "Plus Cross",
    description: "3D plus with depth flip",
    category: "illusions",
  },
  {
    id: "stellated-tetra",
    label: "Stella Octangula",
    description: "Interlocked tetrahedra",
    category: "illusions",
  },
  {
    id: "arrow",
    label: "Arrow",
    description: "Directional chevron solid",
    category: "illusions",
  },
  {
    id: "tetrahedron",
    label: "Tetrahedron",
    description: "4-face solid",
    category: "solids",
  },
  {
    id: "octahedron",
    label: "Octahedron",
    description: "8-face diamond",
    category: "solids",
  },
  {
    id: "dodecahedron",
    label: "Dodecahedron",
    description: "12 pentagon faces",
    category: "solids",
  },
  {
    id: "icosahedron",
    label: "Icosahedron",
    description: "20 triangular faces",
    category: "solids",
  },
  {
    id: "sphere",
    label: "Sphere",
    description: "Dense point cloud ball",
    category: "solids",
  },
  {
    id: "cone",
    label: "Cone",
    description: "Pointed solid of revolution",
    category: "solids",
  },
  {
    id: "cylinder",
    label: "Cylinder",
    description: "Circular prism",
    category: "solids",
  },
  {
    id: "capsule",
    label: "Capsule",
    description: "Pill / stadium solid",
    category: "solids",
  },
  {
    id: "torus",
    label: "Torus",
    description: "Classic doughnut ring",
    category: "solids",
  },
  {
    id: "torus-knot",
    label: "Torus Knot",
    description: "Twisted ambiguous loop",
    category: "solids",
  },
  {
    id: "pyramid",
    label: "Pyramid",
    description: "Square-base pyramid",
    category: "solids",
  },
  {
    id: "helix",
    label: "Helix",
    description: "Spiral coil",
    category: "solids",
  },
  {
    id: "mobius",
    label: "Möbius Band",
    description: "One-sided twisted strip",
    category: "solids",
  },
  {
    id: "ring-cubes",
    label: "Cube Ring",
    description: "Cubes on a circle",
    category: "solids",
  },
  {
    id: "crystal",
    label: "Crystal",
    description: "Faceted gem shape",
    category: "solids",
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

function wireMat(): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({
    color: 0xa1a1aa,
    wireframe: true,
    transparent: true,
    opacity: 0.95,
    side: THREE.DoubleSide,
  });
}

function addMesh(
  parent: THREE.Object3D,
  geo: THREE.BufferGeometry,
  position?: [number, number, number],
  scale?: [number, number, number],
  rotation?: [number, number, number],
) {
  const mesh = new THREE.Mesh(geo, wireMat());
  if (position) mesh.position.set(...position);
  if (scale) mesh.scale.set(...scale);
  if (rotation) mesh.rotation.set(...rotation);
  parent.add(mesh);
  return mesh;
}

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
  return normalizeObject(new THREE.Mesh(new THREE.TetrahedronGeometry(1, 0), wireMat()));
}

function createOctahedron(): THREE.Group {
  return normalizeObject(new THREE.Mesh(new THREE.OctahedronGeometry(1, 0), wireMat()));
}

function createDodecahedron(): THREE.Group {
  return normalizeObject(new THREE.Mesh(new THREE.DodecahedronGeometry(1, 0), wireMat()));
}

function createIcosahedron(): THREE.Group {
  return normalizeObject(new THREE.Mesh(new THREE.IcosahedronGeometry(1, 0), wireMat()));
}

function createSphere(): THREE.Group {
  return normalizeObject(new THREE.Mesh(new THREE.SphereGeometry(1, 48, 32), wireMat()));
}

function createCone(): THREE.Group {
  return normalizeObject(new THREE.Mesh(new THREE.ConeGeometry(0.7, 1.4, 32), wireMat()));
}

function createCylinder(): THREE.Group {
  return normalizeObject(
    new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 1.4, 32), wireMat()),
  );
}

function createCapsule(): THREE.Group {
  return normalizeObject(
    new THREE.Mesh(new THREE.CapsuleGeometry(0.45, 0.9, 8, 16), wireMat()),
  );
}

function createTorus(): THREE.Group {
  return normalizeObject(
    new THREE.Mesh(new THREE.TorusGeometry(0.7, 0.28, 24, 64), wireMat()),
  );
}

function createTorusKnot(): THREE.Group {
  return normalizeObject(
    new THREE.Mesh(new THREE.TorusKnotGeometry(0.6, 0.18, 128, 16, 2, 3), wireMat()),
  );
}

function createPyramid(): THREE.Group {
  return normalizeObject(
    new THREE.Mesh(new THREE.ConeGeometry(0.9, 1.2, 4), wireMat()),
  );
}

function createOpenFrame(): THREE.Group {
  const group = new THREE.Group();
  const outer = 1;
  const thickness = 0.18;
  const half = outer / 2;
  const beams: Array<[number, number, number, number, number, number]> = [
    [0, -half, -half, outer, thickness, thickness],
    [0, -half, half, outer, thickness, thickness],
    [-half, -half, 0, thickness, thickness, outer],
    [half, -half, 0, thickness, thickness, outer],
    [0, half, -half, outer, thickness, thickness],
    [0, half, half, outer, thickness, thickness],
    [-half, half, 0, thickness, thickness, outer],
    [half, half, 0, thickness, thickness, outer],
    [-half, 0, -half, thickness, outer, thickness],
    [half, 0, -half, thickness, outer, thickness],
    [-half, 0, half, thickness, outer, thickness],
    [half, 0, half, thickness, outer, thickness],
  ];
  for (const [x, y, z, sx, sy, sz] of beams) {
    addMesh(group, new THREE.BoxGeometry(sx, sy, sz), [x, y, z]);
  }
  return normalizeObject(group);
}

function createCross(): THREE.Group {
  const group = new THREE.Group();
  const t = 0.35;
  addMesh(group, new THREE.BoxGeometry(2, t, t));
  addMesh(group, new THREE.BoxGeometry(t, 2, t));
  addMesh(group, new THREE.BoxGeometry(t, t, 2));
  return normalizeObject(group);
}

/** Ambiguous stair block (Schröder-style) */
function createStairs(): THREE.Group {
  const group = new THREE.Group();
  const steps = 5;
  for (let i = 0; i < steps; i++) {
    addMesh(
      group,
      new THREE.BoxGeometry(1.2, 0.22, 0.35),
      [0, i * 0.22 - 0.44, i * 0.28 - 0.56],
    );
  }
  addMesh(group, new THREE.BoxGeometry(0.12, 1.2, 1.6), [-0.66, 0.1, 0]);
  addMesh(group, new THREE.BoxGeometry(1.4, 0.12, 1.6), [0, -0.55, 0]);
  return normalizeObject(group);
}

function createStellatedTetra(): THREE.Group {
  const group = new THREE.Group();
  const a = new THREE.Mesh(new THREE.TetrahedronGeometry(1, 0), wireMat());
  const b = new THREE.Mesh(new THREE.TetrahedronGeometry(1, 0), wireMat());
  b.rotation.set(Math.PI, 0, Math.PI / 2);
  group.add(a, b);
  return normalizeObject(group);
}

function createHelix(): THREE.Group {
  const points: THREE.Vector3[] = [];
  const turns = 4;
  const samples = 160;
  for (let i = 0; i <= samples; i++) {
    const t = (i / samples) * turns * Math.PI * 2;
    points.push(new THREE.Vector3(Math.cos(t) * 0.6, (i / samples) * 2 - 1, Math.sin(t) * 0.6));
  }
  const curve = new THREE.CatmullRomCurve3(points);
  const geo = new THREE.TubeGeometry(curve, samples, 0.12, 10, false);
  return normalizeObject(new THREE.Mesh(geo, wireMat()));
}

function createMobius(): THREE.Group {
  const segments = 64;
  const positions: number[] = [];
  const indices: number[] = [];
  const R = 0.7;
  const w = 0.28;
  for (let i = 0; i <= segments; i++) {
    const u = (i / segments) * Math.PI * 2;
    for (let j = 0; j <= 1; j++) {
      const v = (j - 0.5) * 2 * w;
      const x = (R + v * Math.cos(u / 2)) * Math.cos(u);
      const y = (R + v * Math.cos(u / 2)) * Math.sin(u);
      const z = v * Math.sin(u / 2);
      positions.push(x, z, y);
    }
  }
  for (let i = 0; i < segments; i++) {
    const a = i * 2;
    indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return normalizeObject(new THREE.Mesh(geo, wireMat()));
}

function createRingCubes(): THREE.Group {
  const group = new THREE.Group();
  const count = 10;
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2;
    addMesh(
      group,
      new THREE.BoxGeometry(0.35, 0.35, 0.35),
      [Math.cos(a) * 1.1, Math.sin(a * 2) * 0.15, Math.sin(a) * 1.1],
      undefined,
      [0, -a, 0],
    );
  }
  return normalizeObject(group);
}

function createCrystal(): THREE.Group {
  const group = new THREE.Group();
  addMesh(group, new THREE.OctahedronGeometry(0.7, 0), [0, 0.15, 0]);
  addMesh(group, new THREE.ConeGeometry(0.45, 0.7, 6), [0, -0.55, 0], undefined, [
    Math.PI,
    0,
    0,
  ]);
  addMesh(group, new THREE.ConeGeometry(0.35, 0.55, 6), [0, 0.75, 0]);
  return normalizeObject(group);
}

function createArrow(): THREE.Group {
  const group = new THREE.Group();
  addMesh(group, new THREE.BoxGeometry(0.35, 0.35, 1.2), [0, 0, -0.2]);
  addMesh(group, new THREE.ConeGeometry(0.45, 0.7, 4), [0, 0, 0.7], undefined, [
    Math.PI / 2,
    0,
    0,
  ]);
  return normalizeObject(group);
}

/** Shared face helpers */
function addEye(
  parent: THREE.Object3D,
  x: number,
  y: number,
  z: number,
  size = 0.12,
) {
  addMesh(parent, new THREE.SphereGeometry(size, 12, 10), [x, y, z]);
}

function createJanus(): THREE.Group {
  const group = new THREE.Group();
  const makeFace = (zSign: number) => {
    const face = new THREE.Group();
    addMesh(face, new THREE.SphereGeometry(0.85, 28, 20), [0, 0, 0]);
    addEye(face, -0.28, 0.18, 0.72 * zSign, 0.12);
    addEye(face, 0.28, 0.18, 0.72 * zSign, 0.12);
    addMesh(
      face,
      new THREE.ConeGeometry(0.1, 0.28, 8),
      [0, -0.02, 0.8 * zSign],
      undefined,
      [Math.PI / 2 * zSign, 0, 0],
    );
    const smile = new THREE.TorusGeometry(0.3, 0.045, 8, 20, Math.PI);
    addMesh(face, smile, [0, -0.32, 0.7 * zSign], undefined, [
      zSign > 0 ? 0.15 : -0.15,
      0,
      Math.PI,
    ]);
    return face;
  };
  group.add(makeFace(1));
  const back = makeFace(-1);
  back.rotation.y = Math.PI;
  group.add(back);
  addMesh(group, new THREE.CylinderGeometry(0.35, 0.45, 0.5, 16), [0, -1.05, 0]);
  return normalizeObject(group);
}

function createMask(): THREE.Group {
  const group = new THREE.Group();
  // Thin shell via scaled sphere (points/wireframe read as hollow mask)
  const shell = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 24, 0, Math.PI * 2, 0, Math.PI * 0.65), wireMat());
  shell.scale.set(1, 1.15, 0.55);
  group.add(shell);
  addEye(group, -0.32, 0.15, 0.45, 0.16);
  addEye(group, 0.32, 0.15, 0.45, 0.16);
  addMesh(group, new THREE.BoxGeometry(0.12, 0.28, 0.12), [0, -0.15, 0.48]);
  const mouth = new THREE.TorusGeometry(0.28, 0.04, 8, 20, Math.PI);
  addMesh(group, mouth, [0, -0.45, 0.42], undefined, [0.3, 0, Math.PI]);
  return normalizeObject(group);
}

function createRobotHead(): THREE.Group {
  const group = new THREE.Group();
  addMesh(group, new THREE.BoxGeometry(1.4, 1.2, 1.1));
  addMesh(group, new THREE.BoxGeometry(0.35, 0.2, 0.15), [-0.35, 0.2, 0.56]);
  addMesh(group, new THREE.BoxGeometry(0.35, 0.2, 0.15), [0.35, 0.2, 0.56]);
  addMesh(group, new THREE.BoxGeometry(0.7, 0.12, 0.12), [0, -0.25, 0.56]);
  addMesh(group, new THREE.CylinderGeometry(0.08, 0.08, 0.4, 10), [0, 0.8, 0]);
  addMesh(group, new THREE.SphereGeometry(0.12, 10, 8), [0, 1.05, 0]);
  addMesh(group, new THREE.BoxGeometry(0.5, 0.35, 0.5), [0, -0.85, 0]);
  return normalizeObject(group);
}

function createCatFace(): THREE.Group {
  const group = new THREE.Group();
  addMesh(group, new THREE.SphereGeometry(1, 28, 22));
  // Ears
  addMesh(group, new THREE.ConeGeometry(0.28, 0.55, 4), [-0.55, 0.85, 0.1]);
  addMesh(group, new THREE.ConeGeometry(0.28, 0.55, 4), [0.55, 0.85, 0.1]);
  addEye(group, -0.3, 0.15, 0.88, 0.13);
  addEye(group, 0.3, 0.15, 0.88, 0.13);
  addMesh(group, new THREE.ConeGeometry(0.1, 0.22, 3), [0, -0.05, 0.98], undefined, [
    Math.PI / 2,
    0,
    0,
  ]);
  // Whiskers as thin boxes
  for (const side of [-1, 1]) {
    for (const y of [0.05, -0.08, -0.2]) {
      addMesh(
        group,
        new THREE.BoxGeometry(0.55, 0.02, 0.02),
        [side * 0.55, y, 0.75],
        undefined,
        [0, 0, side * 0.15],
      );
    }
  }
  return normalizeObject(group);
}

function createHeadBust(): THREE.Group {
  const group = new THREE.Group();
  addMesh(group, new THREE.SphereGeometry(0.85, 28, 22), [0, 0.35, 0]);
  addMesh(group, new THREE.CylinderGeometry(0.28, 0.38, 0.55, 16), [0, -0.45, 0]);
  addMesh(group, new THREE.CylinderGeometry(0.55, 0.65, 0.25, 20), [0, -0.85, 0]);
  addEye(group, -0.28, 0.45, 0.72, 0.1);
  addEye(group, 0.28, 0.45, 0.72, 0.1);
  addMesh(group, new THREE.BoxGeometry(0.14, 0.22, 0.18), [0, 0.22, 0.78]);
  const smile = new THREE.TorusGeometry(0.22, 0.035, 8, 16, Math.PI);
  addMesh(group, smile, [0, 0.05, 0.75], undefined, [0.25, 0, Math.PI]);
  return normalizeObject(group);
}

const ASSET_DEMOS = new Set<DemoId>([
  "tripode",
  "tripode-case",
  "raspberry-pi",
  "arduino",
  "guitar",
  "piano",
  "drum",
  "trumpet",
  "violin",
  "saxophone",
  "headphones",
]);

export function createDemoObject(id: DemoId): THREE.Group {
  if (ASSET_DEMOS.has(id)) {
    throw new Error("Asset demo — load via assetUrl, not createDemoObject");
  }

  switch (id) {
    case "necker-cube":
      return createNeckerCube();
    case "tetrahedron":
      return createTetrahedron();
    case "octahedron":
      return createOctahedron();
    case "dodecahedron":
      return createDodecahedron();
    case "icosahedron":
      return createIcosahedron();
    case "sphere":
      return createSphere();
    case "cone":
      return createCone();
    case "cylinder":
      return createCylinder();
    case "capsule":
      return createCapsule();
    case "torus":
      return createTorus();
    case "torus-knot":
      return createTorusKnot();
    case "pyramid":
      return createPyramid();
    case "open-frame":
      return createOpenFrame();
    case "cross":
      return createCross();
    case "stairs":
      return createStairs();
    case "stellated-tetra":
      return createStellatedTetra();
    case "helix":
      return createHelix();
    case "mobius":
      return createMobius();
    case "ring-cubes":
      return createRingCubes();
    case "crystal":
      return createCrystal();
    case "arrow":
      return createArrow();
    case "face-janus":
      return createJanus();
    case "face-mask":
      return createMask();
    case "face-robot":
      return createRobotHead();
    case "face-cat":
      return createCatFace();
    case "head-bust":
      return createHeadBust();
    default:
      return createNeckerCube();
  }
}
