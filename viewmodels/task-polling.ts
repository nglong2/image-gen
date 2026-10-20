"use client";

import { getTaskStatus } from "@/lib/api/tasks";
import { ApiClientError } from "@/lib/api/client";
import { removeHistoryItem, updateHistoryItem } from "@/lib/history";
import type { TaskState } from "@/lib/kie-shared";
import type { ToolResultKind } from "@/lib/tools";

export type PollOutcome =
  | { kind: "success"; urls: string[]; credits?: number }
  | { kind: "fail"; message: string }
  | { kind: "timeout" }
  | { kind: "stopped" }
  | { kind: "error"; message: string };

/** Nhịp poll cho từng loại kết quả. */
export const POLL: Record<ToolResultKind, { interval: number; maxAttempts: number }> = {
  image: { interval: 3000, maxAttempts: 100 }, // ~5 phút
  video: { interval: 5000, maxAttempts: 180 }, // ~15 phút
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

interface PollTaskOptions {
  taskId: string;
  appKey: string;
  resultKind: ToolResultKind;
  onState?: (state: TaskState) => void;
  /** Trả true để dừng poll (vd: rời trang) — tôn trọng sau mỗi lần sleep. */
  isCancelled?: () => boolean;
  /** Override nhịp poll (mặc định theo resultKind). */
  interval?: number;
  maxAttempts?: number;
}

/**
 * Poll 1 task tới success/fail — dùng chung cho generate lẫn resume sau F5.
 * Đồng thời đồng bộ localStorage history (update khi success, xoá khi fail/rỗng).
 */
export async function pollTaskUntilDone({
  taskId,
  appKey,
  resultKind,
  onState,
  isCancelled,
  interval,
  maxAttempts,
}: PollTaskOptions): Promise<PollOutcome> {
  const { interval: defaultInterval, maxAttempts: defaultMax } = POLL[resultKind];
  const totalAttempts = maxAttempts ?? defaultMax;
  const waitMs = interval ?? defaultInterval;

  for (let attempt = 0; attempt < totalAttempts; attempt += 1) {
    await sleep(waitMs);
    if (isCancelled?.()) return { kind: "stopped" };

    let status: Awaited<ReturnType<typeof getTaskStatus>>;
    try {
      status = await getTaskStatus(appKey, taskId);
    } catch (err) {
      return {
        kind: "error",
        message:
          err instanceof ApiClientError || err instanceof Error
            ? err.message
            : "Mất kết nối khi kiểm tra tác vụ.",
      };
    }
    if (isCancelled?.()) return { kind: "stopped" };

    if (status.state) onState?.(status.state);

    if (status.state === "success") {
      const urls = Array.isArray(status.resultUrls) ? status.resultUrls : [];
      if (urls.length === 0) {
        removeHistoryItem(taskId);
        return { kind: "fail", message: "Tác vụ hoàn tất nhưng không trả về nội dung." };
      }
      updateHistoryItem(taskId, { state: "success", urls, credits: status.credits });
      return { kind: "success", urls, credits: status.credits };
    }

    if (status.state === "fail") {
      removeHistoryItem(taskId);
      return {
        kind: "fail",
        message: status.failMsg ? `Tạo thất bại: ${status.failMsg}` : "Tạo nội dung thất bại.",
      };
    }
  }
  return { kind: "timeout" };
}
