import {
  DEFAULT_SETTINGS,
  GLOBAL_VIEW_KEYS,
  OBJECT_SETTING_KEYS,
  type GlobalViewSettings,
  type ModelSettings,
  type ObjectSettings,
} from "@/lib/types";

export const SETTINGS_FILE_VERSION = 1;
export const SETTINGS_FILE_KIND = "iso_tricks_settings";

export type SettingsFilePayload = {
  version: number;
  kind: typeof SETTINGS_FILE_KIND;
  exportedAt: string;
  settings: ModelSettings;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const DISPLAY_MODES = new Set(["wireframe", "points", "solid"]);
const COLOR_MODES = new Set(["gray", "depth", "texture"]);
const ROTATION_DIRS = new Set([1, -1, 0]);

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function migrateLegacyRotationAxis(raw: Record<string, unknown>): {
  rotationAxisX: number;
  rotationAxisY: number;
  rotationAxisZ: number;
} | null {
  if (
    "rotationAxisX" in raw ||
    "rotationAxisY" in raw ||
    "rotationAxisZ" in raw
  ) {
    return null;
  }
  const legacy = raw.rotationAxis;
  if (legacy === "x") return { rotationAxisX: 1, rotationAxisY: 0, rotationAxisZ: 0 };
  if (legacy === "y") return { rotationAxisX: 0, rotationAxisY: 1, rotationAxisZ: 0 };
  if (legacy === "z") return { rotationAxisX: 0, rotationAxisY: 0, rotationAxisZ: 1 };
  return null;
}

function pickKnownSettings(raw: Record<string, unknown>): ModelSettings {
  const next: ModelSettings = { ...DEFAULT_SETTINGS };

  for (const key of GLOBAL_VIEW_KEYS) {
    if (key in raw && typeof raw[key] === typeof DEFAULT_SETTINGS[key]) {
      (next as GlobalViewSettings)[key] = raw[key] as never;
    }
  }
  for (const key of OBJECT_SETTING_KEYS) {
    if (key in raw && typeof raw[key] === typeof DEFAULT_SETTINGS[key]) {
      (next as ObjectSettings)[key] = raw[key] as never;
    }
  }

  // Legacy depthColors → colorMode
  if (!("colorMode" in raw) && raw.depthColors === true) {
    next.colorMode = "depth";
  }

  // Legacy rotationAxis enum → mix weights
  const migratedAxis = migrateLegacyRotationAxis(raw);
  if (migratedAxis) {
    next.rotationAxisX = migratedAxis.rotationAxisX;
    next.rotationAxisY = migratedAxis.rotationAxisY;
    next.rotationAxisZ = migratedAxis.rotationAxisZ;
  }

  if (!DISPLAY_MODES.has(next.displayMode)) {
    next.displayMode = DEFAULT_SETTINGS.displayMode;
  }
  if (!COLOR_MODES.has(next.colorMode)) {
    next.colorMode = DEFAULT_SETTINGS.colorMode;
  }
  if (!COLOR_MODES.has(next.glitchMixWireColor)) {
    next.glitchMixWireColor = DEFAULT_SETTINGS.glitchMixWireColor;
  }
  if (!COLOR_MODES.has(next.glitchMixPointsColor)) {
    next.glitchMixPointsColor = DEFAULT_SETTINGS.glitchMixPointsColor;
  }
  if (!COLOR_MODES.has(next.glitchMixSolidColor)) {
    next.glitchMixSolidColor = DEFAULT_SETTINGS.glitchMixSolidColor;
  }
  if (!ROTATION_DIRS.has(next.rotationDirection)) {
    next.rotationDirection = DEFAULT_SETTINGS.rotationDirection;
  }
  if (typeof next.showRotationAxis !== "boolean") {
    next.showRotationAxis = DEFAULT_SETTINGS.showRotationAxis;
  }

  next.glitchMixCellSize = clamp(next.glitchMixCellSize, 0.001, 20);
  next.textureBrightness = clamp(next.textureBrightness, 0.05, 2);
  next.textureContrast = clamp(next.textureContrast, 0.2, 2);
  next.glitchMixSolidBrightness = clamp(
    next.glitchMixSolidBrightness,
    0.05,
    2,
  );
  next.glitchMixSolidContrast = clamp(next.glitchMixSolidContrast, 0.2, 2);
  next.pointDensity = clamp(next.pointDensity, 0, 100);
  next.pointSize = clamp(next.pointSize, 1, 10);
  next.glitchMixPointsDensity = clamp(next.glitchMixPointsDensity, 0, 100);
  next.glitchMixPointsSize = clamp(next.glitchMixPointsSize, 1, 10);
  next.lineWidth = clamp(next.lineWidth, 0.5, 10);
  next.autoCycleSeconds = clamp(next.autoCycleSeconds, 1, 120);
  next.timeScale = clamp(next.timeScale, 0.00001, 4);
  next.rotationSpeed = clamp(next.rotationSpeed, 0, 5);
  next.rotationAxisX = clamp(next.rotationAxisX, -1, 1);
  next.rotationAxisY = clamp(next.rotationAxisY, -1, 1);
  next.rotationAxisZ = clamp(next.rotationAxisZ, -1, 1);
  next.zoom = clamp(next.zoom, 0.1, 10);

  for (const key of GLOBAL_VIEW_KEYS) {
    if (
      (key.endsWith("Min") ||
        key.endsWith("Max") ||
        key.endsWith("Speed") ||
        key.endsWith("Rate")) &&
      key.startsWith("glitch") &&
      typeof next[key] === "number"
    ) {
      (next as GlobalViewSettings)[key] = clamp(
        next[key] as number,
        0,
        key.endsWith("Speed") || key.endsWith("Rate") ? 5 : 1,
      ) as never;
    }
  }

  return next;
}

export function buildSettingsExport(settings: ModelSettings): SettingsFilePayload {
  return {
    version: SETTINGS_FILE_VERSION,
    kind: SETTINGS_FILE_KIND,
    exportedAt: new Date().toISOString(),
    settings: { ...settings },
  };
}

export function serializeSettings(settings: ModelSettings): string {
  return `${JSON.stringify(buildSettingsExport(settings), null, 2)}\n`;
}

export function parseSettingsImport(text: string): ModelSettings {
  const parsed: unknown = JSON.parse(text);
  if (!isRecord(parsed)) {
    throw new Error("Invalid settings file");
  }

  // Wrapped payload
  if (parsed.kind === SETTINGS_FILE_KIND && isRecord(parsed.settings)) {
    return pickKnownSettings(parsed.settings);
  }

  // Bare settings object (or older exports)
  if ("displayMode" in parsed || "glitch" in parsed || "pointSize" in parsed) {
    return pickKnownSettings(parsed);
  }

  throw new Error("Unrecognized settings file format");
}

export function downloadSettingsFile(settings: ModelSettings): void {
  const blob = new Blob([serializeSettings(settings)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
  a.href = url;
  a.download = `iso-tricks-settings-${stamp}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function readSettingsFile(file: File): Promise<ModelSettings> {
  const text = await file.text();
  return parseSettingsImport(text);
}
