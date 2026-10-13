import { NextResponse } from "next/server";
import {
  SEEDREAM_MODEL,
  type AspectRatio,
  type OutputFormat,
  type Quality,
  type TaskState,
} from "./kie-shared";

export const KIE_API_BASE = "https://api.kie.ai";
export const KIE_UPLOAD_BASE = "https://kieai.redpandaai.co";

/** Lỗi gọi API kie.ai — API trả HTTP 200 nên luôn phải kiểm tra field `code`. */
export class KieApiError extends Error {
  readonly code: number;

  constructor(code: number, message: string) {
    super(message);
    this.name = "KieApiError";
    this.code = code;
  }
}

const ERROR_MESSAGES: Record<number, string> = {
  401: "API key không hợp lệ hoặc chưa được cấu hình. Kiểm tra KIE_API_KEY trong file .env.local.",
  402: "Số credit không đủ để thực hiện yêu cầu. Vui lòng nạp thêm tại kie.ai/pricing.",
  404: "Không tìm thấy tài nguyên được yêu cầu.",
  408: "Yêu cầu quá thời gian chờ (không có kết quả trong hơn 10 phút).",
  422: "Dữ liệu gửi lên không hợp lệ. Kiểm tra prompt, ảnh đầu vào và các tùy chọn.",
  429: "Đã vượt giới hạn số yêu cầu. Hãy thử lại sau giây lát.",
  433: "Tài nguyên đang tạm thời không khả dụng.",
  455: "Hệ thống kie.ai đang bảo trì. Vui lòng thử lại sau.",
  500: "Máy chủ kie.ai gặp lỗi nội bộ. Vui lòng thử lại sau.",
  501: "Tạo ảnh thất bại — thử điều chỉnh prompt hoặc ảnh đầu vào.",
  505: "Tính năng này hiện đang bị tắt.",
};

export function kieErrorMessage(code: number, fallback?: string | null): string {
  return ERROR_MESSAGES[code] ?? fallback ?? `Lỗi không xác định từ kie.ai (mã ${code}).`;
}

interface Envelope<T> {
  code: number;
  msg?: string;
  message?: string;
  data?: T | null;
}

async function kieRequest<T>(url: string, init?: RequestInit): Promise<Envelope<T>> {
  const apiKey = process.env.KIE_API_KEY?.trim();
  if (!apiKey) {
    throw new KieApiError(
      401,
      "Chưa cấu hình KIE_API_KEY trong file .env.local. Lấy API key tại https://kie.ai/api-key",
    );
  }

  const res = await fetch(url, {
    ...init,
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      ...(init?.headers ?? {}),
    },
  });

  let body: Envelope<T> | null = null;
  try {
    body = (await res.json()) as Envelope<T>;
  } catch {
    throw new KieApiError(res.status, `Phản hồi không hợp lệ từ kie.ai (HTTP ${res.status}).`);
  }

  if (!res.ok || body.code !== 200) {
    const code = typeof body.code === "number" ? body.code : res.status;
    throw new KieApiError(code, kieErrorMessage(code, body.msg ?? body.message));
  }

  return body;
}

/** Tải file ảnh (base64 data URL) lên kie.ai, trả về downloadUrl để dùng trong image_urls. */
export async function uploadImageBase64(dataUrl: string): Promise<string> {
  const body = await kieRequest<{ downloadUrl?: string }>(
    `${KIE_UPLOAD_BASE}/api/file-base64-upload`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ base64Data: dataUrl, uploadPath: "images/user-uploads" }),
    },
  );

  const downloadUrl = body.data?.downloadUrl;
  if (!downloadUrl) {
    throw new KieApiError(500, "Tải ảnh lên kie.ai thành công nhưng không trả về URL.");
  }
  return downloadUrl;
}

export interface CreateTaskOptions {
  prompt: string;
  imageUrls: string[];
  aspectRatio: AspectRatio;
  quality: Quality;
  outputFormat: OutputFormat;
}

/** Tạo task chỉnh sửa ảnh (Seedream 5.0 Pro image-to-image), trả về taskId. */
export async function createImageTask(options: CreateTaskOptions): Promise<string> {
  const body = await kieRequest<{ taskId?: string }>(`${KIE_API_BASE}/api/v1/jobs/createTask`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: SEEDREAM_MODEL,
      input: {
        prompt: options.prompt,
        image_urls: options.imageUrls,
        aspect_ratio: options.aspectRatio,
        quality: options.quality,
        output_format: options.outputFormat,
      },
    }),
  });

  if (!body.data?.taskId) {
    throw new KieApiError(500, "kie.ai không trả về taskId cho tác vụ này.");
  }
  return body.data.taskId;
}

export interface TaskStatus {
  state: TaskState;
  resultUrls: string[];
  failMsg?: string;
}

/** Truy vấn trạng thái task qua GET /api/v1/jobs/recordInfo. */
export async function getTaskStatus(taskId: string): Promise<TaskStatus> {
  const body = await kieRequest<{
    state?: string;
    resultJson?: string;
    failMsg?: string;
  }>(`${KIE_API_BASE}/api/v1/jobs/recordInfo?taskId=${encodeURIComponent(taskId)}`);

  const data = body.data;
  const state = (data?.state ?? "generating") as TaskState;

  let resultUrls: string[] = [];
  if (state === "success" && data?.resultJson) {
    try {
      const parsed = JSON.parse(data.resultJson) as { resultUrls?: string[] };
      resultUrls = Array.isArray(parsed.resultUrls) ? parsed.resultUrls : [];
    } catch {
      throw new KieApiError(500, "Không đọc được kết quả trả về từ kie.ai.");
    }
  }

  return { state, resultUrls, failMsg: data?.failMsg };
}

/** Chuyển lỗi của route handler sang phản hồi JSON. */
export function errorResponse(err: unknown): NextResponse {
  if (err instanceof KieApiError) {
    return NextResponse.json(
      { error: err.message, code: err.code },
      { status: err.code === 401 ? 401 : 502 },
    );
  }
  console.error("[kie] unexpected error:", err);
  return NextResponse.json(
    { error: "Đã xảy ra lỗi không xác định. Vui lòng thử lại." },
    { status: 500 },
  );
}
