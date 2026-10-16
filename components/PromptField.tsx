"use client";

import type { ClipboardEvent } from "react";

interface PromptFieldProps {
  value: string;
  onChange: (value: string) => void;
  min: number;
  max: number;
  placeholder?: string;
  disabled?: boolean;
  rows?: number;
  onPaste?: (event: ClipboardEvent<HTMLTextAreaElement>) => void;
}

/** Ô nhập prompt + bộ đếm ký tự. */
export default function PromptField({
  value,
  onChange,
  min,
  max,
  placeholder,
  disabled,
  rows = 4,
  onPaste,
}: PromptFieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <label htmlFor="prompt" className="text-sm font-medium">
          Prompt
        </label>
        <span
          className={`text-xs ${value.length > max ? "font-medium text-red-500" : "text-zinc-400"}`}
        >
          {value.length}/{max}
        </span>
      </div>
      <textarea
        id="prompt"
        rows={rows}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        onPaste={onPaste}
        placeholder={placeholder}
        className="resize-y rounded-xl border border-zinc-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:focus:ring-zinc-800"
      />
      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        Tối thiểu {min} ký tự. Prompt tiếng Anh mô tả chi tiết thường cho kết quả tốt hơn.
      </p>
    </div>
  );
}
