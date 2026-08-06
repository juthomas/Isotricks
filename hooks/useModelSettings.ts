"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";
import {
  getSettingsServerSnapshot,
  getSettingsSnapshot,
  parseSettingsSnapshot,
  pickGlobalView,
  pickObjectSettings,
  saveGlobalView,
  saveObjectSettings,
  subscribeSettings,
} from "@/lib/storage";
import {
  DEFAULT_OBJECT_SETTINGS,
  GLOBAL_VIEW_KEYS,
  OBJECT_SETTING_KEYS,
  type ModelSettings,
} from "@/lib/types";

function hasGlobalKeys(update: Partial<ModelSettings>): boolean {
  return GLOBAL_VIEW_KEYS.some((key) => key in update);
}

function hasObjectKeys(update: Partial<ModelSettings>): boolean {
  return OBJECT_SETTING_KEYS.some((key) => key in update);
}

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

      const writeGlobal =
        typeof update === "function" || hasGlobalKeys(update);
      const writeObject =
        typeof update === "function" || hasObjectKeys(update);

      if (writeGlobal) saveGlobalView(pickGlobalView(next));
      if (writeObject) saveObjectSettings(objectKey, pickObjectSettings(next));
    },
    [objectKey],
  );

  const resetSettings = useCallback(() => {
    // Reset only per-object camera/motion; keep project-wide view mode
    saveObjectSettings(objectKey, { ...DEFAULT_OBJECT_SETTINGS });
  }, [objectKey]);

  return { settings, setSettings, resetSettings };
}
