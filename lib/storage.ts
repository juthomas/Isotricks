import { DEFAULT_SETTINGS, STORAGE_KEY, type ModelSettings } from "./types";

type SettingsMap = Record<string, ModelSettings>;

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
    if (event.key === STORAGE_KEY || event.key === null) {
      onStoreChange();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(onStoreChange);
    window.removeEventListener("storage", onStorage);
  };
}

/** Stable string snapshot for useSyncExternalStore (SSR-safe server snapshot is separate). */
export function getSettingsSnapshot(objectKey: string): string {
  if (!canUseStorage()) {
    return JSON.stringify({ v: 0, key: objectKey, s: null });
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const all = raw ? (JSON.parse(raw) as SettingsMap) : {};
    const saved = all[objectKey] ?? null;
    return JSON.stringify({ v: writeVersion, key: objectKey, s: saved });
  } catch {
    return JSON.stringify({ v: writeVersion, key: objectKey, s: null });
  }
}

export function getSettingsServerSnapshot(objectKey: string): string {
  return JSON.stringify({ v: 0, key: objectKey, s: null });
}

export function parseSettingsSnapshot(snapshot: string): ModelSettings {
  try {
    const parsed = JSON.parse(snapshot) as {
      s: Partial<ModelSettings> | null;
    };
    if (!parsed.s) return { ...DEFAULT_SETTINGS };
    return { ...DEFAULT_SETTINGS, ...parsed.s };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function loadAllSettings(): SettingsMap {
  if (!canUseStorage()) return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as SettingsMap;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function loadSettings(objectKey: string): ModelSettings {
  const all = loadAllSettings();
  const saved = all[objectKey];
  if (!saved) return { ...DEFAULT_SETTINGS };
  return { ...DEFAULT_SETTINGS, ...saved };
}

export function saveSettings(objectKey: string, settings: ModelSettings): void {
  if (!canUseStorage()) return;
  try {
    const all = loadAllSettings();
    all[objectKey] = settings;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
    emitSettingsChange();
  } catch {
    // Ignore quota / private mode errors
  }
}

export function fileObjectKey(fileName: string, fileSize: number): string {
  return `file:${fileName}:${fileSize}`;
}

export function demoObjectKey(demoId: string): string {
  return `demo:${demoId}`;
}
