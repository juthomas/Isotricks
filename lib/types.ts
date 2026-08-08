export type DisplayMode = "wireframe" | "points" | "solid";

export type ColorMode = "gray" | "depth" | "texture";

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

export type GlitchMixColorKey =
  | "glitchMixWireColor"
  | "glitchMixPointsColor"
  | "glitchMixSolidColor";

/** Project-wide view prefs (shared across all models) */
export type GlobalViewSettings = {
  displayMode: DisplayMode;
  /** Base layer shading: flat gray, depth gradient, or original textures */
  colorMode: ColorMode;
  invertDepthColors: boolean;
  /** Multiplier for textured materials (1 = original) */
  textureBrightness: number;
  /** Contrast around mid-gray for textured materials (1 = original) */
  textureContrast: number;
  /** Master glitch toggle (any display mode) */
  glitch: boolean;
  /** World-space size of mix cells (larger = bigger zones) */
  glitchMixCellSize: number;
  glitchDigitalMin: number;
  glitchDigitalMax: number;
  /** Oscillation speed between min and max */
  glitchDigitalSpeed: number;
  /** Temporal rate of the effect animation */
  glitchDigitalRate: number;
  glitchDeformMin: number;
  glitchDeformMax: number;
  glitchDeformSpeed: number;
  glitchDeformRate: number;
  glitchScatterMin: number;
  glitchScatterMax: number;
  glitchScatterSpeed: number;
  glitchScatterRate: number;
  glitchTwistMin: number;
  glitchTwistMax: number;
  glitchTwistSpeed: number;
  glitchTwistRate: number;
  glitchTpMin: number;
  glitchTpMax: number;
  glitchTpSpeed: number;
  glitchTpRate: number;
  glitchChromaMin: number;
  glitchChromaMax: number;
  glitchChromaSpeed: number;
  glitchChromaRate: number;
  glitchMixWireMin: number;
  glitchMixWireMax: number;
  glitchMixWireSpeed: number;
  glitchMixWireRate: number;
  glitchMixWireColor: ColorMode;
  glitchMixPointsMin: number;
  glitchMixPointsMax: number;
  glitchMixPointsSpeed: number;
  glitchMixPointsRate: number;
  glitchMixPointsColor: ColorMode;
  /** Point size for mix-points layer only */
  glitchMixPointsSize: number;
  /** Point density % for mix-points layer only */
  glitchMixPointsDensity: number;
  glitchMixSolidMin: number;
  glitchMixSolidMax: number;
  glitchMixSolidSpeed: number;
  glitchMixSolidRate: number;
  glitchMixSolidColor: ColorMode;
  /** Brightness for mix-solid layer (esp. texture) */
  glitchMixSolidBrightness: number;
  /** Contrast for mix-solid layer (esp. texture) */
  glitchMixSolidContrast: number;
  pointSize: number;
  /** Percent of vertices to draw as points (0–100) */
  pointDensity: number;
  lineWidth: number;
  /** Cycle through built-in demos automatically */
  autoCycle: boolean;
  /** Seconds between model changes */
  autoCycleSeconds: number;
  /** Multiplier for scene clock (glitch + auto-rotate) */
  timeScale: number;
};

/** Per-object camera / motion prefs */
export type ObjectSettings = {
  rotationSpeed: number;
  rotationDirection: RotationDirection;
  /** Mix weights for the spin axis (normalized at runtime; fallback Y) */
  rotationAxisX: number;
  rotationAxisY: number;
  rotationAxisZ: number;
  /** Draw the spin axis in red in the live viewer (not exported) */
  showRotationAxis: boolean;
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

export type GlitchSpeedKey =
  | "glitchDigitalSpeed"
  | "glitchDeformSpeed"
  | "glitchScatterSpeed"
  | "glitchTwistSpeed"
  | "glitchTpSpeed"
  | "glitchChromaSpeed"
  | "glitchMixWireSpeed"
  | "glitchMixPointsSpeed"
  | "glitchMixSolidSpeed";

export type GlitchRateKey =
  | "glitchDigitalRate"
  | "glitchDeformRate"
  | "glitchScatterRate"
  | "glitchTwistRate"
  | "glitchTpRate"
  | "glitchChromaRate"
  | "glitchMixWireRate"
  | "glitchMixPointsRate"
  | "glitchMixSolidRate";

export const GLITCH_EFFECTS: {
  id: GlitchEffectId;
  label: string;
  minKey: GlitchRangeKey;
  maxKey: GlitchRangeKey;
  speedKey: GlitchSpeedKey;
  rateKey: GlitchRateKey;
  colorKey?: GlitchMixColorKey;
  phase: number;
}[] = [
  {
    id: "digital",
    label: "Digital",
    minKey: "glitchDigitalMin",
    maxKey: "glitchDigitalMax",
    speedKey: "glitchDigitalSpeed",
    rateKey: "glitchDigitalRate",
    phase: 0.4,
  },
  {
    id: "deform",
    label: "Deform",
    minKey: "glitchDeformMin",
    maxKey: "glitchDeformMax",
    speedKey: "glitchDeformSpeed",
    rateKey: "glitchDeformRate",
    phase: 1.1,
  },
  {
    id: "scatter",
    label: "Scatter",
    minKey: "glitchScatterMin",
    maxKey: "glitchScatterMax",
    speedKey: "glitchScatterSpeed",
    rateKey: "glitchScatterRate",
    phase: 2.2,
  },
  {
    id: "twist",
    label: "Twist",
    minKey: "glitchTwistMin",
    maxKey: "glitchTwistMax",
    speedKey: "glitchTwistSpeed",
    rateKey: "glitchTwistRate",
    phase: 3.0,
  },
  {
    id: "tp",
    label: "TP",
    minKey: "glitchTpMin",
    maxKey: "glitchTpMax",
    speedKey: "glitchTpSpeed",
    rateKey: "glitchTpRate",
    phase: 3.7,
  },
  {
    id: "chroma",
    label: "Chroma",
    minKey: "glitchChromaMin",
    maxKey: "glitchChromaMax",
    speedKey: "glitchChromaSpeed",
    rateKey: "glitchChromaRate",
    phase: 4.5,
  },
  {
    id: "mixWire",
    label: "Mix wire",
    minKey: "glitchMixWireMin",
    maxKey: "glitchMixWireMax",
    speedKey: "glitchMixWireSpeed",
    rateKey: "glitchMixWireRate",
    colorKey: "glitchMixWireColor",
    phase: 5.2,
  },
  {
    id: "mixPoints",
    label: "Mix points",
    minKey: "glitchMixPointsMin",
    maxKey: "glitchMixPointsMax",
    speedKey: "glitchMixPointsSpeed",
    rateKey: "glitchMixPointsRate",
    colorKey: "glitchMixPointsColor",
    phase: 6.1,
  },
  {
    id: "mixSolid",
    label: "Mix solid",
    minKey: "glitchMixSolidMin",
    maxKey: "glitchMixSolidMax",
    speedKey: "glitchMixSolidSpeed",
    rateKey: "glitchMixSolidRate",
    colorKey: "glitchMixSolidColor",
    phase: 7.0,
  },
];

export const COLOR_MODES: { id: ColorMode; label: string }[] = [
  { id: "gray", label: "Gray" },
  { id: "depth", label: "Depth" },
  { id: "texture", label: "Texture" },
];

export function usesDepthColor(settings: GlobalViewSettings): boolean {
  if (settings.colorMode === "depth") return true;
  if (!settings.glitch) return false;
  return (
    settings.glitchMixWireColor === "depth" ||
    settings.glitchMixPointsColor === "depth" ||
    settings.glitchMixSolidColor === "depth"
  );
}

export function usesTextureColor(settings: GlobalViewSettings): boolean {
  if (settings.colorMode === "texture") return true;
  if (!settings.glitch) return false;
  return (
    settings.glitchMixWireColor === "texture" ||
    settings.glitchMixPointsColor === "texture" ||
    settings.glitchMixSolidColor === "texture"
  );
}

export const GLOBAL_VIEW_KEYS = [
  "displayMode",
  "colorMode",
  "invertDepthColors",
  "textureBrightness",
  "textureContrast",
  "glitch",
  "glitchMixCellSize",
  "glitchDigitalMin",
  "glitchDigitalMax",
  "glitchDigitalSpeed",
  "glitchDigitalRate",
  "glitchDeformMin",
  "glitchDeformMax",
  "glitchDeformSpeed",
  "glitchDeformRate",
  "glitchScatterMin",
  "glitchScatterMax",
  "glitchScatterSpeed",
  "glitchScatterRate",
  "glitchTwistMin",
  "glitchTwistMax",
  "glitchTwistSpeed",
  "glitchTwistRate",
  "glitchTpMin",
  "glitchTpMax",
  "glitchTpSpeed",
  "glitchTpRate",
  "glitchChromaMin",
  "glitchChromaMax",
  "glitchChromaSpeed",
  "glitchChromaRate",
  "glitchMixWireMin",
  "glitchMixWireMax",
  "glitchMixWireSpeed",
  "glitchMixWireRate",
  "glitchMixWireColor",
  "glitchMixPointsMin",
  "glitchMixPointsMax",
  "glitchMixPointsSpeed",
  "glitchMixPointsRate",
  "glitchMixPointsColor",
  "glitchMixPointsSize",
  "glitchMixPointsDensity",
  "glitchMixSolidMin",
  "glitchMixSolidMax",
  "glitchMixSolidSpeed",
  "glitchMixSolidRate",
  "glitchMixSolidColor",
  "glitchMixSolidBrightness",
  "glitchMixSolidContrast",
  "pointSize",
  "pointDensity",
  "lineWidth",
  "autoCycle",
  "autoCycleSeconds",
  "timeScale",
] as const satisfies readonly (keyof GlobalViewSettings)[];

export const OBJECT_SETTING_KEYS = [
  "rotationSpeed",
  "rotationDirection",
  "rotationAxisX",
  "rotationAxisY",
  "rotationAxisZ",
  "showRotationAxis",
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
  colorMode: "gray",
  invertDepthColors: false,
  textureBrightness: 1,
  textureContrast: 1,
  glitch: false,
  glitchMixCellSize: 0.15,
  glitchDigitalMin: 0.55,
  glitchDigitalMax: 0.55,
  glitchDigitalSpeed: 0.6,
  glitchDigitalRate: 1,
  glitchDeformMin: 0,
  glitchDeformMax: 0,
  glitchDeformSpeed: 0.6,
  glitchDeformRate: 1,
  glitchScatterMin: 0,
  glitchScatterMax: 0,
  glitchScatterSpeed: 0.6,
  glitchScatterRate: 1,
  glitchTwistMin: 0,
  glitchTwistMax: 0,
  glitchTwistSpeed: 0.6,
  glitchTwistRate: 1,
  glitchTpMin: 0,
  glitchTpMax: 0,
  glitchTpSpeed: 0.6,
  glitchTpRate: 1,
  glitchChromaMin: 0,
  glitchChromaMax: 0,
  glitchChromaSpeed: 0.6,
  glitchChromaRate: 1,
  glitchMixWireMin: 0,
  glitchMixWireMax: 0,
  glitchMixWireSpeed: 0.6,
  glitchMixWireRate: 1,
  glitchMixWireColor: "gray",
  glitchMixPointsMin: 0,
  glitchMixPointsMax: 0,
  glitchMixPointsSpeed: 0.6,
  glitchMixPointsRate: 1,
  glitchMixPointsColor: "gray",
  glitchMixPointsSize: 2,
  glitchMixPointsDensity: 100,
  glitchMixSolidMin: 0,
  glitchMixSolidMax: 0,
  glitchMixSolidSpeed: 0.6,
  glitchMixSolidRate: 1,
  glitchMixSolidColor: "gray",
  glitchMixSolidBrightness: 1,
  glitchMixSolidContrast: 1,
  pointSize: 2,
  pointDensity: 100,
  lineWidth: 1,
  autoCycle: false,
  autoCycleSeconds: 8,
  timeScale: 1,
};

export const DEFAULT_OBJECT_SETTINGS: ObjectSettings = {
  rotationSpeed: 0.4,
  rotationDirection: 1,
  rotationAxisX: 0,
  rotationAxisY: 1,
  rotationAxisZ: 0,
  showRotationAxis: false,
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
  uGlitchDigitalRate: { value: number };
  uGlitchDeformRate: { value: number };
  uGlitchScatterRate: { value: number };
  uGlitchTwistRate: { value: number };
  uGlitchTpRate: { value: number };
  uGlitchChromaRate: { value: number };
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
    | "glitchMixCellSize"
    | GlitchRangeKey
    | GlitchSpeedKey
    | GlitchRateKey
  >,
  time: number,
): void {
  gu.uGlitchTime.value = time;
  const cellSize = Math.min(20, Math.max(0.001, settings.glitchMixCellSize));
  gu.uMixScale.value = 1 / cellSize;

  const mixFlickerRate = Math.max(
    settings.glitchMixWireRate,
    settings.glitchMixPointsRate,
    settings.glitchMixSolidRate,
  );
  gu.uMixFlicker.value = 1.5 + Math.min(3, Math.max(0, mixFlickerRate)) * 6;

  gu.uGlitchDigitalRate.value = Math.min(
    3,
    Math.max(0, settings.glitchDigitalRate),
  );
  gu.uGlitchDeformRate.value = Math.min(
    3,
    Math.max(0, settings.glitchDeformRate),
  );
  gu.uGlitchScatterRate.value = Math.min(
    3,
    Math.max(0, settings.glitchScatterRate),
  );
  gu.uGlitchTwistRate.value = Math.min(3, Math.max(0, settings.glitchTwistRate));
  gu.uGlitchTpRate.value = Math.min(3, Math.max(0, settings.glitchTpRate));
  gu.uGlitchChromaRate.value = Math.min(
    3,
    Math.max(0, settings.glitchChromaRate),
  );

  for (const fx of GLITCH_EFFECTS) {
    const speed = Math.min(3, Math.max(0, settings[fx.speedKey]));
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
