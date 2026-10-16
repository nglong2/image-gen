import { NextResponse } from "next/server";
import { KIE_UPLOAD_BASE, KieApiError, errorResponse, kieErrorMessage, verifyAppKey } from "@/lib/kie";
import { validateImageFile } from "@/lib/kie-shared";

/** Video ref Seedance 2.5 cho phép tới 200MB (2.0 là 50MB — kie sẽ reject lúc chạy, fail free). */
const MAX_VIDEO_SIZE = 200 * 1024 * 1024;
const ALLOWED_VIDEO_TYPES = ["video/mp4", "video/webm", "video/quicktime"];

interface StreamUploadResponse {
  code?: number;
  msg?: string;
  data?: { downloadUrl?: string };
}

/**
 * POST /api/upload — nhận file (multipart, field "file"):
 *  - ảnh JPEG/PNG/WebP ≤30MB  ·  video MP4/MOV/WebM ≤200MB
 * Forward dạng stream (multipart) sang kie.ai → trả { downloadUrl }.
 */
export async function POST(request: Request) {
  const denied = verifyAppKey(request);
  if (denied) return denied;

  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Thiếu file trong yêu cầu." }, { status: 400 });
    }

    const isVideo = ALLOWED_VIDEO_TYPES.includes(file.type);
    if (isVideo) {
      if (file.size > MAX_VIDEO_SIZE) {
        return NextResponse.json({ error: "Video vượt quá 200MB." }, { status: 400 });
      }
    } else {
      const imageError = validateImageFile({ type: file.type, size: file.size });
      if (imageError) {
        return NextResponse.json(
          { error: `${imageError} (chấp nhận thêm MP4/MOV/WebM cho video ref)` },
          { status: 400 },
        );
      }
    }

    const apiKey = process.env.KIE_API_KEY?.trim();
    if (!apiKey) {
      throw new KieApiError(401, "Chưa cấu hình KIE_API_KEY trong file .env.local.");
    }

    // Stream upload — tránh overhead base64, hỗ trợ file lớn/video
    const forward = new FormData();
    forward.append("file", file, file.name || (isVideo ? "ref.mp4" : "upload.png"));
    forward.append("uploadPath", isVideo ? "videos/user-uploads" : "images/user-uploads");

    const res = await fetch(`${KIE_UPLOAD_BASE}/api/file-stream-upload`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: forward,
      cache: "no-store",
    });

    let body: StreamUploadResponse | null = null;
    try {
      body = (await res.json()) as StreamUploadResponse;
    } catch {
      throw new KieApiError(res.status, `Phản hồi không hợp lệ từ kie.ai (HTTP ${res.status}).`);
    }

    const code = typeof body?.code === "number" ? body.code : res.status;
    if (!res.ok || code !== 200) {
      throw new KieApiError(code, kieErrorMessage(code, body?.msg));
    }
    if (!body?.data?.downloadUrl) {
      throw new KieApiError(500, "Tải file lên kie.ai thành công nhưng không trả về URL.");
    }

    return NextResponse.json({ downloadUrl: body.data.downloadUrl });
  } catch (err) {
    return errorResponse(err);
  }
}
