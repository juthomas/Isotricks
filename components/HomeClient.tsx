"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import ControlPanel from "@/components/ControlPanel";
import { DEMO_LIST, getDemo } from "@/lib/demos";
import {
  demoObjectKey,
  loadLastSource,
  saveLastSource,
  userModelObjectKey,
} from "@/lib/storage";
import { useLoadedObject } from "@/hooks/useLoadedObject";
import { useModelSettings } from "@/hooks/useModelSettings";
import { useVideoExport } from "@/hooks/useVideoExport";
import { useSceneClock } from "@/hooks/useSceneClock";
import { DEFAULT_DEMO_ID, type DemoId, type ObjectSource } from "@/lib/types";
import type { ExportModelSource } from "@/lib/exportScene";
import {
  deleteUserModel,
  getUserModelPackage,
  listUserModels,
  saveUserModelPackage,
  type UserModelMeta,
} from "@/lib/userModels";
import { splitModelFiles } from "@/lib/loaders";
import {
  deleteSessionPackage,
  setSessionPackage,
} from "@/lib/sessionPackages";

const IsoViewer = dynamic(() => import("@/components/IsoViewer"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-black text-sm text-zinc-500">
      Loading viewer…
    </div>
  ),
});

function defaultSource(): ObjectSource {
  const demo = getDemo(DEFAULT_DEMO_ID);
  return { kind: "demo", id: demo.id, label: demo.label };
}

function subscribeDesktop(onStoreChange: () => void) {
  const mq = window.matchMedia("(min-width: 768px)");
  mq.addEventListener("change", onStoreChange);
  return () => mq.removeEventListener("change", onStoreChange);
}

function getDesktopSnapshot() {
  return window.matchMedia("(min-width: 768px)").matches;
}

function getDesktopServerSnapshot() {
  return false;
}

function ExpandIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M8 3H5a2 2 0 0 0-2 2v3" />
      <path d="M16 3h3a2 2 0 0 1 2 2v3" />
      <path d="M8 21H5a2 2 0 0 1-2-2v-3" />
      <path d="M16 21h3a2 2 0 0 0 2-2v-3" />
    </svg>
  );
}

const IMMERSIVE_CURSOR_HIDE_MS = 2000;

export default function HomeClient() {
  const [source, setSource] = useState<ObjectSource>(defaultSource);
  const isDesktop = useSyncExternalStore(
    subscribeDesktop,
    getDesktopSnapshot,
    getDesktopServerSnapshot,
  );
  // null = follow viewport default (desktop open, mobile closed)
  const [panelOverride, setPanelOverride] = useState<boolean | null>(null);
  const panelOpen = panelOverride ?? isDesktop;
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [savedModels, setSavedModels] = useState<UserModelMeta[]>([]);
  const [sourceReady, setSourceReady] = useState(false);
  const [immersive, setImmersive] = useState(false);
  const [cursorHidden, setCursorHidden] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const cursorHideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const objectKey = useMemo(() => {
    if (source.kind === "demo") return demoObjectKey(source.id);
    return userModelObjectKey(source.id);
  }, [source]);

  const { settings, setSettings, resetSettings } = useModelSettings(objectKey);
  const loadState = useLoadedObject(source);
  const sceneClock = useSceneClock();
  const exportSourceRef = useRef<(() => ExportModelSource | null) | null>(null);

  const onExportReady = useCallback(
    (getSource: (() => ExportModelSource | null) | null) => {
      exportSourceRef.current = getSource;
    },
    [],
  );

  const videoExport = useVideoExport({
    settings,
    getExportSource: () => exportSourceRef.current?.() ?? null,
  });

  useEffect(() => {
    return () => {
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [blobUrl]);

  // Restore saved imports + last viewed source from this browser
  useEffect(() => {
    let cancelled = false;

    async function hydrate() {
      try {
        const models = await listUserModels();
        if (cancelled) return;
        setSavedModels(models);

        const last = loadLastSource();
        if (last?.kind === "file") {
          const loaded = await getUserModelPackage(last.id);
          if (cancelled) return;
          if (loaded) {
            setSessionPackage(
              loaded.meta.id,
              loaded.primary,
              loaded.assets,
            );
            const url = URL.createObjectURL(loaded.primary.blob);
            setBlobUrl(url);
            setSource({
              kind: "file",
              id: loaded.meta.id,
              label: loaded.meta.fileName,
              url,
              fileName: loaded.meta.fileName,
            });
          }
        } else if (last?.kind === "demo") {
          const demo = DEMO_LIST.find((d) => d.id === last.id);
          if (demo) {
            setSource({ kind: "demo", id: demo.id, label: demo.label });
          }
        }
      } catch {
        // IndexedDB unavailable — keep default demo
      } finally {
        if (!cancelled) setSourceReady(true);
      }
    }

    void hydrate();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!sourceReady) return;
    saveLastSource({ kind: source.kind, id: source.id });
  }, [source, sourceReady]);

  const exitImmersive = useCallback(() => {
    setImmersive(false);
    setCursorHidden(false);
    setPanelOverride(null);
    if (document.fullscreenElement) {
      void document.exitFullscreen().catch(() => undefined);
    }
  }, []);

  const enterImmersive = useCallback(() => {
    setImmersive(true);
    setCursorHidden(false);
    setPanelOverride(false);
    const el = document.documentElement;
    if (el.requestFullscreen) {
      void el.requestFullscreen().catch(() => undefined);
    }
  }, []);

  useEffect(() => {
    if (!immersive) return;

    const onKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      exitImmersive();
    };

    const onFullscreenChange = () => {
      // Browser exit (Esc / gesture) also leaves immersive UI mode
      if (!document.fullscreenElement) {
        setImmersive(false);
        setCursorHidden(false);
        setPanelOverride(null);
      }
    };

    // Defer so the key/click that entered fullscreen doesn't immediately exit
    const listenTimer = window.setTimeout(() => {
      window.addEventListener("keydown", onKeyDown);
    }, 0);

    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => {
      window.clearTimeout(listenTimer);
      window.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("fullscreenchange", onFullscreenChange);
    };
  }, [immersive, exitImmersive]);

  // Hide cursor after inactivity in fullscreen
  useEffect(() => {
    if (!immersive) return;

    const bumpCursor = () => {
      setCursorHidden(false);
      if (cursorHideTimer.current) clearTimeout(cursorHideTimer.current);
      cursorHideTimer.current = setTimeout(() => {
        setCursorHidden(true);
      }, IMMERSIVE_CURSOR_HIDE_MS);
    };

    bumpCursor();
    window.addEventListener("pointermove", bumpCursor);
    return () => {
      window.removeEventListener("pointermove", bumpCursor);
      if (cursorHideTimer.current) {
        clearTimeout(cursorHideTimer.current);
        cursorHideTimer.current = null;
      }
    };
  }, [immersive]);

  const onSelectDemo = useCallback((id: DemoId) => {
    const demo = DEMO_LIST.find((d) => d.id === id);
    if (!demo) return;
    setImportError(null);
    setSource({ kind: "demo", id: demo.id, label: demo.label });
  }, []);

  const openSavedModel = useCallback(
    async (id: string) => {
      const loaded = await getUserModelPackage(id);
      if (!loaded) {
        setImportError("Could not open saved model");
        return;
      }
      setImportError(null);
      setSessionPackage(loaded.meta.id, loaded.primary, loaded.assets);
      if (blobUrl) URL.revokeObjectURL(blobUrl);
      const url = URL.createObjectURL(loaded.primary.blob);
      setBlobUrl(url);
      setSettings({ autoCycle: false });
      setSource({
        kind: "file",
        id: loaded.meta.id,
        label: loaded.meta.fileName,
        url,
        fileName: loaded.meta.fileName,
      });
    },
    [blobUrl, setSettings],
  );

  const onFiles = useCallback(
    async (files: File[]) => {
      const { primary, sidecars, error } = splitModelFiles(files);
      if (!primary || error) {
        setImportError(
          error ??
            "Unsupported files. Need one mesh plus optional .mtl / textures.",
        );
        return;
      }
      setImportError(null);

      // Show the model immediately (same as obj_origin_modifier); persist in background
      const id = crypto.randomUUID();
      setSessionPackage(id, primary, sidecars);
      if (blobUrl) URL.revokeObjectURL(blobUrl);
      const url = URL.createObjectURL(primary);
      setBlobUrl(url);
      setSettings({ autoCycle: false });
      setSource({
        kind: "file",
        id,
        label: primary.name,
        url,
        fileName: primary.name,
      });

      try {
        await saveUserModelPackage(primary, sidecars, id);
        setSavedModels(await listUserModels());
      } catch {
        // Session package already has .mtl / maps for this tab
      }
    },
    [blobUrl, setSettings],
  );

  const onDeleteSavedModel = useCallback(
    async (id: string) => {
      await deleteUserModel(id);
      deleteSessionPackage(id);
      setSavedModels(await listUserModels());
      if (source.kind === "file" && source.id === id) {
        if (blobUrl) URL.revokeObjectURL(blobUrl);
        setBlobUrl(null);
        const demo = getDemo(DEFAULT_DEMO_ID);
        setSource({ kind: "demo", id: demo.id, label: demo.label });
      }
    },
    [blobUrl, source],
  );

  // Auto-cycle through built-in demos (random order, never the same twice in a row)
  useEffect(() => {
    if (!settings.autoCycle) return;

    const ms = Math.max(2, settings.autoCycleSeconds) * 1000;
    const id = window.setInterval(() => {
      setSource((prev) => {
        if (DEMO_LIST.length === 0) return prev;
        if (DEMO_LIST.length === 1) {
          const only = DEMO_LIST[0];
          return { kind: "demo", id: only.id, label: only.label };
        }

        const currentIndex =
          prev.kind === "demo"
            ? DEMO_LIST.findIndex((d) => d.id === prev.id)
            : -1;
        let nextIndex = Math.floor(Math.random() * DEMO_LIST.length);
        if (nextIndex === currentIndex) {
          nextIndex = (nextIndex + 1) % DEMO_LIST.length;
        }
        const demo = DEMO_LIST[nextIndex];
        return { kind: "demo", id: demo.id, label: demo.label };
      });
    }, ms);

    return () => window.clearInterval(id);
  }, [settings.autoCycle, settings.autoCycleSeconds]);

  const showPanel = panelOpen && !immersive;

  return (
    <div
      className={`relative h-dvh w-full overflow-hidden bg-black ${
        immersive && cursorHidden ? "cursor-none" : ""
      }`}
    >
      <div
        className={`h-full transition-[width] duration-200 ${
          showPanel ? "md:w-[calc(100%-24rem)]" : "w-full"
        }`}
      >
        <IsoViewer
          object={loadState.object}
          settings={settings}
          orbitInteractive={!immersive && !videoExport.recording}
          recording={videoExport.recording}
          exportProgress={videoExport.progress}
          exportStatus={videoExport.status}
          previewFrame={videoExport.previewFrame}
          exportWidth={videoExport.width}
          exportHeight={videoExport.height}
          advanceSceneTime={sceneClock.advance}
          getSceneTime={sceneClock.getSceneTime}
          onExportReady={onExportReady}
          loading={loadState.status === "loading"}
          error={immersive ? null : loadState.error}
        />
      </div>

      {immersive && !videoExport.recording && (
        <button
          type="button"
          aria-label="Exit fullscreen"
          className={`absolute inset-0 z-30 bg-transparent ${
            cursorHidden ? "cursor-none" : "cursor-default"
          }`}
          onPointerDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            exitImmersive();
          }}
        />
      )}

      {!immersive && (
        <button
          type="button"
          onClick={enterImmersive}
          aria-label="Enter fullscreen"
          title="Fullscreen"
          className="absolute left-3 top-3 z-20 flex size-11 items-center justify-center rounded-xl bg-[#12121a]/95 text-zinc-200 ring-1 ring-zinc-700 backdrop-blur transition-colors hover:bg-zinc-800 hover:text-white"
        >
          <ExpandIcon className="size-5" />
        </button>
      )}

      {!immersive && !panelOpen && (
        <button
          type="button"
          onClick={() => setPanelOverride(true)}
          className="absolute right-3 top-3 z-20 hidden rounded-lg bg-[#12121a]/95 px-3 py-2 text-sm text-zinc-200 ring-1 ring-zinc-700 backdrop-blur md:block"
        >
          Show controls
        </button>
      )}

      {!immersive && (
        <ControlPanel
          source={source}
          settings={settings}
          hasTextures={loadState.hasTextures}
          panelOpen={panelOpen}
          savedModels={savedModels}
          videoExport={videoExport}
          sceneClock={sceneClock}
          importError={importError}
          loadError={loadState.error}
          onTogglePanel={() => setPanelOverride(!panelOpen)}
          onSelectDemo={onSelectDemo}
          onFiles={(files) => {
            void onFiles(files);
          }}
          onSelectSavedModel={(id) => {
            void openSavedModel(id);
          }}
          onDeleteSavedModel={(id) => {
            void onDeleteSavedModel(id);
          }}
          onSettingsChange={(update) => setSettings(update)}
          onResetSettings={resetSettings}
        />
      )}
    </div>
  );
}
