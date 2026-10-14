import { NextResponse } from "next/server";
import { errorResponse, uploadImageBase64, verifyAppKey } from "@/lib/kie";
import { validateImageFile } from "@/lib/kie-shared";

/**
 * POST /api/upload — nhận ảnh (multipart form-data, field "file"),
 * chuyển sang base64 và tải lên kie.ai, trả về { downloadUrl }.
 */
export async function POST(request: Request) {
  const denied = verifyAppKey(request);
  if (denied) return denied;

  try {
    const form = await request.formData();
    const file = form.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Thiếu file ảnh trong yêu cầu." }, { status: 400 });
    }

    const validationError = validateImageFile({ type: file.type, size: file.size });
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    const base64 = Buffer.from(await file.arrayBuffer()).toString("base64");
    const dataUrl = `data:${file.type};base64,${base64}`;
    const downloadUrl = await uploadImageBase64(dataUrl);

    return NextResponse.json({ downloadUrl });
  } catch (err) {
    return errorResponse(err);
  }
}
