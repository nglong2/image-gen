"use client";

import type { OptionSpec } from "@/lib/tools";

interface OptionFieldsProps {
  specs: OptionSpec[];
  values: Record<string, string | boolean>;
  onChange: (key: string, value: string | boolean) => void;
  disabled?: boolean;
}

/** Render options (select/checkbox) từ tool registry — dùng chung mọi trang. */
export default function OptionFields({ specs, values, onChange, disabled }: OptionFieldsProps) {
  if (specs.length === 0) return null;
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {specs.map((spec) => {
        if (spec.type === "range" && spec.range) {
          const current = String(values[spec.key] ?? spec.defaultValue);
          return (
            <label
              key={spec.key}
              className="flex flex-col gap-1.5 text-sm font-medium sm:col-span-3"
            >
              <span className="flex items-center justify-between">
                {spec.label}
                <span className="font-mono text-xs font-normal text-zinc-600 dark:text-zinc-300">
                  {current}
                  {spec.range.unit ?? ""}
                </span>
              </span>
              <input
                type="range"
                min={spec.range.min}
                max={spec.range.max}
                step={spec.range.step}
                value={current}
                disabled={disabled}
                onChange={(event) => onChange(spec.key, event.target.value)}
                className="w-full cursor-pointer accent-zinc-900 disabled:opacity-60 dark:accent-zinc-100"
              />
              <span className="flex justify-between text-[10px] font-normal text-zinc-400">
                <span>
                  {spec.range.min}
                  {spec.range.unit ?? ""}
                </span>
                <span>
                  {spec.range.max}
                  {spec.range.unit ?? ""}
                </span>
              </span>
              {spec.hint && (
                <span className="text-xs font-normal leading-5 text-zinc-500 dark:text-zinc-400">
                  {spec.hint}
                </span>
              )}
            </label>
          );
        }
        if (spec.type === "checkbox") {
          return (
            <label
              key={spec.key}
              className="flex items-center gap-2 rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium dark:border-zinc-700"
            >
              <input
                type="checkbox"
                checked={Boolean(values[spec.key] ?? spec.defaultValue)}
                disabled={disabled}
                onChange={(event) => onChange(spec.key, event.target.checked)}
                className="h-4 w-4 accent-zinc-900 dark:accent-zinc-100"
              />
              {spec.label}
            </label>
          );
        }
        return (
          <label key={spec.key} className="flex flex-col gap-1.5 text-sm font-medium">
            {spec.label}
            <select
              value={String(values[spec.key] ?? spec.defaultValue)}
              disabled={disabled}
              onChange={(event) => onChange(spec.key, event.target.value)}
              className="rounded-lg border border-zinc-300 bg-white px-2.5 py-2 text-sm font-normal outline-none transition focus:border-zinc-500 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900"
            >
              {spec.choices?.map((choice) => (
                <option key={choice.value} value={choice.value}>
                  {choice.label}
                </option>
              ))}
            </select>
          </label>
        );
      })}
    </div>
  );
}

interface NsfwToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}

/** Toggle NSFW checker — field chung của các model kie.ai. */
export function NsfwToggle({ checked, onChange, disabled }: NsfwToggleProps) {
  return (
    <label className="flex items-start gap-2.5 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5 dark:border-zinc-800 dark:bg-zinc-900/50">
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-0.5 h-4 w-4 shrink-0 accent-zinc-900 dark:accent-zinc-100"
      />
      <span className="text-sm">
        <span className="font-medium">NSFW checker</span>
        <span className="block text-xs leading-5 text-zinc-500 dark:text-zinc-400">
          Tắt (mặc định) = không lọc nội dung thêm, mô hình trả kết quả trực tiếp. Bật = kiểm tra
          nội dung nhạy cảm trước khi trả về.
        </span>
      </span>
    </label>
  );
}
