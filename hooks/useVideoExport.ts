"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  clampExportSize,
  computeExportTiming,
  decodeAudioFile,
  DEFAULT_EXPORT_HEIGHT,
  DEFAULT_EXPORT_WIDTH,
  downloadMp4,
  downloadPng,
  exportBasenameFromModelLabel,
  exportOfflineMp4,
  exportOfflinePng,
  sliceAudioBuffer,
  type SyncMode,
} from "@/lib/videoExport";
import type { ExportModelSource } from "@/lib/exportScene";
import type { ModelSettings } from "@/lib/types";

export type VideoExportControls = {
  revolutions: number;
  width: number;
  height: number;
  syncMode: SyncMode;
  audioOffsetSec: number;
  audioFile: File | null;
  audioDurationSec: number | null;
  audioLabel: string | null;
  exportName: string;
  previewFrame: boolean;
  recording: boolean;
  progress: number;
  error: string | null;
  status: string | null;
  setRevolutions: (n: number) => void;
  setWidth: (n: number) => void;
  setHeight: (n: number) => void;
  setSyncMode: (m: SyncMode) => void;
  setAudioOffsetSec: (n: number) => void;
  setAudioFile: (file: File | null) => Promise<void>;
  setExportName: (name: string) => void;
  setPreviewFrame: (on: boolean) => void;
  startExport: () => Promise<void>;
  exportPhoto: () => Promise<void>;
  cancelExport: () => void;
};

type UseVideoExportArgs = {
  settings: ModelSettings;
  getExportSource: () => ExportModelSource | null;
  modelLabel: string;
};

function waitForPaint(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => resolve());
    });
  });
}

export function useVideoExport({
  settings,
  getExportSource,
  modelLabel,
}: UseVideoExportArgs): VideoExportControls {
  const [revolutions, setRevolutions] = useState(1);
  const [width, setWidthState] = useState(DEFAULT_EXPORT_WIDTH);
  const [height, setHeightState] = useState(DEFAULT_EXPORT_HEIGHT);
  const [syncMode, setSyncMode] = useState<SyncMode>("current-speed");
  const [audioOffsetSec, setAudioOffsetSec] = useState(0);
  const [audioFile, setAudioFileState] = useState<File | null>(null);
  const [audioBuffer, setAudioBuffer] = useState<AudioBuffer | null>(null);
  const [audioDurationSec, setAudioDurationSec] = useState<number | null>(null);
  const [exportName, setExportName] = useState(() =>
    exportBasenameFromModelLabel(modelLabel),
  );
  const [previewFrame, setPreviewFrame] = useState(false);
  const [recording, setRecording] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    setExportName(exportBasenameFromModelLabel(modelLabel));
  }, [modelLabel]);

  const setWidth = useCallback((n: number) => {
    setWidthState(clampExportSize(n));
  }, []);

  const setHeight = useCallback((n: number) => {
    setHeightState(clampExportSize(n));
  }, []);

  const setAudioFile = useCallback(async (file: File | null) => {
    setAudioFileState(file);
    setAudioOffsetSec(0);
    setError(null);
    if (!file) {
      setAudioBuffer(null);
      setAudioDurationSec(null);
      return;
    }
    try {
      const buffer = await decodeAudioFile(file);
      setAudioBuffer(buffer);
      setAudioDurationSec(buffer.duration);
    } catch {
      setAudioFileState(null);
      setAudioBuffer(null);
      setAudioDurationSec(null);
      setError("Could not decode audio file");
    }
  }, []);

  const cancelExport = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const startExport = useCallback(async () => {
    if (recording) return;
    setError(null);
    setStatus(null);
    setProgress(0);

    const source = getExportSource();
    if (!source) {
      setError("Model is not ready for export");
      return;
    }

    const timing = computeExportTiming({
      revolutions,
      rotationSpeed: settings.rotationSpeed,
      syncMode,
      audioDurationSec,
      audioOffsetSec,
    });

    if (syncMode === "fit-to-audio" && audioDurationSec === null) {
      setError("Add an audio track to use Fit to audio");
      return;
    }
    if (timing.durationSec < 0.25) {
      setError("Export duration is too short — check offset / revolutions");
      return;
    }

    let sliced: AudioBuffer | null = null;
    if (audioBuffer) {
      sliced = sliceAudioBuffer(
        audioBuffer,
        audioOffsetSec,
        timing.durationSec,
      );
    }

    const abort = new AbortController();
    abortRef.current = abort;
    setRecording(true);
    setStatus("Exporting MP4…");

    // Wait for React commit so live useFrame pauses (shared glitch uniforms)
    await waitForPaint();

    if (abort.signal.aborted) {
      setRecording(false);
      abortRef.current = null;
      setStatus("Export cancelled");
      return;
    }

    const readySource = getExportSource();
    if (!readySource) {
      setRecording(false);
      abortRef.current = null;
      setError("Model is not ready for export");
      return;
    }

    try {
      const blob = await exportOfflineMp4({
        source: readySource,
        width,
        height,
        revolutions,
        durationSec: timing.durationSec,
        audioBuffer: sliced,
        signal: abort.signal,
        onProgress: setProgress,
      });
      downloadMp4(blob, exportName);
      setStatus("Saved MP4");
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        setStatus("Export cancelled");
      } else {
        setError(err instanceof Error ? err.message : "Export failed");
      }
    } finally {
      setRecording(false);
      abortRef.current = null;
      setProgress(0);
    }
  }, [
    recording,
    getExportSource,
    revolutions,
    settings.rotationSpeed,
    syncMode,
    audioDurationSec,
    audioOffsetSec,
    audioBuffer,
    width,
    height,
    exportName,
  ]);

  const exportPhoto = useCallback(async () => {
    if (recording) return;
    setError(null);
    setStatus(null);
    setProgress(0);

    if (!getExportSource()) {
      setError("Model is not ready for export");
      return;
    }

    setRecording(true);
    setStatus("Exporting PNG…");
    await waitForPaint();

    const readySource = getExportSource();
    if (!readySource) {
      setRecording(false);
      setError("Model is not ready for export");
      return;
    }

    try {
      const blob = await exportOfflinePng({
        source: readySource,
        width,
        height,
      });
      downloadPng(blob, exportName);
      setStatus("Saved PNG");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Photo export failed");
    } finally {
      setRecording(false);
      setProgress(0);
    }
  }, [recording, getExportSource, width, height, exportName]);

  return {
    revolutions,
    width,
    height,
    syncMode,
    audioOffsetSec,
    audioFile,
    audioDurationSec,
    audioLabel: audioFile?.name ?? null,
    exportName,
    previewFrame,
    recording,
    progress,
    error,
    status,
    setRevolutions,
    setWidth,
    setHeight,
    setSyncMode,
    setAudioOffsetSec,
    setAudioFile,
    setExportName,
    setPreviewFrame,
    startExport,
    exportPhoto,
    cancelExport,
  };
}
