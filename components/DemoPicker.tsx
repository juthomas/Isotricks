"use client";

import { DEMO_LIST } from "@/lib/demos";
import type { DemoId } from "@/lib/types";

type DemoPickerProps = {
  activeId: DemoId | null;
  onSelect: (id: DemoId) => void;
};

export default function DemoPicker({ activeId, onSelect }: DemoPickerProps) {
  return (
    <div className="space-y-2">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
        Demo illusions
      </h2>
      <div className="grid grid-cols-2 gap-2">
        {DEMO_LIST.map((demo) => {
          const active = activeId === demo.id;
          return (
            <button
              key={demo.id}
              type="button"
              onClick={() => onSelect(demo.id)}
              title={demo.description}
              className={`rounded-lg px-2.5 py-2 text-left text-sm transition-colors ${
                active
                  ? "bg-indigo-600 text-white shadow-sm shadow-indigo-900/40"
                  : "bg-zinc-800/80 text-zinc-300 hover:bg-zinc-700 ring-1 ring-zinc-700/80"
              }`}
            >
              <span className="block font-medium leading-tight">{demo.label}</span>
              <span
                className={`mt-0.5 block text-[10px] leading-snug ${
                  active ? "text-indigo-100/80" : "text-zinc-500"
                }`}
              >
                {demo.description}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
