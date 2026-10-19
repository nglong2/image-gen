/**
 * Registry công cụ — mở đủ version Seedance (video) & Seedream (ảnh).
 * Giá credit tham chiếu bảng chính thức kie.ai/pricing + trang model.
 *
 * Mỗi model có thể override: field ảnh (image_url/input_urls/first_frame_url),
 * danh sách options và giới hạn prompt — vì các version dùng param khác nhau.
 */

export interface OptionChoice {
  value: string;
  label: string;
}

export interface OptionSpec {
  /** Tên field trong `input` của API kie.ai (vd: aspect_ratio, duration) */
  key: string;
  label: string;
  type: "select" | "checkbox" | "range";
  choices?: OptionChoice[];
  /** Cấu hình thanh trượt (type = "range"); asNumber = gửi số thay vì chuỗi */
  range?: { min: number; max: number; step: number; unit?: string; asNumber?: boolean };
  defaultValue: string | boolean;
  hint?: string;
}

export interface ModelOption {
  value: string;
  label: string;
  overrides?: {
    imageField?: string;
    imageAsArray?: boolean;
    refImagesField?: string;
    refImagesAsArray?: boolean;
    refImagesMax?: number;
    refVideoField?: string;
    refVideoMax?: number;
    refVideoSecondsHint?: string;
    options?: OptionSpec[];
    prompt?: { min: number; max: number };
  };
}

export type ToolResultKind = "image" | "video";
export type ToolInputKind = "none" | "image" | "video";

export interface ToolConfig {
  slug: string;
  title: string;
  description: string;
  resultKind: ToolResultKind;
  inputKind: ToolInputKind;
  /** Tool này BẮT BUỘC có video đầu vào (vd: video+ảnh → video) */
  requireVideoInput?: boolean;
  imageField: string;
  imageAsArray: boolean;
  models: ModelOption[];
  defaultModel: string;
  prompt: { min: number; max: number };
  options: OptionSpec[];
}

export interface ResolvedToolConfig {
  model: string;
  imageField: string;
  imageAsArray: boolean;
  /** Chế độ multimodal ref (Seedance 1.5/2.x): ảnh ref thêm */
  refImagesField?: string;
  refImagesAsArray?: boolean;
  refImagesMax?: number;
  /** Video ref (Seedance 2.x) */
  refVideoField?: string;
  refVideoMax?: number;
  refVideoSecondsHint?: string;
  options: OptionSpec[];
  prompt: { min: number; max: number };
}

/** Lấy config hiệu lực theo model được chọn (override nếu có). */
export function resolveToolConfig(tool: ToolConfig, model: string): ResolvedToolConfig {
  const entry = tool.models.find((item) => item.value === model) ?? tool.models[0];
  const override = entry.overrides;
  return {
    model: entry.value,
    imageField: override?.imageField ?? tool.imageField,
    imageAsArray: override?.imageAsArray ?? tool.imageAsArray,
    refImagesField: override?.refImagesField,
    refImagesAsArray: override?.refImagesAsArray,
    refImagesMax: override?.refImagesMax,
    refVideoField: override?.refVideoField,
    refVideoMax: override?.refVideoMax,
    refVideoSecondsHint: override?.refVideoSecondsHint,
    options: override?.options ?? tool.options,
    prompt: override?.prompt ?? tool.prompt,
  };
}

/** Chốt options hợp lệ khi đổi model: range bị clamp, select sai giá trị → mặc định. */
export function sanitizeOptions(
  specs: OptionSpec[],
  values: Record<string, string | boolean>,
): Record<string, string | boolean> {
  const next: Record<string, string | boolean> = { ...values };
  for (const spec of specs) {
    const value = next[spec.key];
    if (spec.type === "range" && spec.range) {
      const numeric = Number(value ?? spec.defaultValue);
      const fallback = Number(spec.defaultValue);
      const safe = Number.isFinite(numeric) ? numeric : fallback;
      const clamped = Math.min(Math.max(Math.round(safe), spec.range.min), spec.range.max);
      next[spec.key] = String(clamped);
    } else if (spec.type === "select") {
      if (typeof value !== "string" || !spec.choices?.some((choice) => choice.value === value)) {
        next[spec.key] = String(spec.defaultValue);
      }
    } else if (typeof value !== "boolean") {
      next[spec.key] = spec.defaultValue;
    }
  }
  return next;
}

const ch = (values: string[], labels?: string[]): OptionChoice[] =>
  values.map((value, index) => ({ value, label: labels?.[index] ?? value }));

const ASPECT8 = ch(["1:1", "4:3", "3:4", "16:9", "9:16", "2:3", "3:2", "21:9"]);
const ASPECT6 = ch(["16:9", "9:16", "1:1", "4:3", "3:4", "21:9"]);
const ASPECT_ADAPTIVE = ch(["16:9", "4:3", "1:1", "3:4", "9:16", "21:9", "adaptive"]);
const RES_FULL = ch(["480p", "720p", "1080p"], [
  "480p (nhanh, rẻ nhất)",
  "720p (khuyên dùng)",
  "1080p (cao cấp)",
]);
const RES_LOW = ch(["480p", "720p"], ["480p (nhanh, rẻ nhất)", "720p (khuyên dùng)"]);
const RES_HI = ch(["720p", "1080p"], ["720p (khuyên dùng)", "1080p (cao cấp)"]);
const FORMATS = ch(["png", "jpeg"]);
const QUALITY_5PRO = ch(["basic", "high"], ["basic (1K)", "high (2K)"]);
const QUALITY_LITE = ch(["basic", "high", "ultra"], ["basic (2K)", "high (3K)", "ultra (4K)"]);
const QUALITY_45 = ch(["basic", "high"], ["basic (2K)", "high (4K)"]);
const SIZE_FLASH = ch(["1K", "1.5K", "2K"]);
const RES_124 = ch(["1K", "2K", "4K"]);
const IMAGE_SIZE_V4 = ch(
  [
    "square",
    "square_hd",
    "portrait_4_3",
    "portrait_3_2",
    "portrait_16_9",
    "landscape_4_3",
    "landscape_3_2",
    "landscape_16_9",
    "landscape_21_9",
  ],
  [
    "Square",
    "Square HD",
    "Portrait 3:4",
    "Portrait 2:3",
    "Portrait 9:16",
    "Landscape 4:3",
    "Landscape 3:2",
    "Landscape 16:9",
    "Landscape 21:9",
  ],
);

const aspectSpec = (choices: OptionChoice[], def = "16:9"): OptionSpec => ({
  key: "aspect_ratio",
  label: "Tỷ lệ khung hình",
  type: "select",
  choices,
  defaultValue: def,
});

const resSpec = (choices: OptionChoice[]): OptionSpec => ({
  key: "resolution",
  label: "Độ phân giải",
  type: "select",
  choices,
  defaultValue: "720p",
});

const durSpec = (min: number, max: number, asNumber: boolean): OptionSpec => ({
  key: "duration",
  label: "Thời lượng",
  type: "range",
  range: { min, max, step: 1, unit: "s", asNumber },
  defaultValue: String(min),
  hint: "Kéo để chọn thời lượng — giá credit tính theo giây. Nếu model không hỗ trợ giá trị đã chọn, task sẽ fail và KHÔNG bị trừ credit.",
});

const qualitySpec = (choices: OptionChoice[]): OptionSpec => ({
  key: "quality",
  label: "Chất lượng",
  type: "select",
  choices,
  defaultValue: "basic",
});

const formatSpec = (): OptionSpec => ({
  key: "output_format",
  label: "Định dạng",
  type: "select",
  choices: FORMATS,
  defaultValue: "png",
});

const GEN_AUDIO_SPEC: OptionSpec = {
  key: "generate_audio",
  label: "Tạo audio đồng bộ",
  type: "checkbox",
  defaultValue: false,
  hint: "Bật audio có thể làm tăng credit — tham khảo kie.ai/pricing.",
};

export const TOOLS: ToolConfig[] = [
  {
    slug: "text-to-video",
    title: "Text → Video",
    description: "Mô tả cảnh quay bằng chữ, Seedance tạo video có chuyển động.",
    resultKind: "video",
    inputKind: "none",
    imageField: "",
    imageAsArray: false,
    models: [
      { value: "bytedance/v1-pro-text-to-video", label: "Seedance 1.0 Pro" },
      { value: "bytedance/v1-lite-text-to-video", label: "Seedance 1.0 Lite (rẻ nhất, trước hay lỗi)" },
      {
        value: "bytedance/seedance-1.5-pro",
        label: "Seedance 1.5 Pro",
        overrides: {
          options: [aspectSpec(ASPECT6), resSpec(RES_FULL), durSpec(4, 12, true)],
          prompt: { min: 3, max: 20000 },
        },
      },
      {
        value: "bytedance/seedance-2-mini",
        label: "Seedance 2.0 Mini",
        overrides: {
          options: [aspectSpec(ASPECT6), resSpec(RES_LOW), durSpec(5, 15, true)],
          prompt: { min: 4, max: 20000 },
        },
      },
      {
        value: "bytedance/seedance-2-fast",
        label: "Seedance 2.0",
        overrides: {
          options: [aspectSpec(ASPECT6), resSpec(RES_LOW), durSpec(5, 15, true)],
          prompt: { min: 4, max: 20000 },
        },
      },
      {
        value: "bytedance/seedance-2-5",
        label: "Seedance 2.5 (mới nhất, tới 30s)",
        overrides: {
          options: [aspectSpec(ASPECT_ADAPTIVE), resSpec(RES_FULL), durSpec(5, 30, true), GEN_AUDIO_SPEC],
          prompt: { min: 4, max: 20480 },
        },
      },
    ],
    defaultModel: "bytedance/v1-pro-text-to-video",
    prompt: { min: 4, max: 10000 },
    options: [aspectSpec(ASPECT6), resSpec(RES_FULL), durSpec(5, 10, false)],
  },
  {
    slug: "image-to-video",
    title: "Ảnh → Video",
    description: "Chụp một ảnh tĩnh, Seedance animate thành video có chuyển động.",
    resultKind: "video",
    inputKind: "image",
    imageField: "image_url",
    imageAsArray: false,
    models: [
      { value: "bytedance/v1-pro-image-to-video", label: "Seedance 1.0 Pro" },
      {
        value: "bytedance/v1-pro-fast-image-to-video",
        label: "Seedance 1.0 Pro Fast (nhanh, 720p/1080p)",
        overrides: { options: [resSpec(RES_HI), durSpec(5, 10, false)] },
      },
      {
        value: "bytedance/seedance-1.5-pro",
        label: "Seedance 1.5 Pro",
        overrides: {
          imageField: "input_urls",
          imageAsArray: true,
          refImagesField: "input_urls",
          refImagesAsArray: true,
          refImagesMax: 2,
          options: [aspectSpec(ASPECT6), resSpec(RES_FULL), durSpec(4, 12, true)],
          prompt: { min: 3, max: 20000 },
        },
      },
      {
        value: "bytedance/seedance-2-mini",
        label: "Seedance 2.0 Mini",
        overrides: {
          imageField: "first_frame_url",
          imageAsArray: false,
          refImagesField: "reference_image_urls",
          refImagesAsArray: true,
          refImagesMax: 9,
          options: [resSpec(RES_LOW), durSpec(5, 15, true)],
          prompt: { min: 4, max: 20000 },
        },
      },
      {
        value: "bytedance/seedance-2-fast",
        label: "Seedance 2.0",
        overrides: {
          imageField: "first_frame_url",
          imageAsArray: false,
          refImagesField: "reference_image_urls",
          refImagesAsArray: true,
          refImagesMax: 9,
          options: [resSpec(RES_LOW), durSpec(5, 15, true)],
          prompt: { min: 4, max: 20000 },
        },
      },
      {
        value: "bytedance/seedance-2-5",
        label: "Seedance 2.5 (mới nhất, tới 30s)",
        overrides: {
          imageField: "first_frame_url",
          imageAsArray: false,
          refImagesField: "reference_image_urls",
          refImagesAsArray: true,
          refImagesMax: 30,
          options: [resSpec(RES_FULL), durSpec(5, 30, true), GEN_AUDIO_SPEC],
          prompt: { min: 4, max: 20480 },
        },
      },
    ],
    defaultModel: "bytedance/v1-pro-image-to-video",
    prompt: { min: 4, max: 10000 },
    options: [resSpec(RES_FULL), durSpec(5, 10, false)],
  },

  {
    slug: "image-to-image",
    title: "Chỉnh sửa ảnh",
    description: "Tải ảnh lên, nhập prompt để AI chỉnh sửa ảnh (đủ version Seedream).",
    resultKind: "image",
    inputKind: "image",
    imageField: "image_urls",
    imageAsArray: true,
    models: [
      { value: "seedream/5-pro-image-to-image", label: "Seedream 5.0 Pro" },
      {
        value: "seedream/5-flash-image-to-image",
        label: "Seedream 5.0 Flash",
        overrides: {
          options: [
            aspectSpec(ASPECT8, "1:1"),
            { key: "size", label: "Độ phân giải", type: "select", choices: SIZE_FLASH, defaultValue: "1K" },
            formatSpec(),
          ],
        },
      },
      {
        value: "seedream/5-lite-image-to-image",
        label: "Seedream 5.0 Lite",
        overrides: {
          options: [aspectSpec(ASPECT8, "1:1"), qualitySpec(QUALITY_LITE), formatSpec()],
          prompt: { min: 4, max: 2995 },
        },
      },
      {
        value: "seedream/4.5-edit",
        label: "Seedream 4.5 Edit",
        overrides: {
          options: [aspectSpec(ASPECT8, "1:1"), qualitySpec(QUALITY_45)],
          prompt: { min: 4, max: 3000 },
        },
      },
      {
        value: "bytedance/seedream-v4-edit",
        label: "Seedream 4.0 Edit",
        overrides: {
          options: [
            { key: "image_size", label: "Khung ảnh", type: "select", choices: IMAGE_SIZE_V4, defaultValue: "square" },
            { key: "image_resolution", label: "Độ phân giải", type: "select", choices: RES_124, defaultValue: "1K" },
            { key: "max_images", label: "Số ảnh tối đa (1–6)", type: "range", range: { min: 1, max: 6, step: 1, asNumber: true }, defaultValue: "1", hint: "Giới hạn số ảnh một lần tạo — giá tính theo từng ảnh (5 credit/ảnh)." },
          ],
        },
      },
    ],
    defaultModel: "seedream/5-pro-image-to-image",
    prompt: { min: 4, max: 5000 },
    options: [aspectSpec(ASPECT8, "1:1"), qualitySpec(QUALITY_5PRO), formatSpec()],
  },
  {
    slug: "video-image-to-video",
    title: "Video + Ảnh → Video",
    description:
      "Chỉnh video có sẵn bằng ảnh ref + prompt (multimodal Seedance 2.x) — vd: đổi nón lưỡi trai thành nón len.",
    resultKind: "video",
    inputKind: "image",
    imageField: "first_frame_url",
    imageAsArray: false,
    requireVideoInput: true,
    models: [
      {
        value: "bytedance/seedance-2-mini",
        label: "Seedance 2.0 Mini",
        overrides: {
          refImagesField: "reference_image_urls",
          refImagesAsArray: true,
          refImagesMax: 9,
          refVideoField: "reference_video_urls",
          refVideoMax: 3,
          refVideoSecondsHint: "tổng video ref ≤15s",
          options: [resSpec(RES_LOW), durSpec(5, 15, true)],
          prompt: { min: 4, max: 20000 },
        },
      },
      {
        value: "bytedance/seedance-2-fast",
        label: "Seedance 2.0",
        overrides: {
          refImagesField: "reference_image_urls",
          refImagesAsArray: true,
          refImagesMax: 9,
          refVideoField: "reference_video_urls",
          refVideoMax: 3,
          refVideoSecondsHint: "tổng video ref ≤15s",
          options: [resSpec(RES_LOW), durSpec(5, 15, true)],
          prompt: { min: 4, max: 20000 },
        },
      },
      {
        value: "bytedance/seedance-2-5",
        label: "Seedance 2.5 (mới nhất, tới 30s)",
        overrides: {
          refImagesField: "reference_image_urls",
          refImagesAsArray: true,
          refImagesMax: 30,
          refVideoField: "reference_video_urls",
          refVideoMax: 10,
          refVideoSecondsHint: "tổng video ref ≤30s",
          options: [resSpec(RES_FULL), durSpec(5, 30, true), GEN_AUDIO_SPEC],
          prompt: { min: 4, max: 20480 },
        },
      },
    ],
    defaultModel: "bytedance/seedance-2-5",
    prompt: { min: 4, max: 10000 },
    options: [resSpec(RES_FULL), durSpec(5, 10, false)],
  },
  {
    slug: "video-to-video",
    title: "Video → Video",
    description:
      "Chỉnh video có sẵn theo prompt (multimodal Seedance 2.x) — vd: đổi phong cách, thay object, đổi bối cảnh… giữ nguyên chuyển động gốc.",
    resultKind: "video",
    inputKind: "video",
    imageField: "",
    imageAsArray: false,
    requireVideoInput: true,
    models: [
      {
        value: "bytedance/seedance-2-mini",
        label: "Seedance 2.0 Mini",
        overrides: {
          refImagesField: "reference_image_urls",
          refImagesAsArray: true,
          refImagesMax: 9,
          refVideoField: "reference_video_urls",
          refVideoMax: 3,
          refVideoSecondsHint: "tổng video ref ≤15s",
          options: [resSpec(RES_LOW), durSpec(5, 15, true)],
          prompt: { min: 4, max: 20000 },
        },
      },
      {
        value: "bytedance/seedance-2-fast",
        label: "Seedance 2.0",
        overrides: {
          refImagesField: "reference_image_urls",
          refImagesAsArray: true,
          refImagesMax: 9,
          refVideoField: "reference_video_urls",
          refVideoMax: 3,
          refVideoSecondsHint: "tổng video ref ≤15s",
          options: [resSpec(RES_LOW), durSpec(5, 15, true)],
          prompt: { min: 4, max: 20000 },
        },
      },
      {
        value: "bytedance/seedance-2-5",
        label: "Seedance 2.5 (mới nhất, tới 30s)",
        overrides: {
          refImagesField: "reference_image_urls",
          refImagesAsArray: true,
          refImagesMax: 30,
          refVideoField: "reference_video_urls",
          refVideoMax: 10,
          refVideoSecondsHint: "tổng video ref ≤30s",
          options: [resSpec(RES_FULL), durSpec(5, 30, true), GEN_AUDIO_SPEC],
          prompt: { min: 4, max: 20480 },
        },
      },
    ],
    defaultModel: "bytedance/seedance-2-5",
    prompt: { min: 4, max: 10000 },
    options: [resSpec(RES_FULL), durSpec(5, 10, false)],
  },
];

export function getTool(slug: string): ToolConfig | null {
  return TOOLS.find((tool) => tool.slug === slug) ?? null;
}

/** Như getTool nhưng ném lỗi nếu không có — để khai báo const có kiểu ToolConfig. */
export function requireTool(slug: string): ToolConfig {
  const tool = getTool(slug);
  if (!tool) throw new Error(`Tool "${slug}" chưa được đăng ký`);
  return tool;
}
