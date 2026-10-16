"use client";

interface AppKeyFieldProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

/** Ô App key góc phải header — nhập 1 lần khi vào web, lưu trong trình duyệt. */
export default function AppKeyField({ value, onChange, disabled }: AppKeyFieldProps) {
  const filled = value.trim().length > 0;
  return (
    <div className="flex items-center gap-2">
      <label htmlFor="app-key" className="hidden text-xs text-zinc-500 sm:block dark:text-zinc-400">
        App key
      </label>
      <input
        id="app-key"
        type="password"
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        placeholder="App key (nhập 1 lần)"
        autoComplete="off"
        aria-label="App key"
        title="Nhập 1 lần khi vào web — key được lưu trong trình duyệt này"
        className="w-40 rounded-lg border border-zinc-300 bg-white px-2.5 py-1.5 text-xs outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200 disabled:opacity-60 sm:w-48 dark:border-zinc-700 dark:bg-zinc-900 dark:focus:ring-zinc-800"
      />
      <span
        title={filled ? "Đã lưu App key trên máy này" : "Chưa nhập App key"}
        className={`h-2.5 w-2.5 shrink-0 rounded-full ${filled ? "bg-emerald-500" : "bg-amber-500"}`}
      />
    </div>
  );
}
