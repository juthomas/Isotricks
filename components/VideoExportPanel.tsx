import { useMemo, useRef, useState } from "react";
import {
  clampExportSize,
  computeExportTiming,
  formatDuration,
  type SyncMode,
} from "@/lib/videoExport";
import type { VideoExportControls } from "@/hooks/useVideoExport";
import type { ModelSettings } from "@/lib/types";

type VideoExportPanelProps = {
  settings: ModelSettings;
  exportControls: VideoExportControls;
};

const PRESETS: { label: string; width: number; height: number }[] = [
  { label: "1080²", width: 1080, height: 1080 },
  { label: "1920×1080", width: 1920, height: 1080 },
  { label: "1080×1920", width: 1080, height: 1920 },
];

export default function VideoExportPanel({
  settings,
  exportControls,
}: VideoExportPanelProps) {
  const audioInputRef = useRef<HTMLInputElement>(null);
  const {
    revolutions,
    width,
    height,
    syncMode,
    audioOffsetSec,
    audioDurationSec,
    audioLabel,
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
  } = exportControls;

  // Free typing while focused; clamp only on blur / Enter
  const [widthDraft, setWidthDraft] = useState(String(width));
  const [heightDraft, setHeightDraft] = useState(String(height));
  const [widthFocused, setWidthFocused] = useState(false);
  const [heightFocused, setHeightFocused] = useState(false);

  const commitWidth = () => {
    const parsed = Number.parseInt(widthDraft, 10);
    if (Number.isFinite(parsed)) {
      const next = clampExportSize(parsed);
      setWidth(next);
      setWidthDraft(String(next));
    } else {
      setWidthDraft(String(width));
    }
  };

  const commitHeight = () => {
    const parsed = Number.parseInt(heightDraft, 10);
    if (Number.isFinite(parsed)) {
      const next = clampExportSize(parsed);
      setHeight(next);
      setHeightDraft(String(next));
    } else {
      setHeightDraft(String(height));
    }
  };

  const timing = useMemo(
    () =>
      computeExportTiming({
        revolutions,
        rotationSpeed: settings.rotationSpeed,
        syncMode,
        audioDurationSec,
        audioOffsetSec,
      }),
    [
      revolutions,
      settings.rotationSpeed,
      syncMode,
      audioDurationSec,
      audioOffsetSec,
    ],
  );

  const maxOffset =
    audioDurationSec !== null ? Math.max(0, audioDurationSec - 0.25) : 0;

  return (
    <div className="space-y-3">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
        Export video
      </h2>

      <label className="block space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="text-zinc-400">Revolutions</span>
          <span className="font-mono text-zinc-300">
            {revolutions.toFixed(1)}
          </span>
        </div>
        <input
          type="range"
          min={0.5}
          max={20}
          step={0.5}
          value={revolutions}
          disabled={recording}
          onChange={(e) => setRevolutions(Number(e.target.value))}
          className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-zinc-700 accent-indigo-500 disabled:opacity-50"
        />
      </label>

      <div className="space-y-2">
        <p className="text-[10px] uppercase tracking-wider text-zinc-600">
          Resolution
        </p>
        <div className="flex gap-1">
          {PRESETS.map((preset) => {
            const active =
              width === preset.width && height === preset.height;
            return (
              <button
                key={preset.label}
                type="button"
                disabled={recording}
                onClick={() => {
                  setWidth(preset.width);
                  setHeight(preset.height);
                  setWidthDraft(String(preset.width));
                  setHeightDraft(String(preset.height));
                }}
                className={`flex-1 rounded-md px-1.5 py-1.5 text-[10px] font-medium transition-colors disabled:opacity-50 ${
                  active
                    ? "bg-indigo-600 text-white"
                    : "bg-zinc-900 text-zinc-400 ring-1 ring-zinc-700 hover:text-zinc-200"
                }`}
              >
                {preset.label}
              </button>
            );
          })}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <label className="space-y-1">
            <span className="text-[10px] text-zinc-500">Width px</span>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={widthFocused ? widthDraft : String(width)}
              disabled={recording}
              onFocus={() => {
                setWidthFocused(true);
                setWidthDraft(String(width));
              }}
              onChange={(e) =>
                setWidthDraft(e.target.value.replace(/[^\d]/g, ""))
              }
              onBlur={() => {
                commitWidth();
                setWidthFocused(false);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.currentTarget.blur();
                }
              }}
              className="w-full rounded-md bg-zinc-900 px-2 py-1.5 font-mono text-xs text-zinc-200 ring-1 ring-zinc-700 outline-none focus:ring-indigo-500 disabled:opacity-50"
            />
          </label>
          <label className="space-y-1">
            <span className="text-[10px] text-zinc-500">Height px</span>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={heightFocused ? heightDraft : String(height)}
              disabled={recording}
              onFocus={() => {
                setHeightFocused(true);
                setHeightDraft(String(height));
              }}
              onChange={(e) =>
                setHeightDraft(e.target.value.replace(/[^\d]/g, ""))
              }
              onBlur={() => {
                commitHeight();
                setHeightFocused(false);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.currentTarget.blur();
                }
              }}
              className="w-full rounded-md bg-zinc-900 px-2 py-1.5 font-mono text-xs text-zinc-200 ring-1 ring-zinc-700 outline-none focus:ring-indigo-500 disabled:opacity-50"
            />
          </label>
        </div>
      </div>

      <div className="rounded-lg bg-zinc-900/60 px-3 py-2 text-xs ring-1 ring-zinc-800">
        <div className="flex justify-between text-zinc-400">
          <span>Duration</span>
          <span className="font-mono text-zinc-200">
            {formatDuration(timing.durationSec)}
          </span>
        </div>
        <div className="mt-1 flex justify-between text-zinc-500">
          <span>Output</span>
          <span className="font-mono">
            {width}×{height} MP4
          </span>
        </div>
      </div>

      <div className="space-y-1.5">
        <p className="text-[10px] uppercase tracking-wider text-zinc-600">
          Sync mode
        </p>
        <div className="flex gap-1 rounded-lg bg-zinc-900 p-1 ring-1 ring-zinc-800">
          {(
            [
              { id: "current-speed" as SyncMode, label: "Current speed" },
              { id: "fit-to-audio" as SyncMode, label: "Fit to audio" },
            ] as const
          ).map((mode) => (
            <button
              key={mode.id}
              type="button"
              disabled={recording}
              onClick={() => setSyncMode(mode.id)}
              className={`flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors disabled:opacity-50 ${
                syncMode === mode.id
                  ? "bg-indigo-600 text-white"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              {mode.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={recording}
            onClick={() => audioInputRef.current?.click()}
            className="flex-1 rounded-lg bg-zinc-900 px-3 py-2 text-xs text-zinc-200 ring-1 ring-zinc-700 transition-colors hover:bg-zinc-800 disabled:opacity-50"
          >
            {audioLabel ? "Change audio" : "Add soundtrack"}
          </button>
          {audioLabel && (
            <button
              type="button"
              disabled={recording}
              onClick={() => void setAudioFile(null)}
              className="rounded-lg px-2 py-2 text-xs text-zinc-500 hover:text-red-300 disabled:opacity-50"
            >
              Clear
            </button>
          )}
          <input
            ref={audioInputRef}
            type="file"
            accept="audio/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0] ?? null;
              void setAudioFile(file);
              e.target.value = "";
            }}
          />
        </div>
        {audioLabel && (
          <p className="truncate text-[11px] text-zinc-500" title={audioLabel}>
            {audioLabel}
            {audioDurationSec !== null
              ? ` · ${formatDuration(audioDurationSec)}`
              : ""}
          </p>
        )}
      </div>

      {audioDurationSec !== null && (
        <label className="block space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-zinc-400">Audio offset</span>
            <span className="font-mono text-zinc-300">
              {audioOffsetSec.toFixed(1)}s
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={maxOffset || 0}
            step={0.1}
            value={Math.min(audioOffsetSec, maxOffset)}
            disabled={recording || maxOffset <= 0}
            onChange={(e) => setAudioOffsetSec(Number(e.target.value))}
            className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-zinc-700 accent-indigo-500 disabled:opacity-50"
          />
        </label>
      )}

      {recording && (
        <div className="space-y-1">
          <div className="h-1.5 overflow-hidden rounded-full bg-zinc-800">
            <div
              className="h-full bg-indigo-500 transition-[width] duration-150"
              style={{ width: `${Math.round(progress * 100)}%` }}
            />
          </div>
          <p className="text-[11px] text-zinc-500">
            {Math.round(progress * 100)}%
          </p>
        </div>
      )}

      {error && <p className="text-xs text-red-400">{error}</p>}
      {status && !error && (
        <p className="text-xs text-zinc-500">{status}</p>
      )}

      <div className="flex gap-2">
        {!recording ? (
          <button
            type="button"
            onClick={() => void startExport()}
            className="flex-1 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-500"
          >
            Export MP4
          </button>
        ) : (
          <button
            type="button"
            onClick={cancelExport}
            className="flex-1 rounded-lg bg-zinc-800 px-3 py-2 text-sm text-zinc-200 ring-1 ring-zinc-700 transition-colors hover:bg-zinc-700"
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}
