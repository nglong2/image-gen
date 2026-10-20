import { APP_KEY_HEADER } from "@/lib/kie-shared";

/** Lỗi khi gọi API nội bộ — message đã sẵn tiếng Việt để show thẳng cho người dùng. */
export class ApiClientError extends Error {
  readonly status: number;

  constructor(message: string, status = 0) {
    super(message);
    this.name = "ApiClientError";
    this.status = status;
  }
}

interface ApiFetchOptions {
  /** App key gửi kèm header x-app-key (bắt buộc với mọi endpoint). */
  appKey: string;
  method?: "GET" | "POST" | "DELETE";
  /** JSON body — tự stringify + set Content-Type. */
  body?: unknown;
  /** Multipart body (upload file) — không dùng chung với body. */
  formData?: FormData;
}

/**
 * Gọi API nội bộ `/api/*` — tầng service duy nhất được phép fetch:
 * tự gắn App key, parse JSON, ném ApiClientError khi HTTP lỗi hoặc mất mạng.
 */
export async function apiFetch<T>(path: string, options: ApiFetchOptions): Promise<T> {
  const { appKey, method = "GET", body, formData } = options;

  const headers: Record<string, string> = { [APP_KEY_HEADER]: appKey.trim() };
  if (body !== undefined) headers["Content-Type"] = "application/json";

  let res: Response;
  try {
    res = await fetch(path, {
      method,
      headers,
      body: formData ?? (body !== undefined ? JSON.stringify(body) : undefined),
    });
  } catch {
    throw new ApiClientError("Mất kết nối máy chủ. Kiểm tra mạng rồi thử lại.");
  }

  const data = (await res.json().catch(() => null)) ?? {};
  if (!res.ok) {
    throw new ApiClientError(
      (data as { error?: string }).error ?? `Yêu cầu thất bại (HTTP ${res.status}).`,
      res.status,
    );
  }
  return data as T;
}
