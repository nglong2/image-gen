import { NextResponse } from "next/server";
import { verifyAppKey } from "@/lib/kie";
import { deleteHistory, isR2Configured, listHistory, mediaUrl, type HistoryMeta } from "@/lib/r2";

function r2Error(err: unknown, fallback: string): NextResponse {
  if (err instanceof Error && /not configured/i.test(err.message)) {
    return NextResponse.json({ error: err.message }, { status: 503 });
  }
  console.error("[history]", err);
  const detail = err instanceof Error ? err.message : fallback;
  return NextResponse.json({ error: `Lỗi R2: ${detail}` }, { status: 502 });
}

/**
 * GET  /api/history          → danh sách lịch sử gen (mới nhất trước, kèm URL xem media)
 * DELETE /api/history?taskId= → xoá1 mục khỏi R2
 */
export async function GET(request: Request) {
  const denied = verifyAppKey(request);
  if (denied) return denied;
  if (!isR2Configured()) {
    return NextResponse.json(
      {
        error:
          "Chưa cấu hình Cloudflare R2. Điền R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET vào .env.local rồi restart server.",
      },
      { status: 503 },
    );
  }

  try {
    const limit = Number(new URL(request.url).searchParams.get("limit") ?? 60);
    const metas = await listHistory(Number.isFinite(limit) ? Math.min(Math.max(limit, 1), 200) : 60);
    const items = await Promise.all(
      metas.map(async (meta: HistoryMeta) => ({
        ...meta,
        urls: await Promise.all(meta.media.map((item) => mediaUrl(item.key))),
      })),
    );
    return NextResponse.json({ items });
  } catch (err) {
    return r2Error(err, "Không đọc được lịch sử từ R2.");
  }
}

export async function DELETE(request: Request) {
  const denied = verifyAppKey(request);
  if (denied) return denied;
  if (!isR2Configured()) {
    return NextResponse.json({ error: "Chưa cấu hình Cloudflare R2 trong .env.local." }, { status: 503 });
  }

  const taskId = new URL(request.url).searchParams.get("taskId");
  if (!taskId || !/^[a-zA-Z0-9_-]{1,80}$/.test(taskId)) {
    return NextResponse.json({ error: "taskId không hợp lệ." }, { status: 400 });
  }

  try {
    const deleted = await deleteHistory(taskId);
    if (!deleted) return NextResponse.json({ error: "Không tìm thấy mục này." }, { status: 404 });
    return NextResponse.json({ deleted: true });
  } catch (err) {
    return r2Error(err, "Không xoá được mục khỏi R2.");
  }
}
