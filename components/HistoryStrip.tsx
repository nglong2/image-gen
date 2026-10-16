"use client";
/* eslint-disable @next/next/no-img-element */

import type { HistoryItem } from "@/lib/history";

interface HistoryStripProps {
  items: HistoryItem[];
  activeId?: string | null;
  onPick: (item: HistoryItem) => void;
  disabled?: boolean;
}

/** Dải "Tạo gần đây" — chỉ hiển thị khi có từ 1 mục. */
export default function HistoryStrip({ items, activeId, onPick, disabled }: HistoryStripProps) {
  if (items.length < 1) return null;
  return (
    <div className="mt-auto border-t border-zinc-200 pt-4 dark:border-zinc-800">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
        Tạo gần đây ({items.length})
      </p>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            disabled={disabled}
            onClick={() => onPick(item)}
            title={item.prompt}
            className={`relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border-2 transition disabled:opacity-50 ${
              activeId === item.id
                ? "border-zinc-900 dark:border-white"
                : "border-transparent opacity-70 hover:opacity-100"
            }`}
          >
            {item.state === "pending" ? (
              <span className="flex h-full w-full items-center justify-center bg-zinc-100 text-lg dark:bg-zinc-800">
                ⏳
              </span>
            ) : item.resultKind === "video" ? (
              <span className="flex h-full w-full items-center justify-center bg-zinc-800 text-xl text-white">
                ▶
              </span>
            ) : (
              <img src={item.urls[0]} alt="" className="h-full w-full object-cover" />
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
