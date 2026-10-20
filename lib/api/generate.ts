import { apiFetch } from "./client";

export interface GenerateRequest {
  tool: string;
  model: string;
  prompt: string;
  imageUrls?: string[];
  /** Ảnh ref thêm (multimodal — Seedance 1.5/2.x) */
  refImageUrls?: string[];
  /** Video ref (Seedance 2.x) */
  refVideoUrls?: string[];
  options: Record<string, string | boolean>;
  nsfwChecker: boolean;
}

/** POST /api/generate — tạo task gen mới, trả về taskId để poll trạng thái. */
export function createGenerateTask(
  appKey: string,
  request: GenerateRequest,
): Promise<{ taskId: string }> {
  return apiFetch<{ taskId: string }>("/api/generate", {
    appKey,
    method: "POST",
    body: request,
  });
}
