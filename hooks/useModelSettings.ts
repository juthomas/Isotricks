"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { loadSettings, saveSettings } from "@/lib/storage";
import { DEFAULT_SETTINGS, type ModelSettings } from "@/lib/types";

export function useModelSettings(objectKey: string) {
  const [settings, setSettingsState] = useState<ModelSettings>(() =>
    loadSettings(objectKey),
  );
  const [activeKey, setActiveKey] = useState(objectKey);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Adjust state when the object key changes (React-recommended pattern)
  if (objectKey !== activeKey) {
    setActiveKey(objectKey);
    setSettingsState(loadSettings(objectKey));
  }

  const persist = useCallback((next: ModelSettings, key: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      saveSettings(key, next);
    }, 300);
  }, []);

  const setSettings = useCallback(
    (update: Partial<ModelSettings> | ((prev: ModelSettings) => ModelSettings)) => {
      setSettingsState((prev) => {
        const next =
          typeof update === "function" ? update(prev) : { ...prev, ...update };
        persist(next, objectKey);
        return next;
      });
    },
    [persist, objectKey],
  );

  const resetSettings = useCallback(() => {
    const next = { ...DEFAULT_SETTINGS };
    setSettingsState(next);
    persist(next, objectKey);
  }, [persist, objectKey]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  return { settings, setSettings, resetSettings };
}
