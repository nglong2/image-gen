import { NextResponse } from "next/server";
import { createTask, errorResponse, verifyAppKey } from "@/lib/kie";
import { getTool, resolveToolConfig } from "@/lib/tools";

interface GenerateBody {
  tool?: unknown;
  model?: unknown;
  prompt?: unknown;
  imageUrls?: unknown;
  refImageUrls?: unknown;
  refVideoUrls?: unknown;
  options?: unknown;
  nsfwChecker?: unknown;
}

function badRequest(error: string): NextResponse {
  return NextResponse.json({ error }, { status: 400 });
}

function isHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * POST /api/generate — tạo task chung theo tool registry:
 * { tool, model?, prompt, imageUrls?, options?, nsfwChecker? } → { taskId }
 */
export async function POST(request: Request) {
  const denied = verifyAppKey(request);
  if (denied) return denied;

  try {
    let body: GenerateBody;
    try {
      body = (await request.json()) as GenerateBody;
    } catch {
      return badRequest("Body JSON không hợp lệ.");
    }

    const tool = typeof body.tool === "string" ? getTool(body.tool) : null;
    if (!tool) return badRequest(`Tool không hợp lệ: ${String(body.tool ?? "(thiếu)")}`);

    const model = body.model == null ? tool.defaultModel : String(body.model);
    if (!tool.models.some((option) => option.value === model)) {
      return badRequest(`Model không hợp lệ cho công cụ "${tool.slug}": ${model}`);
    }
    const resolved = resolveToolConfig(tool, model);

    const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
    if (prompt.length < resolved.prompt.min) {
      return badRequest(`Prompt cần ít nhất ${resolved.prompt.min} ký tự.`);
    }
    if (prompt.length > resolved.prompt.max) {
      return badRequest(`Prompt tối đa ${resolved.prompt.max} ký tự.`);
    }

    // Validate options theo config HIỆU LỰC của model đã chọn
    const rawOptions =
      body.options && typeof body.options === "object" && !Array.isArray(body.options)
        ? (body.options as Record<string, unknown>)
        : {};
    const options: Record<string, string | boolean | number> = {};
    for (const spec of resolved.options) {
      const value = rawOptions[spec.key];
      if (value === undefined || value === null || value === "") {
        options[spec.key] = spec.defaultValue;
        continue;
      }
      if (spec.type === "checkbox") {
        if (typeof value !== "boolean") return badRequest(`Option "${spec.key}" phải là boolean.`);
        options[spec.key] = value;
        continue;
      }
      if (spec.type === "range") {
        const range = spec.range;
        const numeric = Number(value);
        if (
          !range ||
          typeof value !== "string" ||
          !Number.isFinite(numeric) ||
          numeric < range.min ||
          numeric > range.max
        ) {
          return badRequest(
            range
              ? `Option "${spec.key}" phải trong khoảng ${range.min}–${range.max}.`
              : `Option "${spec.key}" chưa được cấu hình khoảng giá trị.`,
          );
        }
        options[spec.key] = range.asNumber ? Math.round(numeric) : String(Math.round(numeric));
        continue;
      }
      if (typeof value !== "string" || !spec.choices?.some((choice) => choice.value === value)) {
        return badRequest(`Option "${spec.key}" không hợp lệ: ${JSON.stringify(value)}`);
      }
      options[spec.key] = value;
    }

    const nsfwChecker = body.nsfwChecker ?? false;
    if (typeof nsfwChecker !== "boolean") return badRequest("nsfwChecker phải là boolean.");

    const input: Record<string, unknown> = { prompt, ...options, nsfw_checker: nsfwChecker };

    const pickUrls = (value: unknown): string[] =>
      Array.isArray(value)
        ? value.filter((url): url is string => typeof url === "string" && url.length > 0)
        : [];
    const imageUrls = pickUrls(body.imageUrls);
    const refImageUrls = pickUrls(body.refImageUrls);
    const refVideoUrls = pickUrls(body.refVideoUrls);

    // Hỗ trợ ref theo model (Seedance 1.5/2.x)
    if (tool.requireVideoInput && refVideoUrls.length === 0) {
      return badRequest(`Công cụ "${tool.title}" cần ít nhất 1 VIDEO đầu vào.`);
    }
    if (refImageUrls.length > 0 && !resolved.refImagesField) {
      return badRequest(`Model "${model}" không hỗ trợ ảnh ref thêm.`);
    }
    if (refVideoUrls.length > 0 && !resolved.refVideoField) {
      return badRequest(
        `Công cụ này không hỗ trợ video ref — hãy dùng công cụ "Video → Video" hoặc "Video + Ảnh → Video".`,
      );
    }
    if (resolved.refImagesMax && refImageUrls.length > resolved.refImagesMax) {
      return badRequest(`Tối đa ${resolved.refImagesMax} ảnh ref cho model này.`);
    }
    if (resolved.refVideoMax && refVideoUrls.length > resolved.refVideoMax) {
      return badRequest(`Tối đa ${resolved.refVideoMax} video ref cho model này.`);
    }

    // Validate URL cho mọi media đầu vào (ảnh chính + ref ảnh + ref video)
    for (const url of [...imageUrls, ...refImageUrls, ...refVideoUrls]) {
      if (!isHttpUrl(url)) return badRequest(`URL không hợp lệ: ${url}`);
    }
    if (tool.inputKind === "image") {
      if (imageUrls.length === 0 && refImageUrls.length === 0 && refVideoUrls.length === 0) {
        return badRequest("Cần ít nhất 1 ảnh đầu vào (hoặc ref ảnh/video).");
      }
      if (imageUrls.length > 10) return badRequest("Tối đa 10 ảnh đầu vào.");
    }

    const useRefMode = refImageUrls.length > 0 || refVideoUrls.length > 0;
    if (useRefMode) {
      // Chế độ multimodal reference: mọi ảnh gộp vào ref field, KHÔNG dùng first_frame
      // (Seedance 2.x: first-frame và multimodal ref là hai kịch bản loại trừ nhau)
      const allImages = [...imageUrls, ...refImageUrls];
      if (resolved.refImagesField) {
        const max = resolved.refImagesMax ?? 30;
        if (allImages.length > max) {
          return badRequest(`Tối đa ${max} ảnh khi dùng ref cho model này.`);
        }
        if (allImages.length > 0) {
          input[resolved.refImagesField] =
            resolved.refImagesAsArray === false ? allImages[0] : allImages;
        }
      } else if (imageUrls.length > 0) {
        input[resolved.imageField] = resolved.imageAsArray ? imageUrls : imageUrls[0];
      }
      if (refVideoUrls.length > 0 && resolved.refVideoField) {
        input[resolved.refVideoField] = refVideoUrls;
      }
    } else if (resolved.imageField && imageUrls.length > 0) {
      input[resolved.imageField] = resolved.imageAsArray ? imageUrls : imageUrls[0];
    }

    const taskId = await createTask(model, input);
    return NextResponse.json({ taskId });
  } catch (err) {
    return errorResponse(err);
  }
}
