"use client";

import DemoPicker from "./DemoPicker";
import FileUpload from "./FileUpload";
import VideoExportPanel from "./VideoExportPanel";
import type {
  DemoId,
  DisplayMode,
  ModelSettings,
  ObjectSource,
  RotationDirection,
} from "@/lib/types";
import { GLITCH_EFFECTS } from "@/lib/types";
import type { UserModelMeta } from "@/lib/userModels";
import type { VideoExportControls } from "@/hooks/useVideoExport";

type ControlPanelProps = {
  source: ObjectSource;
  settings: ModelSettings;
  panelOpen: boolean;
  savedModels: UserModelMeta[];
  videoExport: VideoExportControls;
  onTogglePanel: () => void;
  onSelectDemo: (id: DemoId) => void;
  onFile: (file: File) => void;
  onSelectSavedModel: (id: string) => void;
  onDeleteSavedModel: (id: string) => void;
  onSettingsChange: (update: Partial<ModelSettings>) => void;
  onResetSettings: () => void;
};

function GearIcon({ className }: { className?: string }) {
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
      <path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" />
    </svg>
  );
}

function SliderRow({
  label,
  value,
  min,
  max,
  step,
  display,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  display?: string;
  onChange: (v: number) => void;
}) {
  return (
    <label className="block space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="text-zinc-400">{label}</span>
        <span className="font-mono text-zinc-300">{display ?? value.toFixed(2)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-zinc-700 accent-indigo-500"
      />
    </label>
  );
}

/** Log slider domain: 0 → 0%, else [DENSITY_LOG_MIN, 100] on a log scale. */
const DENSITY_SLIDER_MAX = 1000;
const DENSITY_LOG_MIN = 0.01;

function densityToSliderPos(density: number): number {
  if (density <= 0) return 0;
  const d = Math.min(100, Math.max(DENSITY_LOG_MIN, density));
  const t =
    (Math.log(d) - Math.log(DENSITY_LOG_MIN)) /
    (Math.log(100) - Math.log(DENSITY_LOG_MIN));
  return Math.round(Math.min(1, Math.max(0, t)) * DENSITY_SLIDER_MAX);
}

function sliderPosToDensity(pos: number): number {
  if (pos <= 0) return 0;
  const t = Math.min(1, pos / DENSITY_SLIDER_MAX);
  const d = Math.exp(
    Math.log(DENSITY_LOG_MIN) +
      t * (Math.log(100) - Math.log(DENSITY_LOG_MIN)),
  );
  return Math.min(100, d);
}

function formatPointDensity(density: number): string {
  if (density <= 0) return "0%";
  if (density < 1) return `${density.toFixed(2)}%`;
  if (density < 10) return `${density.toFixed(1)}%`;
  return `${Math.round(density)}%`;
}

/** Log intensity: down to 0.01%, up to 100%. */
const GLITCH_INTENSITY_SLIDER_MAX = 1000;
const GLITCH_INTENSITY_LOG_MIN = 0.0001;

function intensityToSliderPos(intensity: number): number {
  if (intensity <= 0) return 0;
  const d = Math.min(1, Math.max(GLITCH_INTENSITY_LOG_MIN, intensity));
  const t =
    (Math.log(d) - Math.log(GLITCH_INTENSITY_LOG_MIN)) /
    (Math.log(1) - Math.log(GLITCH_INTENSITY_LOG_MIN));
  return Math.round(Math.min(1, Math.max(0, t)) * GLITCH_INTENSITY_SLIDER_MAX);
}

function sliderPosToIntensity(pos: number): number {
  if (pos <= 0) return 0;
  const t = Math.min(1, pos / GLITCH_INTENSITY_SLIDER_MAX);
  const d = Math.exp(
    Math.log(GLITCH_INTENSITY_LOG_MIN) +
      t * (Math.log(1) - Math.log(GLITCH_INTENSITY_LOG_MIN)),
  );
  return Math.min(1, d);
}

function formatGlitchIntensity(intensity: number): string {
  if (intensity <= 0) return "0%";
  const pct = intensity * 100;
  if (pct < 0.1) return `${pct.toFixed(2)}%`;
  if (pct < 1) return `${pct.toFixed(2)}%`;
  if (pct < 10) return `${pct.toFixed(1)}%`;
  return `${Math.round(pct)}%`;
}

/** Mix cell size: log from 0.001 to 3. */
const CELL_SIZE_SLIDER_MAX = 1000;
const CELL_SIZE_LOG_MIN = 0.001;
const CELL_SIZE_LOG_MAX = 3;

function cellSizeToSliderPos(size: number): number {
  const d = Math.min(CELL_SIZE_LOG_MAX, Math.max(CELL_SIZE_LOG_MIN, size));
  const t =
    (Math.log(d) - Math.log(CELL_SIZE_LOG_MIN)) /
    (Math.log(CELL_SIZE_LOG_MAX) - Math.log(CELL_SIZE_LOG_MIN));
  return Math.round(Math.min(1, Math.max(0, t)) * CELL_SIZE_SLIDER_MAX);
}

function sliderPosToCellSize(pos: number): number {
  const t = Math.min(1, Math.max(0, pos / CELL_SIZE_SLIDER_MAX));
  return Math.exp(
    Math.log(CELL_SIZE_LOG_MIN) +
      t * (Math.log(CELL_SIZE_LOG_MAX) - Math.log(CELL_SIZE_LOG_MIN)),
  );
}

function formatCellSize(size: number): string {
  if (size < 0.01) return size.toFixed(3);
  if (size < 0.1) return size.toFixed(3);
  return size.toFixed(2);
}

/** Effect range + compact inline speed on one block. */
function GlitchEffectControls({
  label,
  minValue,
  maxValue,
  onRangeChange,
  speed,
  onSpeedChange,
}: {
  label: string;
  minValue: number;
  maxValue: number;
  onRangeChange: (min: number, max: number) => void;
  speed: number;
  onSpeedChange: (speed: number) => void;
}) {
  const minPos = intensityToSliderPos(minValue);
  const maxPos = intensityToSliderPos(maxValue);
  const lo = Math.min(minPos, maxPos);
  const hi = Math.max(minPos, maxPos);
  const pctLo = (lo / GLITCH_INTENSITY_SLIDER_MAX) * 100;
  const pctHi = (hi / GLITCH_INTENSITY_SLIDER_MAX) * 100;

  const thumbClass =
    "pointer-events-none absolute inset-0 h-5 w-full appearance-none bg-transparent " +
    "[&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:relative " +
    "[&::-webkit-slider-thumb]:z-10 [&::-webkit-slider-thumb]:size-3 " +
    "[&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:appearance-none " +
    "[&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-indigo-400 " +
    "[&::-webkit-slider-thumb]:shadow [&::-webkit-slider-runnable-track]:appearance-none " +
    "[&::-webkit-slider-runnable-track]:bg-transparent " +
    "[&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:size-3 " +
    "[&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:rounded-full " +
    "[&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-indigo-400 " +
    "[&::-moz-range-track]:bg-transparent";

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2 text-xs">
        <span className="w-[4.5rem] shrink-0 truncate text-zinc-400">{label}</span>
        <span className="shrink-0 font-mono text-[10px] tabular-nums text-zinc-500">
          {formatGlitchIntensity(Math.min(minValue, maxValue))}–
          {formatGlitchIntensity(Math.max(minValue, maxValue))}
        </span>
        <div className="ml-auto flex min-w-0 max-w-[9.5rem] flex-1 items-center gap-1">
          <span className="shrink-0 text-[10px] text-zinc-600">spd</span>
          <input
            type="range"
            min={0}
            max={3}
            step={0.01}
            value={speed}
            aria-label={`${label} speed`}
            onChange={(e) => onSpeedChange(Number(e.target.value))}
            className="h-1 min-w-0 flex-1 cursor-pointer appearance-none rounded-full bg-zinc-700 accent-indigo-500"
          />
          <span className="w-7 shrink-0 text-right font-mono text-[10px] tabular-nums text-zinc-500">
            {speed.toFixed(1)}×
          </span>
        </div>
      </div>
      <div className="relative h-5">
        <div className="pointer-events-none absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-zinc-700" />
        <div
          className="pointer-events-none absolute top-1/2 h-1 -translate-y-1/2 rounded-full bg-indigo-500/70"
          style={{ left: `${pctLo}%`, width: `${Math.max(0, pctHi - pctLo)}%` }}
        />
        <input
          type="range"
          min={0}
          max={GLITCH_INTENSITY_SLIDER_MAX}
          step={1}
          value={minPos}
          aria-label={`${label} min`}
          onChange={(e) => {
            const nextMin = sliderPosToIntensity(Number(e.target.value));
            onRangeChange(
              Math.min(nextMin, maxValue),
              Math.max(nextMin, maxValue),
            );
          }}
          className={thumbClass}
          style={{ zIndex: minPos > maxPos - 40 ? 4 : 2 }}
        />
        <input
          type="range"
          min={0}
          max={GLITCH_INTENSITY_SLIDER_MAX}
          step={1}
          value={maxPos}
          aria-label={`${label} max`}
          onChange={(e) => {
            const nextMax = sliderPosToIntensity(Number(e.target.value));
            onRangeChange(
              Math.min(minValue, nextMax),
              Math.max(minValue, nextMax),
            );
          }}
          className={thumbClass}
          style={{ zIndex: 3 }}
        />
      </div>
    </div>
  );
}

const MODES: { id: DisplayMode; label: string }[] = [
  { id: "wireframe", label: "Wireframe" },
  { id: "points", label: "Points" },
  { id: "solid", label: "Solid" },
];

const DIRECTIONS: { id: RotationDirection; label: string }[] = [
  { id: 1, label: "CW" },
  { id: -1, label: "CCW" },
  { id: 0, label: "Pause" },
];

export default function ControlPanel({
  source,
  settings,
  panelOpen,
  savedModels,
  videoExport,
  onTogglePanel,
  onSelectDemo,
  onFile,
  onSelectSavedModel,
  onDeleteSavedModel,
  onSettingsChange,
  onResetSettings,
}: ControlPanelProps) {
  const activeDemoId = source.kind === "demo" ? source.id : null;
  const activeSavedId = source.kind === "file" ? source.id : null;
  const nearLabel = settings.invertDepthColors ? "Far" : "Near";
  const farLabel = settings.invertDepthColors ? "Near" : "Far";

  return (
    <>
      {!panelOpen && (
        <button
          type="button"
          onClick={onTogglePanel}
          aria-label="Open settings"
          className="absolute right-3 top-3 z-20 flex size-11 items-center justify-center rounded-xl bg-[#12121a]/95 text-zinc-200 ring-1 ring-zinc-700 backdrop-blur transition-colors hover:bg-zinc-800 hover:text-white md:hidden"
        >
          <GearIcon className="size-5" />
        </button>
      )}

      <aside
        className={`absolute right-0 top-0 z-10 flex h-full w-full max-w-sm flex-col border-l border-zinc-800/80 bg-[#12121a]/95 text-zinc-200 shadow-2xl backdrop-blur-md transition-transform duration-200 ${
          panelOpen ? "translate-x-0" : "translate-x-full pointer-events-none"
        }`}
      >
        <div className="flex items-start justify-between gap-3 border-b border-zinc-800/80 px-4 py-4">
          <div>
            <h1 className="text-lg font-semibold tracking-tight text-zinc-50">
              Iso Tricks
            </h1>
            <p className="mt-0.5 text-xs text-zinc-500">
              Optical illusions in isometric view
            </p>
          </div>
          <button
            type="button"
            onClick={onTogglePanel}
            aria-label="Close settings"
            className="flex size-9 shrink-0 items-center justify-center rounded-lg text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
          >
            <GearIcon className="size-5 md:hidden" />
            <span className="hidden text-xl leading-none md:inline">×</span>
          </button>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto px-4 py-4">
          <FileUpload
            activeId={activeSavedId}
            savedModels={savedModels}
            onFile={onFile}
            onSelectSaved={onSelectSavedModel}
            onDeleteSaved={onDeleteSavedModel}
          />

          <div className="rounded-lg bg-zinc-900/60 px-3 py-2 ring-1 ring-zinc-800">
            <p className="text-[10px] uppercase tracking-wider text-zinc-500">
              Current object
            </p>
            <p className="mt-0.5 truncate text-sm font-medium text-zinc-100">
              {source.label}
            </p>
            <p className="mt-1 text-[10px] text-zinc-600">
              View mode is project-wide · camera saved per object
            </p>
          </div>

          <DemoPicker activeId={activeDemoId} onSelect={onSelectDemo} />

          <div className="space-y-2">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Display mode
            </h2>
            <div className="flex gap-1 rounded-lg bg-zinc-900 p-1 ring-1 ring-zinc-800">
              {MODES.map((mode) => (
                <button
                  key={mode.id}
                  type="button"
                  onClick={() => onSettingsChange({ displayMode: mode.id })}
                  className={`flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors ${
                    settings.displayMode === mode.id
                      ? "bg-indigo-600 text-white"
                      : "text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  {mode.label}
                </button>
              ))}
            </div>
            <label className="flex items-center justify-between text-xs text-zinc-400">
              <span>Depth colors</span>
              <input
                type="checkbox"
                checked={settings.depthColors}
                onChange={(e) =>
                  onSettingsChange({ depthColors: e.target.checked })
                }
                className="size-4 accent-indigo-500"
              />
            </label>
            {settings.depthColors && (
              <div className="space-y-2">
                <label className="flex items-center justify-between text-xs text-zinc-400">
                  <span>Invert</span>
                  <input
                    type="checkbox"
                    checked={settings.invertDepthColors}
                    onChange={(e) =>
                      onSettingsChange({ invertDepthColors: e.target.checked })
                    }
                    className="size-4 accent-indigo-500"
                  />
                </label>
                <div className="space-y-1">
                  <div
                    className="h-2 w-full rounded-full"
                    style={{
                      background: settings.invertDepthColors
                        ? "linear-gradient(90deg, #ef4444, #facc15, #4ade80, #22d3ee, #3b82f6)"
                        : "linear-gradient(90deg, #3b82f6, #22d3ee, #4ade80, #facc15, #ef4444)",
                    }}
                  />
                  <div className="flex justify-between text-[10px] text-zinc-600">
                    <span>{nearLabel}</span>
                    <span>{farLabel}</span>
                  </div>
                </div>
              </div>
            )}
            <label className="flex items-center justify-between text-xs text-zinc-400">
              <span>Glitch</span>
              <input
                type="checkbox"
                checked={settings.glitch}
                onChange={(e) => onSettingsChange({ glitch: e.target.checked })}
                className="size-4 accent-indigo-500"
              />
            </label>
            {settings.glitch && (
              <div className="space-y-2">
                <SliderRow
                  label="Mix cell size"
                  value={cellSizeToSliderPos(settings.glitchMixCellSize)}
                  min={0}
                  max={CELL_SIZE_SLIDER_MAX}
                  step={1}
                  display={formatCellSize(settings.glitchMixCellSize)}
                  onChange={(pos) =>
                    onSettingsChange({
                      glitchMixCellSize: sliderPosToCellSize(pos),
                    })
                  }
                />
                {GLITCH_EFFECTS.map((fx) => (
                  <GlitchEffectControls
                    key={fx.id}
                    label={fx.label}
                    minValue={settings[fx.minKey]}
                    maxValue={settings[fx.maxKey]}
                    onRangeChange={(min, max) =>
                      onSettingsChange({
                        [fx.minKey]: min,
                        [fx.maxKey]: max,
                      })
                    }
                    speed={settings[fx.speedKey]}
                    onSpeedChange={(speed) =>
                      onSettingsChange({ [fx.speedKey]: speed })
                    }
                  />
                ))}
              </div>
            )}
            <label className="flex items-center justify-between text-xs text-zinc-400">
              <span>Auto-cycle models</span>
              <input
                type="checkbox"
                checked={settings.autoCycle}
                onChange={(e) =>
                  onSettingsChange({ autoCycle: e.target.checked })
                }
                className="size-4 accent-indigo-500"
              />
            </label>
            {settings.autoCycle && (
              <SliderRow
                label="Interval (seconds)"
                value={settings.autoCycleSeconds}
                min={2}
                max={60}
                step={1}
                display={`${Math.round(settings.autoCycleSeconds)}s`}
                onChange={(autoCycleSeconds) =>
                  onSettingsChange({ autoCycleSeconds })
                }
              />
            )}
          </div>

          <div className="space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Rotation
            </h2>
            <label className="flex items-center justify-between text-xs text-zinc-400">
              <span>Auto-rotate</span>
              <input
                type="checkbox"
                checked={settings.autoRotate}
                onChange={(e) =>
                  onSettingsChange({ autoRotate: e.target.checked })
                }
                className="size-4 accent-indigo-500"
              />
            </label>
            <div className="flex gap-1 rounded-lg bg-zinc-900 p-1 ring-1 ring-zinc-800">
              {DIRECTIONS.map((dir) => (
                <button
                  key={dir.id}
                  type="button"
                  onClick={() =>
                    onSettingsChange({
                      rotationDirection: dir.id,
                      autoRotate: dir.id === 0 ? false : true,
                    })
                  }
                  className={`flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors ${
                    settings.rotationDirection === dir.id
                      ? "bg-indigo-600 text-white"
                      : "text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  {dir.label}
                </button>
              ))}
            </div>
            <SliderRow
              label="Speed (rad/s)"
              value={settings.rotationSpeed}
              min={0}
              max={2}
              step={0.01}
              onChange={(rotationSpeed) => onSettingsChange({ rotationSpeed })}
            />
          </div>

          <div className="space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Isometric view
            </h2>
            <SliderRow
              label="Angle X (elevation °)"
              value={settings.angleX}
              min={-89}
              max={89}
              step={0.1}
              display={`${settings.angleX.toFixed(1)}°`}
              onChange={(angleX) => onSettingsChange({ angleX })}
            />
            <SliderRow
              label="Angle Y (azimuth °)"
              value={settings.angleY}
              min={-180}
              max={180}
              step={0.1}
              display={`${settings.angleY.toFixed(1)}°`}
              onChange={(angleY) => onSettingsChange({ angleY })}
            />
            <SliderRow
              label="Zoom"
              value={settings.zoom}
              min={0.2}
              max={4}
              step={0.01}
              onChange={(zoom) => onSettingsChange({ zoom })}
            />
          </div>

          {settings.displayMode === "points" && (
            <div className="space-y-3">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                Points
              </h2>
              <SliderRow
                label="Point size"
                value={settings.pointSize}
                min={1}
                max={10}
                step={0.1}
                display={`${settings.pointSize.toFixed(1)}px`}
                onChange={(pointSize) => onSettingsChange({ pointSize })}
              />
              <SliderRow
                label="Point density"
                value={densityToSliderPos(settings.pointDensity)}
                min={0}
                max={DENSITY_SLIDER_MAX}
                step={1}
                display={formatPointDensity(settings.pointDensity)}
                onChange={(pos) =>
                  onSettingsChange({ pointDensity: sliderPosToDensity(pos) })
                }
              />
            </div>
          )}

          {settings.displayMode === "wireframe" && (
            <div className="space-y-3">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                Wireframe
              </h2>
              <SliderRow
                label="Line width (hint)"
                value={settings.lineWidth}
                min={0.5}
                max={3}
                step={0.1}
                onChange={(lineWidth) => onSettingsChange({ lineWidth })}
              />
              <p className="text-[10px] text-zinc-600">
                Line width is limited by WebGL on most browsers.
              </p>
            </div>
          )}

          <div className="space-y-2">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Camera
            </h2>
            <label className="flex items-center justify-between text-xs text-zinc-400">
              <span>Orbit drag</span>
              <input
                type="checkbox"
                checked={settings.orbitEnabled}
                onChange={(e) =>
                  onSettingsChange({ orbitEnabled: e.target.checked })
                }
                className="size-4 accent-indigo-500"
              />
            </label>
          </div>

          <VideoExportPanel settings={settings} exportControls={videoExport} />
        </div>

        <div className="border-t border-zinc-800/80 p-4">
          <button
            type="button"
            onClick={onResetSettings}
            className="w-full rounded-lg bg-zinc-800 px-3 py-2 text-sm text-zinc-200 ring-1 ring-zinc-700 transition-colors hover:bg-zinc-700"
          >
            Reset object defaults
          </button>
        </div>
      </aside>
    </>
  );
}
