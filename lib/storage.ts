import { DEFAULT_SETTINGS, STORAGE_KEY, type ModelSettings } from "./types";

type SettingsMap = Record<string, ModelSettings>;

function canUseStorage(): boolean {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
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
