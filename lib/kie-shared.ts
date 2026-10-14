/**
 * Các hằng số & kiểu dữ liệu dùng chung cho client và server (không chứa secret).
 */

export const SEEDREAM_MODEL = "seedream/5-pro-image-to-image";

export type AspectRatio = "1:1" | "4:3" | "3:4" | "16:9" | "9:16" | "2:3" | "3:2" | "21:9";
export type Quality = "basic" | "high";
export type OutputFormat = "png" | "jpeg";
export type TaskState = "waiting" | "queuing" | "generating" | "success" | "fail";

export const ASPECT_RATIOS: readonly AspectRatio[] = [
  "1:1",
  "4:3",
  "3:4",
  "16:9",
  "9:16",
  "2:3",
  "3:2",
  "21:9",
];
export const QUALITIES: readonly Quality[] = ["basic", "high"];
export const OUTPUT_FORMATS: readonly OutputFormat[] = ["png", "jpeg"];

export const PROMPT_MIN = 4;
export const PROMPT_MAX = 5000;
export const MAX_IMAGE_SIZE = 30 * 1024 * 1024;
export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

/** Header chứa App key do client gửi lên để server kiểm tra truy cập. */
export const APP_KEY_HEADER = "x-app-key";

export function isAspectRatio(value: unknown): value is AspectRatio {
  return typeof value === "string" && (ASPECT_RATIOS as readonly string[]).includes(value);
}

export function isQuality(value: unknown): value is Quality {
  return typeof value === "string" && (QUALITIES as readonly string[]).includes(value);
}

export function isOutputFormat(value: unknown): value is OutputFormat {
  return typeof value === "string" && (OUTPUT_FORMATS as readonly string[]).includes(value);
}

/** Trả về thông báo lỗi tiếng Việt nếu file không hợp lệ, ngược lại null. */
export function validateImageFile(file: { type: string; size: number }): string | null {
  if (!(ALLOWED_IMAGE_TYPES as readonly string[]).includes(file.type)) {
    return "Chỉ hỗ trợ ảnh định dạng JPEG, PNG hoặc WebP.";
  }
  if (file.size > MAX_IMAGE_SIZE) {
    return "Dung lượng ảnh vượt quá 30MB.";
  }
  return null;
}
