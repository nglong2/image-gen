"use client";
/* eslint-disable @next/next/no-img-element */

import type { HistoryItem } from "@/lib/history";
import { downloadMedia } from "@/lib/download";

interface ResultMediaProps {
  item: HistoryItem;
  onEditAgain?: () => void;
  disabled?: boolean;
  /** Credit đã tiêu thật cho task này (nếu kie trả về) */
  spentCredits?: number;
}

/** Hiển thị ảnh KẾT QUẢ (img/video) + nút tải về / chỉnh sửa tiếp / mở tab mới. */
export default function ResultMedia({ item, onEditAgain, disabled, spentCredits }: ResultMediaProps) {
  const url = item.urls[0] ?? "";

  const handleDownload = (target: string) => void downloadMedia(target, item.resultKind);

  if (item.state === "pending" || !url) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-zinc-300 py-12 text-center dark:border-zinc-700">
        <span className="text-2xl">⏳</span>
        <p className="text-sm text-zinc-500">Task đang chờ hoàn tất — kết quả sẽ tự cập nhật.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-4">
      <div className="overflow-hidden rounded-xl border border-zinc-200 bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900">
        {item.resultKind === "video" ? (
          <video
            src={url}
            controls
            preload="metadata"
            className="max-h-[520px] w-full bg-black"
          />
        ) : (
          <img
            src={url}
            alt="Ảnh kết quả"
            className="max-h-[520px] w-full object-contain"
          />
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {item.urls.map((target, index) => (
          <button
            key={target}
            type="button"
            disabled={disabled}
            onClick={() => handleDownload(target)}
            className="inline-flex items-center gap-1.5 rounded-full bg-zinc-900 px-4 py-2 text-xs font-semibold text-white transition hover:bg-zinc-700 disabled:opacity-50 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            Tải về{item.urls.length > 1 ? ` ${index + 1}` : ""}
          </button>
        ))}
        {onEditAgain && (
          <button
            type="button"
            disabled={disabled}
            onClick={onEditAgain}
            className="rounded-full border border-zinc-300 px-4 py-2 text-xs font-semibold transition hover:border-zinc-500 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
          >
            Dùng lại làm đầu vào
          </button>
        )}
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-full border border-zinc-300 px-4 py-2 text-xs font-semibold transition hover:border-zinc-500 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
        >
          Mở tab mới
        </a>
      </div>

      <p className="text-xs leading-5 text-zinc-500 dark:text-zinc-400">
        <span className="font-medium text-zinc-600 dark:text-zinc-300">Prompt:</span>{" "}
        {item.prompt}
      </p>
      {spentCredits !== undefined && (
        <p className="text-xs font-medium text-zinc-600 dark:text-zinc-300">
          💸 Đã tốn <b>{spentCredits}</b> credit cho bản này
        </p>
      )}
    </div>
  );
}
