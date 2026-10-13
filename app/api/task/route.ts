import { NextResponse } from "next/server";
import { errorResponse, getTaskStatus } from "@/lib/kie";

/**
 * GET /api/task?taskId=... — truy vấn trạng thái task,
 * trả về { state, resultUrls, failMsg? }.
 */
export async function GET(request: Request) {
  // Đọc request.url ngoài try/catch để Next xử lý bail-out prerender im lặng
  const taskId = new URL(request.url).searchParams.get("taskId");
  if (!taskId) {
    return NextResponse.json({ error: "Thiếu tham số taskId." }, { status: 400 });
  }

  try {
    const status = await getTaskStatus(taskId);
    return NextResponse.json(status);
  } catch (err) {
    return errorResponse(err);
  }
}
