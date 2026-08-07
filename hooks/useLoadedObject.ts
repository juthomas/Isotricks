"use client";

import { useEffect, useState } from "react";
import * as THREE from "three";
import { createDemoObject, getDemo } from "@/lib/demos";
import {
  detectHasTextures,
  loadModelFromPackage,
  loadModelFromUrl,
} from "@/lib/loaders";
import type { ObjectSource } from "@/lib/types";
import { getSessionPackage } from "@/lib/sessionPackages";
import { getUserModelPackage } from "@/lib/userModels";

export type LoadState = {
  status: "loading" | "ready" | "error";
  object: THREE.Object3D | null;
  hasTextures: boolean;
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
    hasTextures: false,
    error: null,
  });
  const [loadedKey, setLoadedKey] = useState(sourceKey);

  if (loadedKey !== sourceKey) {
    setLoadedKey(sourceKey);
    setState((prev) => ({
      status: "loading",
      object: prev.object,
      hasTextures: prev.hasTextures,
      error: null,
    }));
  }

  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        let object: THREE.Object3D;
        let hasTextures = false;

        if (source.kind === "demo") {
          const demo = getDemo(source.id);
          if (demo.assetUrl && demo.assetFileName) {
            object = await loadModelFromUrl(demo.assetUrl, demo.assetFileName);
          } else {
            object = createDemoObject(source.id);
          }
          hasTextures = detectHasTextures(object);
          object.userData.hasTextures = hasTextures;
        } else {
          const session = getSessionPackage(source.id);
          const idb = session ? null : await getUserModelPackage(source.id);
          const pkg = session
            ? { primary: session.primary, assets: session.assets }
            : idb
              ? { primary: idb.primary, assets: idb.assets }
              : null;

          if (pkg) {
            const loaded = await loadModelFromPackage(pkg.primary, pkg.assets);
            object = loaded.object;
            hasTextures = loaded.hasTextures;
          } else {
            object = await loadModelFromUrl(source.url, source.fileName);
            hasTextures = detectHasTextures(object);
            object.userData.hasTextures = hasTextures;
          }
        }

        if (!cancelled) {
          setState({ status: "ready", object, hasTextures, error: null });
        }
      } catch (err) {
        if (!cancelled) {
          setState((prev) => ({
            status: "error",
            object: prev.object,
            hasTextures: prev.hasTextures,
            error: err instanceof Error ? err.message : "Failed to load model",
          }));
        }
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceKey]);

  return state;
}
