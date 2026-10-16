import { NextResponse } from "next/server";
import { verifyAppKey } from "@/lib/kie";
import {
  isR2Configured,
  putHistory,
  putResultObject,
  resultKey,
  type HistoryMedia,
  type HistoryMeta,
} from "@/lib/r2";

const EXT_BY_TYPE: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov",
  "audio/mpeg": "mp3",
  "audio/wav": "wav",
};

interface SaveBody {
  taskId?: unknown;
  tool?: unknown;
  model?: unknown;
  prompt?: unknown;
  resultKind?: unknown;
  credits?: unknown;
  createdAt?: unknown;
  sourceUrls?: unknown;
}

/**
 * POST /api/history/save — khi gen xong:
 * copy media từ kie.ai (URL hết hạn sau14 ngày) vào R2 + lưu metadata JSON.
 * Best-effort: copy lỗi từng file không làm hỏng cả mục.
 */
export async function POST(request: Request) {
  const denied = verifyAppKey(request);
  if (denied) return denied;
  if (!isR2Configured()) {
    return NextResponse.json(
      { error: "Chưa cấu hình Cloudflare R2 trong .env.local — bỏ qua lưu lịch sử." },
      { status: 503 },
    );
  }

  try {
    let body: SaveBody;
    try {
      body = (await request.json()) as SaveBody;
    } catch {
      return NextResponse.json({ error: "Body JSON không hợp lệ." }, { status: 400 });
    }

    const taskId = typeof body.taskId === "string" ? body.taskId : "";
    if (!/^[a-zA-Z0-9_-]{1,80}$/.test(taskId)) {
      return NextResponse.json({ error: "taskId không hợp lệ." }, { status: 400 });
    }
    const resultKind = body.resultKind === "video" ? "video" : body.resultKind === "image" ? "image" : null;
    if (!resultKind) return NextResponse.json({ error: "resultKind không hợp lệ." }, { status: 400 });
    const sourceUrls = Array.isArray(body.sourceUrls)
      ? body.sourceUrls.filter((url): url is string => typeof url === "string" && url.startsWith("http"))
      : [];
    if (sourceUrls.length === 0) {
      return NextResponse.json({ error: "Thiếu sourceUrls." }, { status: 400 });
    }
    if (sourceUrls.length > 5) {
      return NextResponse.json({ error: "Tối đa 5 file mỗi lần lưu lịch sử." }, { status: 400 });
    }

    // Copy media sang R2 (fail từng file thì giữ URL nguồn làm dự phòng)
    const media: HistoryMedia[] = [];
    const mediaErrors: string[] = [];
    for (let index = 0; index < sourceUrls.length; index += 1) {
      const url = sourceUrls[index];
      try {
        const res = await fetch(url, { signal: AbortSignal.timeout(120_000) });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const contentLength = Number(res.headers.get("content-length") ?? 0);
        if (contentLength > 512 * 1024 * 1024) throw new Error("file quá lớn (>512MB)");
        const contentType = (res.headers.get("content-type") ?? "").split(";")[0].trim();
        const ext = EXT_BY_TYPE[contentType] ?? (resultKind === "video" ? "mp4" : "png");
        const bytes = new Uint8Array(await res.arrayBuffer());
        const key = resultKey(taskId, index, ext);
        await putResultObject(key, bytes, contentType || "application/octet-stream");
        media.push({ key, contentType: contentType || (resultKind === "video" ? "video/mp4" : "image/png") });
      } catch (err) {
        mediaErrors.push(`${url}: ${err instanceof Error ? err.message : "copy lỗi"}`);
      }
    }

    const meta: HistoryMeta = {
      taskId,
      tool: typeof body.tool === "string" ? body.tool : "unknown",
      model: typeof body.model === "string" ? body.model : "unknown",
      prompt: typeof body.prompt === "string" ? body.prompt.slice(0, 4000) : "",
      resultKind,
      credits: typeof body.credits === "number" ? body.credits : undefined,
      createdAt: typeof body.createdAt === "number" ? body.createdAt : Date.now(),
      savedAt: Date.now(),
      media,
      sourceUrls,
    };
    await putHistory(meta);

    return NextResponse.json({ saved: true, mediaCount: media.length, mediaErrors });
  } catch (err) {
    console.error("[history/save]", err);
    const detail = err instanceof Error ? err.message : "không rõ";
    return NextResponse.json({ error: `Lưu lịch sử thất bại: ${detail}` }, { status: 502 });
  }
}
