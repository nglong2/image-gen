"use client";
/* eslint-disable @next/next/no-img-element */

import { useRef, useState, type SyntheticEvent } from "react";

interface MediaDropZoneProps {
  previewUrl: string | null;
  /** Hiện caption dưới preview (vd: ảnh đến từ URL) */
  caption?: string;
  onPick: (file: File) => void;
  onClear?: () => void;
  disabled?: boolean;
  onLoad?: (event: SyntheticEvent<HTMLImageElement>) => void;
  accept?: string;
}

/** Zone kéo-thả/chọn ảnh + preview (dùng cho tool có inputKind = image). */
export default function MediaDropZone({
  previewUrl,
  caption,
  onPick,
  onClear,
  disabled,
  onLoad,
  accept = "image/jpeg,image/png,image/webp",
}: MediaDropZoneProps) {
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const openPicker = () => {
    if (!disabled) fileInputRef.current?.click();
  };

  return (
    <>
      {!previewUrl ? (
        <div
          onClick={openPicker}
          onDragOver={(event) => {
            event.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={() => setDragActive(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragActive(false);
            const file = event.dataTransfer.files?.[0];
            if (file) onPick(file);
          }}
          className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-10 text-center transition ${
            dragActive
              ? "border-zinc-900 bg-zinc-100 dark:border-zinc-100 dark:bg-zinc-900"
              : "border-zinc-300 hover:border-zinc-400 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
          }`}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            className="h-8 w-8 text-zinc-400"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5"
            />
          </svg>
          <p className="text-sm font-medium">Kéo ảnh vào đây hoặc bấm để chọn</p>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            JPEG, PNG, WebP · tối đa 30MB · dán ảnh bằng Ctrl+V
          </p>
        </div>
      ) : (
        <div className="relative overflow-hidden rounded-xl border border-zinc-200 bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900">
          <img
            src={previewUrl}
            alt="Ảnh đầu vào"
            onLoad={onLoad}
            className="max-h-80 w-full object-contain"
          />
          <div className="absolute right-2 top-2 flex gap-2">
            <button
              type="button"
              disabled={disabled}
              onClick={openPicker}
              className="rounded-lg bg-black/70 px-2.5 py-1 text-xs font-medium text-white transition hover:bg-black/90 disabled:opacity-50"
            >
              Đổi ảnh
            </button>
            {onClear && (
              <button
                type="button"
                disabled={disabled}
                onClick={onClear}
                className="rounded-lg bg-red-600/90 px-2.5 py-1 text-xs font-medium text-white transition hover:bg-red-700 disabled:opacity-50"
              >
                Xoá
              </button>
            )}
          </div>
          {caption && (
            <p className="border-t border-zinc-200 bg-white/80 px-3 py-2 text-xs text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950/80 dark:text-zinc-400">
              {caption}
            </p>
          )}
        </div>
      )}
      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) onPick(file);
          event.target.value = "";
        }}
      />
    </>
  );
}
