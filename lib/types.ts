export type DisplayMode = "wireframe" | "points" | "solid";

export type RotationDirection = 1 | -1 | 0;

export type GlitchEffectId =
  | "digital"
  | "deform"
  | "scatter"
  | "twist"
  | "tp"
  | "chroma"
  | "mixWire"
  | "mixPoints"
  | "mixSolid";

/** Project-wide view prefs (shared across all models) */
export type GlobalViewSettings = {
  displayMode: DisplayMode;
  depthColors: boolean;
  invertDepthColors: boolean;
  /** Master glitch toggle (any display mode) */
  glitch: boolean;
  /** How fast effect amounts travel within their min–max range */
  glitchSpeed: number;
  /** World-space size of mix cells (larger = bigger zones) */
  glitchMixCellSize: number;
  glitchDigitalMin: number;
  glitchDigitalMax: number;
  glitchDeformMin: number;
  glitchDeformMax: number;
  glitchScatterMin: number;
  glitchScatterMax: number;
  glitchTwistMin: number;
  glitchTwistMax: number;
  glitchTpMin: number;
  glitchTpMax: number;
  glitchChromaMin: number;
  glitchChromaMax: number;
  glitchMixWireMin: number;
  glitchMixWireMax: number;
  glitchMixPointsMin: number;
  glitchMixPointsMax: number;
  glitchMixSolidMin: number;
  glitchMixSolidMax: number;
  pointSize: number;
  /** Percent of vertices to draw as points (0–100) */
  pointDensity: number;
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

export type GlitchRangeKey =
  | "glitchDigitalMin"
  | "glitchDigitalMax"
  | "glitchDeformMin"
  | "glitchDeformMax"
  | "glitchScatterMin"
  | "glitchScatterMax"
  | "glitchTwistMin"
  | "glitchTwistMax"
  | "glitchTpMin"
  | "glitchTpMax"
  | "glitchChromaMin"
  | "glitchChromaMax"
  | "glitchMixWireMin"
  | "glitchMixWireMax"
  | "glitchMixPointsMin"
  | "glitchMixPointsMax"
  | "glitchMixSolidMin"
  | "glitchMixSolidMax";

export const GLITCH_EFFECTS: {
  id: GlitchEffectId;
  label: string;
  minKey: GlitchRangeKey;
  maxKey: GlitchRangeKey;
  phase: number;
}[] = [
  {
    id: "digital",
    label: "Digital",
    minKey: "glitchDigitalMin",
    maxKey: "glitchDigitalMax",
    phase: 0.4,
  },
  {
    id: "deform",
    label: "Deform",
    minKey: "glitchDeformMin",
    maxKey: "glitchDeformMax",
    phase: 1.1,
  },
  {
    id: "scatter",
    label: "Scatter",
    minKey: "glitchScatterMin",
    maxKey: "glitchScatterMax",
    phase: 2.2,
  },
  {
    id: "twist",
    label: "Twist",
    minKey: "glitchTwistMin",
    maxKey: "glitchTwistMax",
    phase: 3.0,
  },
  {
    id: "tp",
    label: "TP",
    minKey: "glitchTpMin",
    maxKey: "glitchTpMax",
    phase: 3.7,
  },
  {
    id: "chroma",
    label: "Chroma",
    minKey: "glitchChromaMin",
    maxKey: "glitchChromaMax",
    phase: 4.5,
  },
  {
    id: "mixWire",
    label: "Mix wire",
    minKey: "glitchMixWireMin",
    maxKey: "glitchMixWireMax",
    phase: 5.2,
  },
  {
    id: "mixPoints",
    label: "Mix points",
    minKey: "glitchMixPointsMin",
    maxKey: "glitchMixPointsMax",
    phase: 6.1,
  },
  {
    id: "mixSolid",
    label: "Mix solid",
    minKey: "glitchMixSolidMin",
    maxKey: "glitchMixSolidMax",
    phase: 7.0,
  },
];

export const GLOBAL_VIEW_KEYS = [
  "displayMode",
  "depthColors",
  "invertDepthColors",
  "glitch",
  "glitchSpeed",
  "glitchMixCellSize",
  "glitchDigitalMin",
  "glitchDigitalMax",
  "glitchDeformMin",
  "glitchDeformMax",
  "glitchScatterMin",
  "glitchScatterMax",
  "glitchTwistMin",
  "glitchTwistMax",
  "glitchTpMin",
  "glitchTpMax",
  "glitchChromaMin",
  "glitchChromaMax",
  "glitchMixWireMin",
  "glitchMixWireMax",
  "glitchMixPointsMin",
  "glitchMixPointsMax",
  "glitchMixSolidMin",
  "glitchMixSolidMax",
  "pointSize",
  "pointDensity",
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
  glitch: false,
  glitchSpeed: 0.6,
  glitchMixCellSize: 0.15,
  glitchDigitalMin: 0.55,
  glitchDigitalMax: 0.55,
  glitchDeformMin: 0,
  glitchDeformMax: 0,
  glitchScatterMin: 0,
  glitchScatterMax: 0,
  glitchTwistMin: 0,
  glitchTwistMax: 0,
  glitchTpMin: 0,
  glitchTpMax: 0,
  glitchChromaMin: 0,
  glitchChromaMax: 0,
  glitchMixWireMin: 0,
  glitchMixWireMax: 0,
  glitchMixPointsMin: 0,
  glitchMixPointsMax: 0,
  glitchMixSolidMin: 0,
  glitchMixSolidMax: 0,
  pointSize: 2,
  pointDensity: 100,
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

/** Animated amount in [min, max] from shared speed + per-effect phase. */
export function animateGlitchAmount(
  min: number,
  max: number,
  time: number,
  speed: number,
  phase: number,
): number {
  const lo = Math.min(1, Math.max(0, Math.min(min, max)));
  const hi = Math.min(1, Math.max(0, Math.max(min, max)));
  if (hi - lo < 1e-8) return lo;
  const t = 0.5 + 0.5 * Math.sin(time * speed * Math.PI * 2 + phase);
  return lo + (hi - lo) * t;
}

export type GlitchRuntimeUniforms = {
  uGlitchTime: { value: number };
  uGlitchDigital: { value: number };
  uGlitchDeform: { value: number };
  uGlitchScatter: { value: number };
  uGlitchTwist: { value: number };
  uGlitchTp: { value: number };
  uGlitchChroma: { value: number };
  uMixWire: { value: number };
  uMixPoints: { value: number };
  uMixSolid: { value: number };
  uMixFlicker: { value: number };
  uMixScale: { value: number };
};

export function syncGlitchUniforms(
  gu: GlitchRuntimeUniforms,
  settings: Pick<
    GlobalViewSettings,
    | "glitchSpeed"
    | "glitchMixCellSize"
    | "glitchDigitalMin"
    | "glitchDigitalMax"
    | "glitchDeformMin"
    | "glitchDeformMax"
    | "glitchScatterMin"
    | "glitchScatterMax"
    | "glitchTwistMin"
    | "glitchTwistMax"
    | "glitchTpMin"
    | "glitchTpMax"
    | "glitchChromaMin"
    | "glitchChromaMax"
    | "glitchMixWireMin"
    | "glitchMixWireMax"
    | "glitchMixPointsMin"
    | "glitchMixPointsMax"
    | "glitchMixSolidMin"
    | "glitchMixSolidMax"
  >,
  time: number,
): void {
  const speed = Math.min(3, Math.max(0, settings.glitchSpeed));
  gu.uGlitchTime.value = time;
  gu.uMixFlicker.value = 1.5 + speed * 6;
  const cellSize = Math.min(5, Math.max(0.02, settings.glitchMixCellSize));
  gu.uMixScale.value = 1 / cellSize;

  for (const fx of GLITCH_EFFECTS) {
    const v = animateGlitchAmount(
      settings[fx.minKey],
      settings[fx.maxKey],
      time,
      speed,
      fx.phase,
    );
    switch (fx.id) {
      case "digital":
        gu.uGlitchDigital.value = v;
        break;
      case "deform":
        gu.uGlitchDeform.value = v;
        break;
      case "scatter":
        gu.uGlitchScatter.value = v;
        break;
      case "twist":
        gu.uGlitchTwist.value = v;
        break;
      case "tp":
        gu.uGlitchTp.value = v;
        break;
      case "chroma":
        gu.uGlitchChroma.value = v;
        break;
      case "mixWire":
        gu.uMixWire.value = v;
        break;
      case "mixPoints":
        gu.uMixPoints.value = v;
        break;
      case "mixSolid":
        gu.uMixSolid.value = v;
        break;
    }
  }
}
