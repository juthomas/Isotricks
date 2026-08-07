"use client";

type ExportProgressOverlayProps = {
  progress: number;
  status?: string | null;
};

/** Cinematic export progress overlay (scan + isometric frame). */
export default function ExportProgressOverlay({
  progress,
  status,
}: ExportProgressOverlayProps) {
  const pct = Math.min(100, Math.max(0, Math.round(progress * 100)));
  const label = status?.trim() || "Exporting…";

  return (
    <div
      className="export-overlay pointer-events-none absolute inset-0 z-30 flex items-center justify-center"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="export-overlay__veil absolute inset-0" />
      <div className="export-overlay__scan absolute inset-0" />

      <div className="relative z-10 flex w-[min(20rem,86%)] flex-col items-center gap-5">
        <div className="export-overlay__frame relative aspect-square w-full max-w-[11rem]">
          <div className="export-overlay__ring absolute inset-0" />
          <svg
            className="absolute inset-0 size-full -rotate-90"
            viewBox="0 0 100 100"
            aria-hidden
          >
            <circle
              cx="50"
              cy="50"
              r="44"
              fill="none"
              stroke="rgba(63,63,70,0.55)"
              strokeWidth="1.25"
            />
            <circle
              className="export-overlay__arc"
              cx="50"
              cy="50"
              r="44"
              fill="none"
              stroke="url(#exportArcGrad)"
              strokeWidth="1.75"
              strokeLinecap="square"
              strokeDasharray={`${(pct / 100) * 276.46} 276.46`}
            />
            <defs>
              <linearGradient id="exportArcGrad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#a5b4fc" />
                <stop offset="100%" stopColor="#6366f1" />
              </linearGradient>
            </defs>
          </svg>

          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="export-overlay__pct font-mono text-3xl font-medium tracking-tight text-zinc-100 tabular-nums">
              {pct}
              <span className="text-lg text-zinc-500">%</span>
            </span>
          </div>

          {/* Corner ticks — isometric cue */}
          <span className="export-overlay__tick absolute left-1 top-1 h-3 w-3 border-l border-t border-indigo-400/80" />
          <span className="export-overlay__tick absolute right-1 top-1 h-3 w-3 border-r border-t border-indigo-400/80" />
          <span className="export-overlay__tick absolute bottom-1 left-1 h-3 w-3 border-b border-l border-indigo-400/80" />
          <span className="export-overlay__tick absolute bottom-1 right-1 h-3 w-3 border-b border-r border-indigo-400/80" />
        </div>

        <div className="w-full space-y-2 text-center">
          <p className="export-overlay__label text-[11px] font-semibold uppercase tracking-[0.22em] text-indigo-300/90">
            {label}
          </p>
          <div className="export-overlay__bar mx-auto h-px w-full max-w-[14rem] overflow-hidden bg-zinc-800">
            <div
              className="export-overlay__bar-fill h-full bg-gradient-to-r from-indigo-500 via-indigo-300 to-indigo-500"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
