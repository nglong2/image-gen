"use client";

import { useEffect, useMemo, useRef } from "react";

const MAX_VIDEO_SIZE = 200 * 1024 * 1024;
const ALLOWED = ["video/mp4", "video/webm", "video/quicktime"];

interface VideoDropZoneProps {
  file: File | null;
  durationSeconds: number;
  /** Giới hạn của model (vd "tổng video ref ≤30s") */
  hint?: string;
  onChange: (file: File | null) => void;
  onDuration: (seconds: number) => void;
  onError: (message: string) => void;
  disabled?: boolean;
}

/**
 * Khu input VIDEO (footage gốc cần chỉnh) — Seedance 2.x (reference_video_urls).
 * Kéo-thả hoặc bấm chọn, đọc thời lượng video để ước tính credit.
 */
export default function VideoDropZone({
  file,
  durationSeconds,
  hint,
  onChange,
  onDuration,
  onError,
  disabled,
}: VideoDropZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const previewUrl = useMemo(() => (file ? URL.createObjectURL(file) : ""), [file]);
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const pick = (next: File | null | undefined) => {
    if (!next) return;
    if (!ALLOWED.includes(next.type)) {
      onError("Video chỉ chấp nhận MP4, MOV hoặc WebM.");
      return;
    }
    if (next.size > MAX_VIDEO_SIZE) {
      onError("Video vượt quá 200MB.");
      return;
    }
    onChange(next);
    const url = URL.createObjectURL(next);
    const probe = document.createElement("video");
    probe.preload = "metadata";
    probe.onloadedmetadata = () => {
      onDuration(Number.isFinite(probe.duration) ? Math.round(probe.duration) : 0);
      URL.revokeObjectURL(url);
    };
    probe.onerror = () => {
      onDuration(0);
      URL.revokeObjectURL(url);
    };
    probe.src = url;
  };

  if (!file) {
    return (
      <div
        onClick={() => !disabled && inputRef.current?.click()}
        onDragOver={(event) => {
          event.preventDefault();
        }}
        onDrop={(event) => {
          event.preventDefault();
          if (!disabled) pick(event.dataTransfer.files?.[0]);
        }}
        className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-8 text-center transition ${
          disabled
            ? "border-zinc-200 opacity-60 dark:border-zinc-800"
            : "border-zinc-300 hover:border-zinc-400 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
        }`}
      >
        <span className="text-2xl">🎞</span>
        <p className="text-sm font-medium">Video đầu vào — kéo vào đây hoặc bấm để chọn</p>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          MP4/MOV/WebM · ≤200MB · Seedance 2.x{hint ? ` · ${hint}` : ""} — dùng làm footage gốc
          cần chỉnh (để trống nếu chỉ animate từ ảnh)
        </p>
        <input
          ref={inputRef}
          type="file"
          accept="video/mp4,video/webm,video/quicktime"
          className="hidden"
          onChange={(event) => {
            pick(event.target.files?.[0]);
            event.target.value = "";
          }}
        />
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-zinc-200 bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900">
      <video src={previewUrl} controls muted preload="metadata" className="max-h-56 w-full bg-black" />
      <div className="flex items-center justify-between gap-2 px-3 py-2">
        <div className="min-w-0 text-xs">
          <p className="truncate font-medium">{file.name}</p>
          <p className="text-zinc-400">
            {(file.size / (1024 * 1024)).toFixed(1)} MB
            {durationSeconds > 0 ? ` · ${durationSeconds}s` : ""}
          </p>
        </div>
        <button
          type="button"
          disabled={disabled}
          onClick={() => {
            onChange(null);
            onDuration(0);
          }}
          className="shrink-0 rounded-lg bg-red-600/90 px-2.5 py-1 text-xs font-medium text-white transition hover:bg-red-700 disabled:opacity-50"
        >
          Xoá video
        </button>
      </div>
    </div>
  );
}
