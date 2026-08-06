"use client";

import { useEffect, useState } from "react";
import * as THREE from "three";
import { createDemoObject, getDemo } from "@/lib/demos";
import { loadModelFromUrl } from "@/lib/loaders";
import type { ObjectSource } from "@/lib/types";

export type LoadState = {
  status: "loading" | "ready" | "error";
  object: THREE.Object3D | null;
  error: string | null;
};

export function useLoadedObject(source: ObjectSource): LoadState {
  const sourceKey =
    source.kind === "demo"
      ? `demo:${source.id}`
      : `file:${source.id}:${source.url}`;

  const [state, setState] = useState<LoadState>({
    status: "loading",
    object: null,
    error: null,
  });
  const [loadedKey, setLoadedKey] = useState(sourceKey);

  // Keep the previous object visible while the next one loads (no blank flash)
  if (loadedKey !== sourceKey) {
    setLoadedKey(sourceKey);
    setState((prev) => ({
      status: "loading",
      object: prev.object,
      error: null,
    }));
  }

  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        let object: THREE.Object3D;

        if (source.kind === "demo") {
          const demo = getDemo(source.id);
          if (demo.assetUrl && demo.assetFileName) {
            object = await loadModelFromUrl(demo.assetUrl, demo.assetFileName);
          } else {
            object = createDemoObject(source.id);
          }
        } else {
          object = await loadModelFromUrl(source.url, source.fileName);
        }

        if (!cancelled) {
          setState({ status: "ready", object, error: null });
        }
      } catch (err) {
        if (!cancelled) {
          setState((prev) => ({
            status: "error",
            object: prev.object,
            error: err instanceof Error ? err.message : "Failed to load model",
          }));
        }
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
    // Intentionally keyed by sourceKey; source fields are read for that key only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceKey]);

  return state;
}
