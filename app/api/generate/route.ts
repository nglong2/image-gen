import { NextResponse } from "next/server";
import { createImageTask, errorResponse } from "@/lib/kie";
import {
  PROMPT_MAX,
  PROMPT_MIN,
  isAspectRatio,
  isOutputFormat,
  isQuality,
} from "@/lib/kie-shared";

interface GenerateBody {
  prompt?: unknown;
  image_urls?: unknown;
  aspect_ratio?: unknown;
  quality?: unknown;
  output_format?: unknown;
}

/**
 * POST /api/generate — tạo task chỉnh sửa ảnh (Seedream 5.0 Pro),
 * trả về { taskId } để poll qua GET /api/task.
 */
export async function POST(request: Request) {
  try {
    let body: GenerateBody;
    try {
      body = (await request.json()) as GenerateBody;
    } catch {
      return NextResponse.json({ error: "Body JSON không hợp lệ." }, { status: 400 });
    }

    const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
    if (prompt.length < PROMPT_MIN) {
      return NextResponse.json(
        { error: `Prompt cần ít nhất ${PROMPT_MIN} ký tự.` },
        { status: 400 },
      );
    }
    if (prompt.length > PROMPT_MAX) {
      return NextResponse.json(
        { error: `Prompt tối đa ${PROMPT_MAX} ký tự.` },
        { status: 400 },
      );
    }

    const imageUrls = Array.isArray(body.image_urls)
      ? body.image_urls.filter((url): url is string => typeof url === "string" && url.length > 0)
      : [];
    if (imageUrls.length === 0) {
      return NextResponse.json({ error: "Cần ít nhất 1 URL ảnh đầu vào." }, { status: 400 });
    }
    if (imageUrls.length > 10) {
      return NextResponse.json({ error: "Tối đa 10 ảnh đầu vào." }, { status: 400 });
    }
    for (const url of imageUrls) {
      try {
        const parsed = new URL(url);
        if (parsed.protocol !== "http:" && parsed.protocol !== "https:") throw new Error();
      } catch {
        return NextResponse.json({ error: `URL ảnh không hợp lệ: ${url}` }, { status: 400 });
      }
    }

    if (!isAspectRatio(body.aspect_ratio)) {
      return NextResponse.json({ error: "aspect_ratio không hợp lệ." }, { status: 400 });
    }
    if (!isQuality(body.quality)) {
      return NextResponse.json({ error: "quality không hợp lệ (basic | high)." }, { status: 400 });
    }
    const outputFormat = body.output_format ?? "png";
    if (!isOutputFormat(outputFormat)) {
      return NextResponse.json({ error: "output_format không hợp lệ (png | jpeg)." }, { status: 400 });
    }

    const taskId = await createImageTask({
      prompt,
      imageUrls,
      aspectRatio: body.aspect_ratio,
      quality: body.quality,
      outputFormat,
    });

    return NextResponse.json({ taskId });
  } catch (err) {
    return errorResponse(err);
  }
}
