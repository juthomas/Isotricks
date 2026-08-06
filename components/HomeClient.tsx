"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import ControlPanel from "@/components/ControlPanel";
import { DEMO_LIST, getDemo } from "@/lib/demos";
import { demoObjectKey, fileObjectKey } from "@/lib/storage";
import { useLoadedObject } from "@/hooks/useLoadedObject";
import { useModelSettings } from "@/hooks/useModelSettings";
import { DEFAULT_DEMO_ID, type DemoId, type ObjectSource } from "@/lib/types";

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
  const [immersive, setImmersive] = useState(false);

  const objectKey = useMemo(() => {
    if (source.kind === "demo") return demoObjectKey(source.id);
    return source.id;
  }, [source]);

  const { settings, setSettings, resetSettings } = useModelSettings(objectKey);
  const loadState = useLoadedObject(source);

  useEffect(() => {
    return () => {
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [blobUrl]);

  const exitImmersive = useCallback(() => {
    setImmersive(false);
    setPanelOverride(null);
    if (document.fullscreenElement) {
      void document.exitFullscreen().catch(() => undefined);
    }
  }, []);

  const enterImmersive = useCallback(() => {
    setImmersive(true);
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

  const viewerSettings = useMemo(
    () =>
      immersive ? { ...settings, orbitEnabled: false } : settings,
    [immersive, settings],
  );

  const onSelectDemo = useCallback((id: DemoId) => {
    const demo = DEMO_LIST.find((d) => d.id === id);
    if (!demo) return;
    setSource({ kind: "demo", id: demo.id, label: demo.label });
  }, []);

  const onFile = useCallback(
    (file: File) => {
      if (blobUrl) URL.revokeObjectURL(blobUrl);
      const url = URL.createObjectURL(file);
      setBlobUrl(url);
      // Uploading a custom file pauses auto-cycle so the import stays visible
      setSettings({ autoCycle: false });
      setSource({
        kind: "file",
        id: fileObjectKey(file.name, file.size),
        label: file.name,
        url,
        fileName: file.name,
      });
    },
    [blobUrl, setSettings],
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
    <div className="relative h-dvh w-full overflow-hidden bg-black">
      <div
        className={`h-full transition-[width] duration-200 ${
          showPanel ? "md:w-[calc(100%-24rem)]" : "w-full"
        }`}
      >
        <IsoViewer
          object={loadState.object}
          settings={viewerSettings}
          loading={loadState.status === "loading"}
          error={immersive ? null : loadState.error}
        />
      </div>

      {immersive && (
        <button
          type="button"
          aria-label="Exit fullscreen"
          className="absolute inset-0 z-30 cursor-default bg-transparent"
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
          panelOpen={panelOpen}
          onTogglePanel={() => setPanelOverride(!panelOpen)}
          onSelectDemo={onSelectDemo}
          onFile={onFile}
          onSettingsChange={(update) => setSettings(update)}
          onResetSettings={resetSettings}
        />
      )}
    </div>
  );
}
