/**
 * Ước tính credit theo BẢNG GIÁ CHÍNH THỨC kie.ai (kie.ai/pricing + trang model),
 * tính theo MODEL (mọi version Seedance/Seedream).
 *
 * Đối chiếu test thật (recordInfo.creditsConsumed):
 *  - v1 Pro 480p/5s = 2,8×5 = 14 ✅ measured 14 · 720p/5s = 6×5 = 30 ✅ measured 30
 *  - Seedream 5 Pro: 1K=7, 2K=14 credit/ảnh (ảnh input đầu tiên free)
 *  - Quy đổi: 1 credit = $0.005
 */

export type EstimateSource = "official" | "rough";

export interface CreditEstimate {
  min: number;
  max: number;
  source: EstimateSource;
}

export const CREDIT_USD = 0.005;

/** Giá video: credit/giây theo resolution (bảng chính thức — cột "no video input" cho T2V/I2V). */
const VIDEO_RATES: Record<string, Record<string, number>> = {
  "bytedance/v1-pro-text-to-video": { "480p": 2.8, "720p": 6, "1080p": 14 },
  "bytedance/v1-pro-image-to-video": { "480p": 2.8, "720p": 6, "1080p": 14 },
  "bytedance/v1-pro-fast-image-to-video": { "480p": 2.8, "720p": 6, "1080p": 14 },
  "bytedance/v1-lite-text-to-video": { "480p": 2, "720p": 4.5, "1080p": 10 },
  "bytedance/seedance-1.5-pro": { "480p": 1.75, "720p": 3.5, "1080p": 7.5 },
  "bytedance/seedance-2-mini": { "480p": 3.8, "720p": 8.2 },
  "bytedance/seedance-2-fast": { "480p": 11.7, "720p": 24.8 },
  "bytedance/seedance-2-5": { "480p": 28, "720p": 63, "1080p": 158 },
  "grok-imagine/text-to-video": { "480p": 2.4, "720p": 4.5, "1080p": 8 },
  "grok-imagine/image-to-video": { "480p": 2.4, "720p": 4.5, "1080p": 8 },
  "grok-imagine-video-1-5-preview": { "480p": 2.4, "720p": 4.5, "1080p": 8 },
};

/**
 * Bảng giá "WITH video input" (chỉ dùng khi CÓ video ref — Seedance 2.x):
 * credit = giá_with × (thời lượng video ref + thời lượng tạo).
 * Nguồn: kie.ai/pricing (cột with video).
 */
const VIDEO_RATES_WITH_REF: Record<string, Record<string, number>> = {
  "bytedance/seedance-2-mini": { "480p": 2.4, "720p": 5 },
  "bytedance/seedance-2-fast": { "480p": 6.8, "720p": 15 },
  "bytedance/seedance-2-5": { "480p": 17, "720p": 38, "1080p": 95 },
};

/** Giá ảnh: credit/ảnh (number = giá cố định; record = theo quality). */
const IMAGE_PRICES: Record<string, number | Record<string, number>> = {
  "seedream/5-pro-image-to-image": { basic: 7, high: 14 },
  "seedream/5-flash-image-to-image": 3.24,
  "seedream/5-lite-image-to-image": 5.5,
  "seedream/4.5-edit": 6.5,
  "bytedance/seedream-v4-edit": 5, // 5 credit/ảnh × max_images
  "seedream/5-pro-text-to-image": { basic: 7, high: 14 },
  "seedream/5-flash-text-to-image": 3.24,
  "seedream/5-lite-text-to-image": 5.5,
  "seedream/4.5-text-to-image": 6.5,
  "bytedance/seedream": 3.5, // Seedream3.0
  "grok-imagine/text-to-image": 4, // đo thật:4 credit/task (Grok trả2 ảnh/task)
  "grok-imagine/image-to-image": 4, // đo thật
};

function roundCredit(value: number): number {
  return Math.round(value * 100) / 100;
}

export function estimateCredits(
  model: string,
  options: Record<string, string | boolean>,
  refVideoSeconds = 0,
  videoRefMode = false,
): CreditEstimate {
  const rates = VIDEO_RATES[model];
  if (rates) {
    // Tool "video+ảnh → video": luôn tính theo bảng WITH video (khi có video ref)
    const withRef = videoRefMode ? VIDEO_RATES_WITH_REF[model] : undefined;
    const table = withRef ?? rates;
    const resolution = String(options.resolution ?? "720p");
    const perSecond = table[resolution] ?? table["720p"] ?? Object.values(table)[0];
    if (perSecond === undefined) return { min: 5, max: 60, source: "rough" };
    const duration = Number(options.duration ?? 5);
    const durationSafe = Number.isFinite(duration) && duration > 0 ? duration : 5;
    // Công thức kie: with-video = giá_with × (input + output); no-video = giá × output
    const seconds = withRef || refVideoSeconds > 0 ? durationSafe + refVideoSeconds : durationSafe;
    const estimate = roundCredit(perSecond * seconds);
    return { min: estimate, max: estimate, source: "official" };
  }

  const imagePrice = IMAGE_PRICES[model];
  if (typeof imagePrice === "number") {
    if (model === "bytedance/seedream-v4-edit") {
      const maxImages = Number(options.max_images ?? 1);
      const safeMax = Number.isFinite(maxImages) && maxImages >= 1 ? Math.round(maxImages) : 1;
      return { min: imagePrice, max: roundCredit(imagePrice * safeMax), source: "official" };
    }
    return { min: imagePrice, max: imagePrice, source: "official" };
  }
  if (imagePrice && typeof imagePrice === "object") {
    const quality = String(options.quality ?? "basic");
    const estimate = imagePrice[quality] ?? imagePrice.basic;
    if (estimate !== undefined) return { min: estimate, max: estimate, source: "official" };
  }

  return { min: 1, max: 60, source: "rough" };
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : String(value);
}

export function estimateLabel(estimate: CreditEstimate): string {
  const range =
    estimate.min === estimate.max
      ? formatNumber(estimate.min)
      : `${formatNumber(estimate.min)}–${formatNumber(estimate.max)}`;
  const usd = (value: number) =>
    `$${(value * CREDIT_USD).toFixed(3).replace(/0+$/, "").replace(/\.$/, "")}`;
  const usdText =
    estimate.min === estimate.max
      ? ` (~${usd(estimate.min)})`
      : ` (~${usd(estimate.min)}–${usd(estimate.max)})`;
  return `≈ ${range} credit${usdText}`;
}

export function estimateSourceLabel(estimate: CreditEstimate): string {
  if (estimate.source === "official") return "theo bảng giá chính thức kie.ai";
  return "ước tính thô, chưa có giá chính thức";
}
