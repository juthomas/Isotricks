"use client";

import { useEffect, useState } from "react";
import * as THREE from "three";
import { createDemoObject } from "@/lib/demos";
import { loadModelFromUrl } from "@/lib/loaders";
import type { ObjectSource } from "@/lib/types";

type LoadState =
  | { status: "loading"; object: null; error: null }
  | { status: "ready"; object: THREE.Object3D; error: null }
  | { status: "error"; object: null; error: string };

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

  // Reset when source changes (render-phase adjustment)
  if (loadedKey !== sourceKey) {
    setLoadedKey(sourceKey);
    setState({ status: "loading", object: null, error: null });
  }

  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        const object =
          source.kind === "demo"
            ? createDemoObject(source.id)
            : await loadModelFromUrl(source.url, source.fileName);
        if (!cancelled) {
          setState({ status: "ready", object, error: null });
        }
      } catch (err) {
        if (!cancelled) {
          setState({
            status: "error",
            object: null,
            error: err instanceof Error ? err.message : "Failed to load model",
          });
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
