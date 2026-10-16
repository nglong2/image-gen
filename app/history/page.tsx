"use client";
/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import AppKeyField from "@/components/AppKeyField";
import { useAppKey } from "@/hooks/useAppKey";
import { APP_KEY_HEADER } from "@/lib/kie-shared";

interface HistoryItem {
  taskId: string;
  tool: string;
  model: string;
  prompt: string;
  resultKind: "image" | "video";
  credits?: number;
  createdAt: number;
  savedAt: number;
  urls: string[];
  sourceUrls: string[];
}

const TOOL_LABELS: Record<string, string> = {
  "image-to-image": "Chỉnh sửa ảnh",
  "text-to-video": "Text → Video",
  "image-to-video": "Ảnh → Video",
  "video-image-to-video": "Video + Ảnh → Video",
};

export default function HistoryPage() {
  const { appKey, setAppKey } = useAppKey();
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(async (key: string) => {
    if (!key.trim()) {
      setItems([]);
      setError(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/history", { headers: { [APP_KEY_HEADER]: key.trim() } });
      const data = (await res.json().catch(() => null)) ?? {};
      if (!res.ok) throw new Error(data.error ?? "Không tải được lịch sử.");
      setItems(Array.isArray(data.items) ? data.items : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không tải được lịch sử.");
    } finally {
      setLoading(false);
    }
  }, []);

  // Nạp khi có App key (debounced) — không có key thì chỉ render hướng dẫn nhập key
  useEffect(() => {
    const key = appKey.trim();
    if (!key) return;
    const timer = setTimeout(() => void load(key), 500);
    return () => clearTimeout(timer);
  }, [appKey, load]);

  const handleDelete = async (taskId: string) => {
    if (!appKey.trim()) return;
    if (!window.confirm("Xoá mục này khỏi R2? (bao gồm cả file media)")) return;
    setDeletingId(taskId);
    try {
      const res = await fetch(`/api/history?taskId=${encodeURIComponent(taskId)}`, {
        method: "DELETE",
        headers: { [APP_KEY_HEADER]: appKey.trim() },
      });
      const data = (await res.json().catch(() => null)) ?? {};
      if (!res.ok) throw new Error(data.error ?? "Xoá thất bại.");
      setItems((prev) => prev.filter((item) => item.taskId !== taskId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Xoá thất bại.");
    } finally {
      setDeletingId(null);
    }
  };

  const handleDownload = async (url: string, kind: "image" | "video") => {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error("download failed");
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      const base = url.split("?")[0].split("/").pop() ?? "";
      anchor.download = /\.[a-z0-9]+$/i.test(base)
        ? base
        : `result.${kind === "video" ? "mp4" : "png"}`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(objectUrl);
    } catch {
      window.open(url, "_blank", "noopener,noreferrer");
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50 text-zinc-900 dark:bg-black dark:text-zinc-100">
      <header className="border-b border-zinc-200 bg-white/80 backdrop-blur dark:border-zinc-800 dark:bg-black/70">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div>
            <h1 className="text-lg font-semibold tracking-tight sm:text-xl">
              <Link href="/" className="transition hover:opacity-70">
                AI Studio
              </Link>
              <span className="mx-2 text-zinc-300 dark:text-zinc-600">/</span>
              📜 Lịch sử gen
            </h1>
            <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">
              Lưu bền vững trên Cloudflare R2 — không hết hạn14 ngày như link kie.ai.
            </p>
          </div>
          <div className="shrink-0">
            <AppKeyField value={appKey} onChange={setAppKey} />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6">
        {error && (
          <div
            role="alert"
            className="mb-4 flex items-start justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/60 dark:text-red-300"
          >
            <span className="break-words">{error}</span>
            <button
              type="button"
              onClick={() => setError(null)}
              className="shrink-0 font-medium underline underline-offset-2 hover:opacity-70"
            >
              Đóng
            </button>
          </div>
        )}

        {!appKey.trim() ? (
          <div className="flex flex-col items-center justify-center gap-2 py-24 text-center text-zinc-400">
            <span className="text-3xl">🔑</span>
            <p className="text-sm">Nhập App key ở góc phải để xem lịch sử.</p>
          </div>
        ) : loading ? (
          <div className="flex flex-col items-center justify-center gap-3 py-24 text-zinc-500">
            <span className="h-7 w-7 animate-spin rounded-full border-[3px] border-zinc-400 border-t-transparent" />
            <p className="text-sm">Đang tải lịch sử từ R2…</p>
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-24 text-center text-zinc-400">
            <span className="text-3xl">🗂</span>
            <p className="text-sm">Chưa có lịch sử — mỗi lần gen xong sẽ tự lưu vào R2.</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((item) => (
              <div
                key={item.taskId}
                className="flex flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
              >
                {item.urls[0] ? (
                  item.resultKind === "video" ? (
                    <video
                      src={item.urls[0]}
                      controls
                      muted
                      preload="metadata"
                      className="h-44 w-full bg-black object-contain"
                    />
                  ) : (
                    <img src={item.urls[0]} alt={item.prompt} className="h-44 w-full object-cover" />
                  )
                ) : (
                  <div className="flex h-44 items-center justify-center bg-zinc-100 text-3xl dark:bg-zinc-900">
                    {item.resultKind === "video" ? "🎬" : "🖼️"}
                  </div>
                )}

                <div className="flex flex-1 flex-col gap-2 p-3">
                  <p className="line-clamp-2 text-sm leading-5 text-zinc-700 dark:text-zinc-300">
                    {item.prompt || "(không có prompt)"}
                  </p>
                  <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                    <span className="rounded-full bg-zinc-100 px-2 py-0.5 font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                      {TOOL_LABELS[item.tool] ?? item.tool}
                    </span>
                    <span className="rounded-full bg-zinc-100 px-2 py-0.5 font-mono text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                      {item.model.split("/").pop()}
                    </span>
                    {typeof item.credits === "number" && (
                      <span className="rounded-full bg-amber-50 px-2 py-0.5 font-medium text-amber-700 dark:bg-amber-950/50 dark:text-amber-300">
                        💸 {item.credits}
                      </span>
                    )}
                    <span className="text-zinc-400">
                      {new Date(item.savedAt || item.createdAt).toLocaleString("vi-VN")}
                    </span>
                  </div>

                  <div className="mt-auto flex flex-wrap gap-2 pt-1">
                    {item.urls[0] && (
                      <>
                        <button
                          type="button"
                          onClick={() => handleDownload(item.urls[0], item.resultKind)}
                          className="rounded-full bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-zinc-700 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
                        >
                          Tải về
                        </button>
                        <a
                          href={item.urls[0]}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="rounded-full border border-zinc-300 px-3 py-1.5 text-xs font-semibold transition hover:border-zinc-500 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
                        >
                          Mở
                        </a>
                      </>
                    )}
                    <button
                      type="button"
                      disabled={deletingId === item.taskId}
                      onClick={() => handleDelete(item.taskId)}
                      className="ml-auto rounded-full border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 transition hover:bg-red-50 disabled:opacity-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950/50"
                    >
                      {deletingId === item.taskId ? "Đang xoá…" : "Xoá"}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      <footer className="border-t border-zinc-200 py-4 text-center text-xs text-zinc-400 dark:border-zinc-800">
        Lịch sử lưu trên Cloudflare R2 · media giữ vĩnh viễn (link kie.ai tự hết hạn sau14 ngày)
      </footer>
    </div>
  );
}
