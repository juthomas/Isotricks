"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";
import {
  getSettingsServerSnapshot,
  getSettingsSnapshot,
  parseSettingsSnapshot,
  saveSettings,
  subscribeSettings,
} from "@/lib/storage";
import { DEFAULT_SETTINGS, type ModelSettings } from "@/lib/types";

export function useModelSettings(objectKey: string) {
  const snapshot = useSyncExternalStore(
    subscribeSettings,
    () => getSettingsSnapshot(objectKey),
    () => getSettingsServerSnapshot(objectKey),
  );

  const settings = useMemo(
    () => parseSettingsSnapshot(snapshot),
    [snapshot],
  );

  const setSettings = useCallback(
    (update: Partial<ModelSettings> | ((prev: ModelSettings) => ModelSettings)) => {
      const prev = parseSettingsSnapshot(getSettingsSnapshot(objectKey));
      const next =
        typeof update === "function" ? update(prev) : { ...prev, ...update };
      saveSettings(objectKey, next);
    },
    [objectKey],
  );

  const resetSettings = useCallback(() => {
    saveSettings(objectKey, { ...DEFAULT_SETTINGS });
  }, [objectKey]);

  return { settings, setSettings, resetSettings };
}
