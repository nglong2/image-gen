import type { ToolResultKind } from "@/lib/tools";
import { apiFetch } from "./client";

/** 1 mục lịch sử đã lưu trên R2 (metadata + URL xem media). */
export interface ServerHistoryItem {
  taskId: string;
  tool: string;
  model: string;
  prompt: string;
  resultKind: ToolResultKind;
  credits?: number;
  createdAt: number;
  savedAt: number;
  urls: string[];
  sourceUrls: string[];
}

/** GET /api/history — danh sách lịch sử gen từ R2 (mới nhất trước). */
export async function fetchHistory(
  appKey: string,
  limit = 60,
): Promise<{ items: ServerHistoryItem[] }> {
  const data = await apiFetch<{ items?: ServerHistoryItem[] }>(
    `/api/history?limit=${encodeURIComponent(String(limit))}`,
    { appKey },
  );
  return { items: Array.isArray(data.items) ? data.items : [] };
}

/** DELETE /api/history?taskId= — xoá 1 mục (metadata + media) khỏi R2. */
export function deleteServerHistoryItem(
  appKey: string,
  taskId: string,
): Promise<{ deleted: boolean }> {
  return apiFetch<{ deleted: boolean }>(
    `/api/history?taskId=${encodeURIComponent(taskId)}`,
    { appKey, method: "DELETE" },
  );
}

export interface SaveHistoryPayload {
  taskId: string;
  tool: string;
  model: string;
  prompt: string;
  resultKind: ToolResultKind;
  credits?: number;
  createdAt: number;
  sourceUrls: string[];
}

/** POST /api/history/save — copy media từ kie.ai vào R2 + lưu metadata (best-effort). */
export function saveHistoryToR2(
  appKey: string,
  payload: SaveHistoryPayload,
): Promise<{ saved: boolean; mediaCount: number }> {
  return apiFetch<{ saved: boolean; mediaCount: number }>("/api/history/save", {
    appKey,
    method: "POST",
    body: payload,
  });
}
