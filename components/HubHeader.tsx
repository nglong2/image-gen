"use client";

import Link from "next/link";
import AppKeyField from "@/components/AppKeyField";
import { useAppKey } from "@/viewmodels/useAppKey";

/** Header trang hub — có ô App key góc phải (dùng chung key với mọi trang). */
export default function HubHeader() {
  const { appKey, setAppKey } = useAppKey();
  return (
    <header className="border-b border-zinc-200 bg-white/80 backdrop-blur dark:border-zinc-800 dark:bg-black/70">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-6 sm:px-6">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">AI Studio</h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            15 công cụ AI trên kie.ai — chọn công cụ để bắt đầu.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <Link
            href="/history"
            className="text-sm font-medium text-zinc-600 transition hover:opacity-70 dark:text-zinc-300"
          >
            📜 Lịch sử
          </Link>
          <AppKeyField value={appKey} onChange={setAppKey} />
        </div>
      </div>
    </header>
  );
}
