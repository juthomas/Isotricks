export type DisplayMode = "wireframe" | "points" | "solid";

export type RotationDirection = 1 | -1 | 0;

/** Project-wide view prefs (shared across all models) */
export type GlobalViewSettings = {
  displayMode: DisplayMode;
  depthColors: boolean;
  invertDepthColors: boolean;
  pointSize: number;
  lineWidth: number;
  /** Cycle through built-in demos automatically */
  autoCycle: boolean;
  /** Seconds between model changes */
  autoCycleSeconds: number;
};

/** Per-object camera / motion prefs */
export type ObjectSettings = {
  rotationSpeed: number;
  rotationDirection: RotationDirection;
  angleX: number;
  angleY: number;
  zoom: number;
  autoRotate: boolean;
  orbitEnabled: boolean;
};

export type ModelSettings = GlobalViewSettings & ObjectSettings;

export const GLOBAL_VIEW_KEYS = [
  "displayMode",
  "depthColors",
  "invertDepthColors",
  "pointSize",
  "lineWidth",
  "autoCycle",
  "autoCycleSeconds",
] as const satisfies readonly (keyof GlobalViewSettings)[];

export const OBJECT_SETTING_KEYS = [
  "rotationSpeed",
  "rotationDirection",
  "angleX",
  "angleY",
  "zoom",
  "autoRotate",
  "orbitEnabled",
] as const satisfies readonly (keyof ObjectSettings)[];

export type ObjectSource =
  | { kind: "demo"; id: DemoId; label: string }
  | { kind: "file"; id: string; label: string; url: string; fileName: string };

export type DemoId =
  | "tripode"
  | "tripode-case"
  | "necker-cube"
  | "tetrahedron"
  | "open-frame"
  | "torus-knot"
  | "octahedron"
  | "dodecahedron"
  | "icosahedron"
  | "sphere"
  | "cone"
  | "cylinder"
  | "capsule"
  | "torus"
  | "pyramid"
  | "stellated-tetra"
  | "helix"
  | "mobius"
  | "cross"
  | "stairs"
  | "ring-cubes"
  | "crystal"
  | "arrow"
  | "face-janus"
  | "face-mask"
  | "face-robot"
  | "face-cat"
  | "head-bust"
  | "guitar"
  | "piano"
  | "drum"
  | "trumpet"
  | "violin"
  | "saxophone"
  | "headphones"
  | "raspberry-pi"
  | "arduino";

/** Built-in default model (bundled OBJ in /public/models) */
export const DEFAULT_DEMO_ID: DemoId = "tripode";

export const TRIPODE_ASSET = {
  url: "/models/tripode_ori_v2.obj",
  fileName: "tripode_ori_v2.obj",
} as const;

export const TRIPODE_CASE_ASSET = {
  url: "/models/Tripode_case_closed_rebaked.obj",
  fileName: "Tripode_case_closed_rebaked.obj",
} as const;

export const EXTERNAL_ASSETS = {
  guitar: { url: "/models/guitar.glb", fileName: "guitar.glb" },
  piano: { url: "/models/piano.glb", fileName: "piano.glb" },
  drum: { url: "/models/drum.glb", fileName: "drum.glb" },
  trumpet: { url: "/models/trumpet.glb", fileName: "trumpet.glb" },
  violin: { url: "/models/violin.glb", fileName: "violin.glb" },
  saxophone: { url: "/models/saxophone.glb", fileName: "saxophone.glb" },
  headphones: { url: "/models/headphones.glb", fileName: "headphones.glb" },
  "raspberry-pi": {
    url: "/models/raspberry-pi.stl",
    fileName: "raspberry-pi.stl",
  },
  arduino: { url: "/models/arduino.glb", fileName: "arduino.glb" },
} as const;

export const DEFAULT_GLOBAL_VIEW: GlobalViewSettings = {
  displayMode: "points",
  depthColors: false,
  invertDepthColors: false,
  pointSize: 2.5,
  lineWidth: 1,
  autoCycle: false,
  autoCycleSeconds: 8,
};

export const DEFAULT_OBJECT_SETTINGS: ObjectSettings = {
  rotationSpeed: 0.4,
  rotationDirection: 1,
  angleX: 35.264,
  angleY: 45,
  zoom: 1,
  autoRotate: true,
  orbitEnabled: true,
};

export const DEFAULT_SETTINGS: ModelSettings = {
  ...DEFAULT_GLOBAL_VIEW,
  ...DEFAULT_OBJECT_SETTINGS,
};

export const STORAGE_KEY = "iso_tricks:settings";
export const GLOBAL_VIEW_STORAGE_KEY = "iso_tricks:view";
export const LAST_SOURCE_STORAGE_KEY = "iso_tricks:last_source";
