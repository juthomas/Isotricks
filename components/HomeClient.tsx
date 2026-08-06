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
    <div className="flex h-full w-full items-center justify-center bg-[#0a0a0f] text-sm text-zinc-500">
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
      setSource({
        kind: "file",
        id: fileObjectKey(file.name, file.size),
        label: file.name,
        url,
        fileName: file.name,
      });
    },
    [blobUrl],
  );

  return (
    <div className="relative h-dvh w-full overflow-hidden bg-[#0a0a0f]">
      <div
        className={`h-full transition-[width] duration-200 ${
          panelOpen ? "md:w-[calc(100%-24rem)]" : "w-full"
        }`}
      >
        <IsoViewer
          object={loadState.object}
          settings={settings}
          loading={loadState.status === "loading"}
          error={loadState.error}
        />
      </div>

      {!panelOpen && (
        <button
          type="button"
          onClick={() => setPanelOverride(true)}
          className="absolute right-3 top-3 z-20 hidden rounded-lg bg-[#12121a]/95 px-3 py-2 text-sm text-zinc-200 ring-1 ring-zinc-700 backdrop-blur md:block"
        >
          Show controls
        </button>
      )}

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
    </div>
  );
}
