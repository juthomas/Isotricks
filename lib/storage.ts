import {
  DEFAULT_GLOBAL_VIEW,
  DEFAULT_OBJECT_SETTINGS,
  DEFAULT_SETTINGS,
  GLOBAL_VIEW_STORAGE_KEY,
  LAST_SOURCE_STORAGE_KEY,
  STORAGE_KEY,
  type GlobalViewSettings,
  type ModelSettings,
  type ObjectSettings,
} from "./types";

type SettingsMap = Record<string, Partial<ObjectSettings>>;

const listeners = new Set<() => void>();
let writeVersion = 0;

function canUseStorage(): boolean {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

function emitSettingsChange(): void {
  writeVersion += 1;
  listeners.forEach((listener) => listener());
}

export function subscribeSettings(onStoreChange: () => void): () => void {
  listeners.add(onStoreChange);
  const onStorage = (event: StorageEvent) => {
    if (
      event.key === STORAGE_KEY ||
      event.key === GLOBAL_VIEW_STORAGE_KEY ||
      event.key === null
    ) {
      onStoreChange();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(onStoreChange);
    window.removeEventListener("storage", onStorage);
  };
}

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

/** Convert legacy single intensity / boolean into min=max range. */
function legacyToRange(
  value: unknown,
  fallback: number,
  glitchMode: unknown,
  modeName: string,
  legacyAmt: number,
): { min: number; max: number } {
  if (typeof value === "number" && Number.isFinite(value)) {
    const v = clamp01(value);
    return { min: v, max: v };
  }
  if (typeof value === "boolean") {
    const v = value ? clamp01(legacyAmt) : 0;
    return { min: v, max: v };
  }
  if (typeof glitchMode === "string") {
    const on =
      glitchMode === modeName ||
      (glitchMode === "twist" && (modeName === "twist" || modeName === "tp"));
    const v = on ? clamp01(legacyAmt) : 0;
    return { min: v, max: v };
  }
  const v = clamp01(fallback);
  return { min: v, max: v };
}

function readRange(
  parsed: Record<string, unknown>,
  minKey: string,
  maxKey: string,
  legacyKey: string,
  modeName: string,
  legacyAmt: number,
  defaults: { min: number; max: number },
): { min: number; max: number } {
  const minRaw = parsed[minKey];
  const maxRaw = parsed[maxKey];
  if (
    typeof minRaw === "number" &&
    typeof maxRaw === "number" &&
    Number.isFinite(minRaw) &&
    Number.isFinite(maxRaw)
  ) {
    const a = clamp01(minRaw);
    const b = clamp01(maxRaw);
    return { min: Math.min(a, b), max: Math.max(a, b) };
  }
  return legacyToRange(
    parsed[legacyKey],
    defaults.min,
    parsed.glitchMode,
    modeName,
    legacyAmt,
  );
}

function loadGlobalView(): GlobalViewSettings {
  if (!canUseStorage()) return { ...DEFAULT_GLOBAL_VIEW };
  try {
    const raw = localStorage.getItem(GLOBAL_VIEW_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_GLOBAL_VIEW };
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const legacyAmt =
      typeof parsed.glitchIntensity === "number"
        ? parsed.glitchIntensity
        : 0.55;

    const digital = readRange(
      parsed,
      "glitchDigitalMin",
      "glitchDigitalMax",
      "glitchDigital",
      "digital",
      legacyAmt,
      {
        min: DEFAULT_GLOBAL_VIEW.glitchDigitalMin,
        max: DEFAULT_GLOBAL_VIEW.glitchDigitalMax,
      },
    );
    const deform = readRange(
      parsed,
      "glitchDeformMin",
      "glitchDeformMax",
      "glitchDeform",
      "deform",
      legacyAmt,
      {
        min: DEFAULT_GLOBAL_VIEW.glitchDeformMin,
        max: DEFAULT_GLOBAL_VIEW.glitchDeformMax,
      },
    );
    const scatter = readRange(
      parsed,
      "glitchScatterMin",
      "glitchScatterMax",
      "glitchScatter",
      "scatter",
      legacyAmt,
      {
        min: DEFAULT_GLOBAL_VIEW.glitchScatterMin,
        max: DEFAULT_GLOBAL_VIEW.glitchScatterMax,
      },
    );
    const twist = readRange(
      parsed,
      "glitchTwistMin",
      "glitchTwistMax",
      "glitchTwist",
      "twist",
      legacyAmt,
      {
        min: DEFAULT_GLOBAL_VIEW.glitchTwistMin,
        max: DEFAULT_GLOBAL_VIEW.glitchTwistMax,
      },
    );
    const tp = readRange(
      parsed,
      "glitchTpMin",
      "glitchTpMax",
      "glitchTp",
      "tp",
      legacyAmt,
      { min: DEFAULT_GLOBAL_VIEW.glitchTpMin, max: DEFAULT_GLOBAL_VIEW.glitchTpMax },
    );
    const chroma = readRange(
      parsed,
      "glitchChromaMin",
      "glitchChromaMax",
      "glitchChroma",
      "chroma",
      legacyAmt,
      {
        min: DEFAULT_GLOBAL_VIEW.glitchChromaMin,
        max: DEFAULT_GLOBAL_VIEW.glitchChromaMax,
      },
    );
    const mixWire = readRange(
      parsed,
      "glitchMixWireMin",
      "glitchMixWireMax",
      "glitchMixWire",
      "mixWire",
      legacyAmt,
      {
        min: DEFAULT_GLOBAL_VIEW.glitchMixWireMin,
        max: DEFAULT_GLOBAL_VIEW.glitchMixWireMax,
      },
    );
    const mixPoints = readRange(
      parsed,
      "glitchMixPointsMin",
      "glitchMixPointsMax",
      "glitchMixPoints",
      "mixPoints",
      legacyAmt,
      {
        min: DEFAULT_GLOBAL_VIEW.glitchMixPointsMin,
        max: DEFAULT_GLOBAL_VIEW.glitchMixPointsMax,
      },
    );
    const mixSolid = readRange(
      parsed,
      "glitchMixSolidMin",
      "glitchMixSolidMax",
      "glitchMixSolid",
      "mixSolid",
      legacyAmt,
      {
        min: DEFAULT_GLOBAL_VIEW.glitchMixSolidMin,
        max: DEFAULT_GLOBAL_VIEW.glitchMixSolidMax,
      },
    );

    const {
      glitchMode: _gm,
      glitchIntensity: _gi,
      glitchDigital: _gd,
      glitchDeform: _gde,
      glitchScatter: _gsc,
      glitchTwist: _gtw,
      glitchTp: _gtp,
      glitchChroma: _gch,
      glitchDigitalMin: _dmin,
      glitchDigitalMax: _dmax,
      glitchDeformMin: _demin,
      glitchDeformMax: _demax,
      glitchScatterMin: _scmin,
      glitchScatterMax: _scmax,
      glitchTwistMin: _twmin,
      glitchTwistMax: _twmax,
      glitchTpMin: _tpmin,
      glitchTpMax: _tpmax,
      glitchChromaMin: _chmin,
      glitchChromaMax: _chmax,
      glitchMixWireMin: _mwmin,
      glitchMixWireMax: _mwmax,
      glitchMixPointsMin: _mpmin,
      glitchMixPointsMax: _mpmax,
      glitchMixSolidMin: _msmin,
      glitchMixSolidMax: _msmax,
      ...rest
    } = parsed;
    void _gm;
    void _gi;
    void _gd;
    void _gde;
    void _gsc;
    void _gtw;
    void _gtp;
    void _gch;
    void _dmin;
    void _dmax;
    void _demin;
    void _demax;
    void _scmin;
    void _scmax;
    void _twmin;
    void _twmax;
    void _tpmin;
    void _tpmax;
    void _chmin;
    void _chmax;
    void _mwmin;
    void _mwmax;
    void _mpmin;
    void _mpmax;
    void _msmin;
    void _msmax;

    return {
      ...DEFAULT_GLOBAL_VIEW,
      ...(rest as Partial<GlobalViewSettings>),
      glitchDigitalMin: digital.min,
      glitchDigitalMax: digital.max,
      glitchDeformMin: deform.min,
      glitchDeformMax: deform.max,
      glitchScatterMin: scatter.min,
      glitchScatterMax: scatter.max,
      glitchTwistMin: twist.min,
      glitchTwistMax: twist.max,
      glitchTpMin: tp.min,
      glitchTpMax: tp.max,
      glitchChromaMin: chroma.min,
      glitchChromaMax: chroma.max,
      glitchMixWireMin: mixWire.min,
      glitchMixWireMax: mixWire.max,
      glitchMixPointsMin: mixPoints.min,
      glitchMixPointsMax: mixPoints.max,
      glitchMixSolidMin: mixSolid.min,
      glitchMixSolidMax: mixSolid.max,
      glitchMixCellSize:
        typeof parsed.glitchMixCellSize === "number" &&
        Number.isFinite(parsed.glitchMixCellSize)
          ? Math.min(5, Math.max(0.001, parsed.glitchMixCellSize))
          : DEFAULT_GLOBAL_VIEW.glitchMixCellSize,
      ...(() => {
        const legacySpeed =
          typeof parsed.glitchSpeed === "number" &&
          Number.isFinite(parsed.glitchSpeed)
            ? Math.min(3, Math.max(0, parsed.glitchSpeed))
            : DEFAULT_GLOBAL_VIEW.glitchDigitalSpeed;
        const readSpeed = (key: string): number => {
          const v = parsed[key];
          if (typeof v === "number" && Number.isFinite(v)) {
            return Math.min(3, Math.max(0, v));
          }
          return legacySpeed;
        };
        return {
          glitchDigitalSpeed: readSpeed("glitchDigitalSpeed"),
          glitchDeformSpeed: readSpeed("glitchDeformSpeed"),
          glitchScatterSpeed: readSpeed("glitchScatterSpeed"),
          glitchTwistSpeed: readSpeed("glitchTwistSpeed"),
          glitchTpSpeed: readSpeed("glitchTpSpeed"),
          glitchChromaSpeed: readSpeed("glitchChromaSpeed"),
          glitchMixWireSpeed: readSpeed("glitchMixWireSpeed"),
          glitchMixPointsSpeed: readSpeed("glitchMixPointsSpeed"),
          glitchMixSolidSpeed: readSpeed("glitchMixSolidSpeed"),
        };
      })(),
    };
  } catch {
    return { ...DEFAULT_GLOBAL_VIEW };
  }
}

function loadObjectSettings(objectKey: string): ObjectSettings {
  if (!canUseStorage()) return { ...DEFAULT_OBJECT_SETTINGS };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const all = raw ? (JSON.parse(raw) as SettingsMap) : {};
    const saved = all[objectKey];
    if (!saved) return { ...DEFAULT_OBJECT_SETTINGS };
    // Strip legacy global fields if present in old saves
    const {
      displayMode: _d,
      depthColors: _dc,
      invertDepthColors: _i,
      glitch: _g,
      glitchSpeed: _gs,
      glitchDigital: _gd,
      glitchDeform: _gde,
      glitchScatter: _gsc,
      glitchTwist: _gtw,
      glitchTp: _gtp,
      glitchChroma: _gch,
      glitchMode: _gm,
      glitchIntensity: _gi,
      pointSize: _p,
      pointDensity: _pd,
      lineWidth: _l,
      ...objectOnly
    } = saved as Record<string, unknown>;
    void _d;
    void _dc;
    void _i;
    void _g;
    void _gs;
    void _gd;
    void _gde;
    void _gsc;
    void _gtw;
    void _gtp;
    void _gch;
    void _gm;
    void _gi;
    void _p;
    void _pd;
    void _l;
    return {
      ...DEFAULT_OBJECT_SETTINGS,
      ...(objectOnly as Partial<ObjectSettings>),
    };
  } catch {
    return { ...DEFAULT_OBJECT_SETTINGS };
  }
}

/** Combined snapshot for useSyncExternalStore */
export function getSettingsSnapshot(objectKey: string): string {
  if (!canUseStorage()) {
    return JSON.stringify({
      v: 0,
      key: objectKey,
      global: null,
      object: null,
    });
  }
  try {
    const global = loadGlobalView();
    const object = loadObjectSettings(objectKey);
    return JSON.stringify({
      v: writeVersion,
      key: objectKey,
      global,
      object,
    });
  } catch {
    return JSON.stringify({
      v: writeVersion,
      key: objectKey,
      global: null,
      object: null,
    });
  }
}

export function getSettingsServerSnapshot(objectKey: string): string {
  return JSON.stringify({
    v: 0,
    key: objectKey,
    global: null,
    object: null,
  });
}

export function parseSettingsSnapshot(snapshot: string): ModelSettings {
  try {
    const parsed = JSON.parse(snapshot) as {
      global: Partial<GlobalViewSettings> | null;
      object: Partial<ObjectSettings> | null;
    };
    return {
      ...DEFAULT_SETTINGS,
      ...(parsed.global ?? {}),
      ...(parsed.object ?? {}),
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveGlobalView(settings: GlobalViewSettings): void {
  if (!canUseStorage()) return;
  try {
    localStorage.setItem(GLOBAL_VIEW_STORAGE_KEY, JSON.stringify(settings));
    emitSettingsChange();
  } catch {
    // Ignore quota / private mode errors
  }
}

export function saveObjectSettings(
  objectKey: string,
  settings: ObjectSettings,
): void {
  if (!canUseStorage()) return;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const all = raw ? (JSON.parse(raw) as SettingsMap) : {};
    all[objectKey] = settings;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
    emitSettingsChange();
  } catch {
    // Ignore quota / private mode errors
  }
}

export function pickGlobalView(settings: ModelSettings): GlobalViewSettings {
  return {
    displayMode: settings.displayMode,
    depthColors: settings.depthColors,
    invertDepthColors: settings.invertDepthColors,
    glitch: settings.glitch,
    glitchMixCellSize: settings.glitchMixCellSize,
    glitchDigitalMin: settings.glitchDigitalMin,
    glitchDigitalMax: settings.glitchDigitalMax,
    glitchDigitalSpeed: settings.glitchDigitalSpeed,
    glitchDeformMin: settings.glitchDeformMin,
    glitchDeformMax: settings.glitchDeformMax,
    glitchDeformSpeed: settings.glitchDeformSpeed,
    glitchScatterMin: settings.glitchScatterMin,
    glitchScatterMax: settings.glitchScatterMax,
    glitchScatterSpeed: settings.glitchScatterSpeed,
    glitchTwistMin: settings.glitchTwistMin,
    glitchTwistMax: settings.glitchTwistMax,
    glitchTwistSpeed: settings.glitchTwistSpeed,
    glitchTpMin: settings.glitchTpMin,
    glitchTpMax: settings.glitchTpMax,
    glitchTpSpeed: settings.glitchTpSpeed,
    glitchChromaMin: settings.glitchChromaMin,
    glitchChromaMax: settings.glitchChromaMax,
    glitchChromaSpeed: settings.glitchChromaSpeed,
    glitchMixWireMin: settings.glitchMixWireMin,
    glitchMixWireMax: settings.glitchMixWireMax,
    glitchMixWireSpeed: settings.glitchMixWireSpeed,
    glitchMixPointsMin: settings.glitchMixPointsMin,
    glitchMixPointsMax: settings.glitchMixPointsMax,
    glitchMixPointsSpeed: settings.glitchMixPointsSpeed,
    glitchMixSolidMin: settings.glitchMixSolidMin,
    glitchMixSolidMax: settings.glitchMixSolidMax,
    glitchMixSolidSpeed: settings.glitchMixSolidSpeed,
    pointSize: settings.pointSize,
    pointDensity: settings.pointDensity,
    lineWidth: settings.lineWidth,
    autoCycle: settings.autoCycle,
    autoCycleSeconds: settings.autoCycleSeconds,
    timeScale: settings.timeScale,
  };
}

export function pickObjectSettings(settings: ModelSettings): ObjectSettings {
  return {
    rotationSpeed: settings.rotationSpeed,
    rotationDirection: settings.rotationDirection,
    angleX: settings.angleX,
    angleY: settings.angleY,
    zoom: settings.zoom,
    autoRotate: settings.autoRotate,
    orbitEnabled: settings.orbitEnabled,
  };
}

export function fileObjectKey(fileName: string, fileSize: number): string {
  return `file:${fileName}:${fileSize}`;
}

export function demoObjectKey(demoId: string): string {
  return `demo:${demoId}`;
}

export function userModelObjectKey(modelId: string): string {
  return `file:${modelId}`;
}

type PersistedSource =
  | { kind: "demo"; id: string }
  | { kind: "file"; id: string };

export function saveLastSource(source: {
  kind: "demo" | "file";
  id: string;
}): void {
  if (!canUseStorage()) return;
  try {
    const payload: PersistedSource = { kind: source.kind, id: source.id };
    localStorage.setItem(LAST_SOURCE_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Ignore
  }
}

export function loadLastSource(): PersistedSource | null {
  if (!canUseStorage()) return null;
  try {
    const raw = localStorage.getItem(LAST_SOURCE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedSource;
    if (
      parsed &&
      (parsed.kind === "demo" || parsed.kind === "file") &&
      typeof parsed.id === "string"
    ) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}
