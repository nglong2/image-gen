import type { TaskState } from "@/lib/kie-shared";
import { apiFetch } from "./client";

export interface TaskStatus {
  state: TaskState;
  resultUrls: string[];
  failMsg?: string;
  /** Credit đã tiêu (present khi task kết thúc) */
  credits?: number;
}

/** GET /api/task — truy vấn trạng thái 1 task kie.ai. */
export function getTaskStatus(appKey: string, taskId: string): Promise<TaskStatus> {
  return apiFetch<TaskStatus>(`/api/task?taskId=${encodeURIComponent(taskId)}`, { appKey });
}
