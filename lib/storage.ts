import {
  DEFAULT_GLOBAL_VIEW,
  DEFAULT_OBJECT_SETTINGS,
  DEFAULT_SETTINGS,
  GLOBAL_VIEW_STORAGE_KEY,
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

function loadGlobalView(): GlobalViewSettings {
  if (!canUseStorage()) return { ...DEFAULT_GLOBAL_VIEW };
  try {
    const raw = localStorage.getItem(GLOBAL_VIEW_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_GLOBAL_VIEW };
    const parsed = JSON.parse(raw) as Partial<GlobalViewSettings>;
    return { ...DEFAULT_GLOBAL_VIEW, ...parsed };
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
      pointSize: _p,
      lineWidth: _l,
      ...objectOnly
    } = saved as Partial<ObjectSettings> & Partial<GlobalViewSettings>;
    void _d;
    void _dc;
    void _i;
    void _p;
    void _l;
    return { ...DEFAULT_OBJECT_SETTINGS, ...objectOnly };
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
    pointSize: settings.pointSize,
    lineWidth: settings.lineWidth,
    autoCycle: settings.autoCycle,
    autoCycleSeconds: settings.autoCycleSeconds,
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
