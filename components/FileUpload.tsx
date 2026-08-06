"use client";

import { useCallback, useRef, useState } from "react";
import { isSupportedFormat, SUPPORTED_EXTENSIONS } from "@/lib/loaders";
import type { UserModelMeta } from "@/lib/userModels";

type FileUploadProps = {
  activeId: string | null;
  savedModels: UserModelMeta[];
  onFile: (file: File) => void;
  onSelectSaved: (id: string) => void;
  onDeleteSaved: (id: string) => void;
};

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function FileUpload({
  activeId,
  savedModels,
  onFile,
  onSelectSaved,
  onDeleteSaved,
}: FileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const accept = SUPPORTED_EXTENSIONS.map((e) => `.${e}`).join(",");

  const handleFile = useCallback(
    (file: File | undefined) => {
      if (!file) return;
      if (!isSupportedFormat(file.name)) {
        setError(
          `Unsupported format. Use: ${SUPPORTED_EXTENSIONS.join(", ").toUpperCase()}`,
        );
        return;
      }
      setError(null);
      onFile(file);
    },
    [onFile],
  );

  return (
    <div className="space-y-2">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
        Load model
      </h2>
      <div
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
        }}
        onClick={() => inputRef.current?.click()}
        onDragEnter={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          setDragging(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          handleFile(e.dataTransfer.files[0]);
        }}
        className={`cursor-pointer rounded-lg border border-dashed px-3 py-4 text-center transition-colors ${
          dragging
            ? "border-indigo-400 bg-indigo-950/40"
            : "border-zinc-700 bg-zinc-900/50 hover:border-zinc-500 hover:bg-zinc-800/40"
        }`}
      >
        <p className="text-sm text-zinc-300">Drop a 3D file here</p>
        <p className="mt-1 text-xs text-zinc-500">or click to browse</p>
        <p className="mt-2 text-[10px] uppercase tracking-wide text-zinc-600">
          {SUPPORTED_EXTENSIONS.join(" · ")}
        </p>
        <p className="mt-1 text-[10px] text-zinc-600">
          Imports are kept in this browser
        </p>
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          className="hidden"
          onChange={(e) => {
            handleFile(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}

      {savedModels.length > 0 && (
        <div className="space-y-1.5 pt-1">
          <p className="text-[10px] uppercase tracking-wider text-zinc-600">
            Saved imports
          </p>
          <ul className="max-h-36 space-y-1 overflow-y-auto">
            {savedModels.map((model) => {
              const active = activeId === model.id;
              return (
                <li key={model.id} className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => onSelectSaved(model.id)}
                    className={`min-w-0 flex-1 truncate rounded-md px-2.5 py-1.5 text-left text-xs transition-colors ${
                      active
                        ? "bg-indigo-500/20 text-indigo-200 ring-1 ring-indigo-500/40"
                        : "bg-zinc-900/60 text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100"
                    }`}
                    title={model.fileName}
                  >
                    <span className="block truncate">{model.fileName}</span>
                    <span className="text-[10px] text-zinc-600">
                      {formatSize(model.size)}
                    </span>
                  </button>
                  <button
                    type="button"
                    aria-label={`Delete ${model.fileName}`}
                    onClick={() => onDeleteSaved(model.id)}
                    className="flex size-8 shrink-0 items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-red-300"
                  >
                    ×
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
