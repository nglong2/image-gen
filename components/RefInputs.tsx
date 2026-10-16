"use client";
/* eslint-disable @next/next/no-img-element */

import { useEffect, useMemo, useRef } from "react";

interface RefInputsProps {
  maxImages: number;
  refImages: File[];
  onImagesChange: (files: File[]) => void;
  onError: (message: string) => void;
  disabled?: boolean;
}

/**
 * Khu "Ảnh ref thêm" — ghép với ảnh/video đầu vào để Seedance giữ/mở rộng chi tiết
 * (vd: ảnh nón len để thay nón lưỡi trai của nhân vật trong video).
 * Chỉ hiện ở model hỗ trợ ref (Seedance 1.5/2.x).
 */
export default function RefInputs({
  maxImages,
  refImages,
  onImagesChange,
  onError,
  disabled,
}: RefInputsProps) {
  const imageInputRef = useRef<HTMLInputElement>(null);

  const imagePreviews = useMemo(
    () => refImages.map((file) => ({ file, url: URL.createObjectURL(file) })),
    [refImages],
  );
  useEffect(() => {
    return () => imagePreviews.forEach((item) => URL.revokeObjectURL(item.url));
  }, [imagePreviews]);

  const addImages = (files: FileList | null) => {
    if (!files) return;
    const next = [...refImages];
    for (const file of Array.from(files)) {
      if (!file.type.startsWith("image/")) continue;
      if (next.length >= maxImages) {
        onError(`Tối đa ${maxImages} ảnh ref cho model này.`);
        break;
      }
      next.push(file);
    }
    onImagesChange(next);
  };

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-dashed border-zinc-300 bg-zinc-50/60 p-3 dark:border-zinc-700 dark:bg-zinc-900/40">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">
          Ảnh ref thêm <span className="font-normal text-zinc-500">(tùy chọn)</span>
        </span>
        <span className="text-xs text-zinc-400">
          {refImages.length}/{maxImages} ảnh
        </span>
      </div>
      <p className="text-xs leading-5 text-zinc-500 dark:text-zinc-400">
        Ghép ảnh/video đầu vào với ref để giữ hoặc thay chi tiết — VD: video nhân vật đội{" "}
        <b>nón lưỡi trai</b> + ref ảnh <b>nón len</b> → prompt{" "}
        <i>“thay nón của nhân vật bằng nón len trong ref, giữ nguyên mọi thứ khác”</i>. Khi có
        ref, Seedance dùng chế độ multimodal (không dùng frame đầu).
      </p>

      <div className="flex flex-wrap items-center gap-2">
        {imagePreviews.map((item, index) => (
          <div
            key={`${item.file.name}-${index}`}
            className="relative h-16 w-16 overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-700"
          >
            <img src={item.url} alt={item.file.name} className="h-full w-full object-cover" />
            <button
              type="button"
              disabled={disabled}
              onClick={() => onImagesChange(refImages.filter((_, i) => i !== index))}
              aria-label="Xoá ảnh ref"
              className="absolute right-0.5 top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-black/70 text-[10px] text-white disabled:opacity-50"
            >
              ✕
            </button>
          </div>
        ))}
        {refImages.length < maxImages && (
          <button
            type="button"
            disabled={disabled}
            onClick={() => imageInputRef.current?.click()}
            className="flex h-16 w-16 flex-col items-center justify-center rounded-lg border border-dashed border-zinc-400 text-xs text-zinc-500 transition hover:border-zinc-600 hover:text-zinc-700 disabled:opacity-50 dark:border-zinc-600 dark:hover:border-zinc-400"
          >
            <span className="text-lg leading-none">＋</span>
            Ảnh ref
          </button>
        )}
        <input
          ref={imageInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          className="hidden"
          onChange={(event) => {
            addImages(event.target.files);
            event.target.value = "";
          }}
        />
      </div>
    </div>
  );
}
