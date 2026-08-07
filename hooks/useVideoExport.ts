"use client";

import { useCallback, useRef, useState } from "react";
import {
  clampExportSize,
  computeExportTiming,
  decodeAudioFile,
  DEFAULT_EXPORT_HEIGHT,
  DEFAULT_EXPORT_WIDTH,
  downloadMp4,
  exportOfflineMp4,
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
  startExport: () => Promise<void>;
  cancelExport: () => void;
};

type UseVideoExportArgs = {
  settings: ModelSettings;
  getExportSource: () => ExportModelSource | null;
};

export function useVideoExport({
  settings,
  getExportSource,
}: UseVideoExportArgs): VideoExportControls {
  const [revolutions, setRevolutions] = useState(1);
  const [width, setWidthState] = useState(DEFAULT_EXPORT_WIDTH);
  const [height, setHeightState] = useState(DEFAULT_EXPORT_HEIGHT);
  const [syncMode, setSyncMode] = useState<SyncMode>("current-speed");
  const [audioOffsetSec, setAudioOffsetSec] = useState(0);
  const [audioFile, setAudioFileState] = useState<File | null>(null);
  const [audioBuffer, setAudioBuffer] = useState<AudioBuffer | null>(null);
  const [audioDurationSec, setAudioDurationSec] = useState<number | null>(null);
  const [recording, setRecording] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

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

    try {
      const blob = await exportOfflineMp4({
        source,
        width,
        height,
        revolutions,
        durationSec: timing.durationSec,
        audioBuffer: sliced,
        signal: abort.signal,
        onProgress: setProgress,
      });
      downloadMp4(blob, revolutions);
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
  ]);

  return {
    revolutions,
    width,
    height,
    syncMode,
    audioOffsetSec,
    audioFile,
    audioDurationSec,
    audioLabel: audioFile?.name ?? null,
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
    startExport,
    cancelExport,
  };
}
