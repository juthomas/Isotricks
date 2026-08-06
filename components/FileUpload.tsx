"use client";

import { useCallback, useRef, useState } from "react";
import { isSupportedFormat, SUPPORTED_EXTENSIONS } from "@/lib/loaders";

type FileUploadProps = {
  onFile: (file: File) => void;
};

export default function FileUpload({ onFile }: FileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const accept = SUPPORTED_EXTENSIONS.map((e) => `.${e}`).join(",");

  const handleFile = useCallback(
    (file: File | undefined) => {
      if (!file) return;
      if (!isSupportedFormat(file.name)) {
        setError(`Unsupported format. Use: ${SUPPORTED_EXTENSIONS.join(", ").toUpperCase()}`);
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
    </div>
  );
}
