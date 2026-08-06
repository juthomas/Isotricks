"use client";

import { DEMO_CATEGORIES, DEMO_LIST } from "@/lib/demos";
import type { DemoId } from "@/lib/types";

type DemoPickerProps = {
  activeId: DemoId | null;
  onSelect: (id: DemoId) => void;
};

export default function DemoPicker({ activeId, onSelect }: DemoPickerProps) {
  return (
    <div className="space-y-4">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
        Objects
      </h2>
      {DEMO_CATEGORIES.map((category) => {
        const items = DEMO_LIST.filter((d) => d.category === category.id);
        if (items.length === 0) return null;
        return (
          <div key={category.id} className="space-y-2">
            <h3 className="text-[10px] font-semibold uppercase tracking-wider text-zinc-600">
              {category.label}
            </h3>
            <div className="grid grid-cols-2 gap-1.5">
              {items.map((demo) => {
                const active = activeId === demo.id;
                return (
                  <button
                    key={demo.id}
                    type="button"
                    onClick={() => onSelect(demo.id)}
                    title={demo.description}
                    className={`rounded-lg px-2 py-1.5 text-left text-xs transition-colors ${
                      active
                        ? "bg-indigo-600 text-white shadow-sm shadow-indigo-900/40"
                        : "bg-zinc-800/80 text-zinc-300 ring-1 ring-zinc-700/80 hover:bg-zinc-700"
                    }`}
                  >
                    <span className="block font-medium leading-tight">
                      {demo.label}
                    </span>
                    <span
                      className={`mt-0.5 block text-[9px] leading-snug ${
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
      })}
    </div>
  );
}
