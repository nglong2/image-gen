"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import AppKeyField from "@/components/AppKeyField";

interface ToolShellProps {
  title: string;
  subtitle: string;
  badge?: string;
  leftTitle: string;
  rightTitle: string;
  error: string | null;
  onDismissError: () => void;
  appKey: string;
  onAppKeyChange: (value: string) => void;
  appKeyDisabled?: boolean;
  balance?: number | null;
  left: ReactNode;
  right: ReactNode;
}

/** Khung layout dùng chung: header (có ô App key góc phải) + banner lỗi + 2 cột + footer. */
export default function ToolShell({
  title,
  subtitle,
  badge,
  leftTitle,
  rightTitle,
  error,
  onDismissError,
  appKey,
  onAppKeyChange,
  appKeyDisabled,
  balance,
  left,
  right,
}: ToolShellProps) {
  return (
    <div className="flex min-h-screen flex-col bg-zinc-50 text-zinc-900 dark:bg-black dark:text-zinc-100">
      <header className="border-b border-zinc-200 bg-white/80 backdrop-blur dark:border-zinc-800 dark:bg-black/70">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="min-w-0">
            <h1 className="text-lg font-semibold tracking-tight sm:text-xl">
              <Link href="/" className="transition hover:opacity-70">
                AI Studio
              </Link>
              <span className="mx-2 text-zinc-300 dark:text-zinc-600">/</span>
              {title}
              {badge && (
                <span className="ml-3 hidden rounded-full border border-zinc-200 px-2.5 py-0.5 align-middle font-mono text-[10px] font-normal text-zinc-500 dark:border-zinc-700 dark:text-zinc-400 md:inline-block">
                  {badge}
                </span>
              )}
            </h1>
            <p className="mt-0.5 truncate text-sm text-zinc-500 dark:text-zinc-400">{subtitle}</p>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            {balance !== null && balance !== undefined && (
              <span
                title="Số dư credit kie.ai (tự cập nhật sau mỗi lần tạo)"
                className="hidden rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-xs font-medium text-zinc-600 sm:inline-block dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
              >
                ⚡ {balance} credit
              </span>
            )}
            <Link
              href="/history"
              className="text-xs font-medium text-zinc-500 transition hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
            >
              📜 Lịch sử
            </Link>
            <AppKeyField value={appKey} onChange={onAppKeyChange} disabled={appKeyDisabled} />
          </div>
        </div>
      </header>

      {error && (
        <div className="mx-auto w-full max-w-6xl px-4 pt-4 sm:px-6">
          <div
            role="alert"
            className="flex items-start justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/60 dark:text-red-300"
          >
            <span className="break-words">{error}</span>
            <button
              type="button"
              onClick={onDismissError}
              className="shrink-0 font-medium underline underline-offset-2 hover:opacity-70"
            >
              Đóng
            </button>
          </div>
        </div>
      )}

      <main className="mx-auto grid w-full max-w-6xl flex-1 gap-6 px-4 py-6 sm:px-6 lg:grid-cols-2">
        <section className="flex flex-col gap-4 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
            {leftTitle}
          </h2>
          {left}
        </section>
        <section className="flex min-h-[420px] flex-col gap-4 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
            {rightTitle}
          </h2>
          {right}
        </section>
      </main>

      <footer className="border-t border-zinc-200 py-4 text-center text-xs text-zinc-400 dark:border-zinc-800">
        Dùng kie.ai · API key và App key chỉ nằm ở máy chủ, không lộ ra trình duyệt
      </footer>
    </div>
  );
}
