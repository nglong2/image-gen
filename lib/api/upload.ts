import { apiFetch } from "./client";

/** POST /api/upload — tải file (ảnh/video) lên kie.ai, trả về downloadUrl để đưa vào generate. */
export function uploadFile(appKey: string, file: File): Promise<{ downloadUrl: string }> {
  const formData = new FormData();
  formData.append("file", file);
  return apiFetch<{ downloadUrl: string }>("/api/upload", {
    appKey,
    method: "POST",
    formData,
  });
}
