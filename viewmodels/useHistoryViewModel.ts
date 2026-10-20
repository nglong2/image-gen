"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  deleteServerHistoryItem,
  fetchHistory,
  saveHistoryToR2,
  type ServerHistoryItem,
} from "@/lib/api/history";
import {
  getHistorySnapshot,
  getServerHistory,
  subscribeHistory,
} from "@/lib/history";
import { useAppKey } from "@/viewmodels/useAppKey";
import { pollTaskUntilDone } from "@/viewmodels/task-polling";

/**
 * ViewModel trang Lịch sử (View chỉ render danh sách + gọi các hàm trả về):
 * tải danh sách từ R2, tự resume task pending, xoá mục đã lưu.
 * Mọi call API đều qua `lib/api/*`.
 */
export function useHistoryViewModel() {
  const { appKey, setAppKey } = useAppKey();
  const [items, setItems] = useState<ServerHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Task pending từ localStorage (bắt đầu gen rồi thoát app — vô đây sẽ tự theo dõi lại)
  const localItems = useSyncExternalStore(subscribeHistory, getHistorySnapshot, getServerHistory);
  const pending = localItems.filter((item) => item.state === "pending");
  const resumeRef = useRef<Set<string>>(new Set());
  const aliveRef = useRef(true);

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
      const { items: list } = await fetchHistory(key.trim());
      setItems(list);
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

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);

  // Tự theo dõi lại các task pending: poll tới success/fail rồi lưu R2 + refresh danh sách
  useEffect(() => {
    const key = appKey.trim();
    if (!key) return;
    for (const item of localItems) {
      if (item.state !== "pending") continue;
      if (resumeRef.current.has(item.id)) continue;
      resumeRef.current.add(item.id);
      void (async () => {
        // ~20 phút mỗi lượt — quá lượt thì giữ pending, lần vô sau tự tiếp
        const outcome = await pollTaskUntilDone({
          taskId: item.id,
          appKey: key,
          resultKind: item.resultKind,
          interval: 5000,
          maxAttempts: 240,
          isCancelled: () => !aliveRef.current,
        });
        if (!aliveRef.current) return;
        if (outcome.kind === "success") {
          try {
            await saveHistoryToR2(key, {
              taskId: item.id,
              tool: item.tool,
              model: item.model,
              prompt: item.prompt,
              resultKind: item.resultKind,
              credits: outcome.credits,
              createdAt: item.createdAt,
              sourceUrls: outcome.urls,
            });
          } catch {
            // best-effort
          }
          void load(key);
          return;
        }
        if (outcome.kind === "fail") {
          setError(
            `Task ${item.id.slice(0, 8)} thất bại${outcome.message.startsWith("Tạo thất bại") ? `: ${outcome.message.replace(/^Tạo thất bại:?\s*/, "")}` : "."}`,
          );
        }
      })();
    }
  }, [appKey, localItems, load]);

  /** Xoá 1 mục khỏi R2 (View đã confirm trước khi gọi). */
  const deleteItem = useCallback(
    async (taskId: string) => {
      if (!appKey.trim()) return;
      setDeletingId(taskId);
      try {
        await deleteServerHistoryItem(appKey.trim(), taskId);
        setItems((prev) => prev.filter((item) => item.taskId !== taskId));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Xoá thất bại.");
      } finally {
        setDeletingId(null);
      }
    },
    [appKey],
  );

  const dismissError = useCallback(() => setError(null), []);

  return {
    appKey,
    setAppKey,
    items,
    loading,
    error,
    dismissError,
    deletingId,
    pending,
    deleteItem,
    reload: () => void load(appKey.trim()),
  };
}

export type { ServerHistoryItem };
