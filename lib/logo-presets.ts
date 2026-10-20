/**
 * Thư viện prompt mẫu cho Logo Studio — bấm chip là append vào ô prompt.
 * Khuyến nghị: giữ prompt ngắn + cụ thể (tên thương hiệu, ngành, cảm xúc).
 */

export interface PromptPreset {
  label: string;
  text: string;
}

export interface PresetGroup {
  title: string;
  items: PromptPreset[];
}

/** Hậu tố "chuẩn hoá logo" appends khi chế độ tự tối ưu được bật. */
export const LOGO_CREATE_SUFFIX =
  "professional logo design, flat vector style, clean scalable shapes, high contrast, centered composition, isolated on plain background, no photorealistic textures, no extra text, no mockup";

export const LOGO_EDIT_SUFFIX =
  "keep the logo structure and brand accuracy, clean edges, crisp flat vector style, no unwanted extra elements, isolated on plain background";

export function buildLogoPrompt(base: string, suffix: string): string {
  const trimmed = base.trim().replace(/[,;\s]+$/, "");
  if (!trimmed) return "";
  if (trimmed.toLowerCase().includes("professional logo design")) return trimmed;
  return `${trimmed}, ${suffix}`;
}

export const LOGO_PRESET_GROUPS: PresetGroup[] = [
  {
    title: "Kiểu logo",
    items: [
      { label: "Wordmark", text: "wordmark logo, brand name typography as the entire logo, elegant custom lettering" },
      { label: "Lettermark", text: "lettermark logo using brand initials, refined monogram typography" },
      { label: "Emblem/badge", text: "emblem badge logo, circular seal composition, classic crest details" },
      { label: "Mascot", text: "mascot logo, friendly character head, bold outlines, esports style" },
      { label: "Dấu trừu tượng", text: "abstract geometric mark, symbolic shapes, unique memorable silhouette" },
      { label: "Kết hợp", text: "combination mark, simple icon plus wordmark, balanced horizontal lockup" },
    ],
  },
  {
    title: "Phong cách",
    items: [
      { label: "Tối giản phẳng", text: "flat vector style, minimal shapes, clean solid colors, no gradients" },
      { label: "Line art", text: "single-weight line art logo, outline only, airy negative space" },
      { label: "Đơn sắc", text: "monochrome black logo, single color, strong contrast" },
      { label: "Gradient hiện đại", text: "modern gradient fill, smooth two-color transition, tech startup feel" },
      { label: "Vintage", text: "vintage retro logo, classic badge texture, muted palette" },
      { label: "Tối giản + icon", text: "minimalist icon logo, one clever negative-space idea, instantly recognizable" },
    ],
  },
  {
    title: "Nền & trình bày",
    items: [
      { label: "Nền trắng", text: "isolated on pure white background, no mockup, no extra elements" },
      { label: "Sẵn cho nền trong suốt", text: "designed for transparent background, no background fill" },
      { label: "Trên nền tối", text: "logo presented on solid dark background, colors pop" },
    ],
  },
  {
    title: "Ngành nghề (ví dụ)",
    items: [
      { label: "Cà phê", text: "logo for a specialty coffee shop, warm earthy palette, coffee bean or cup motif" },
      { label: "Gym/fitness", text: "logo for a modern gym, powerful bold shapes, energy and strength" },
      { label: "Công nghệ", text: "logo for a tech startup, geometric pixel-inspired mark, futuristic" },
      { label: "Thời trang", text: "logo for a fashion label, sophisticated minimal serif typography" },
      { label: "Nhà hàng", text: "logo for a restaurant, elegant utensil or flame motif, premium feel" },
      { label: "Esports", text: "esports team logo, aggressive mascot emblem, neon accents" },
      { label: "Làm đẹp", text: "logo for a beauty brand, soft elegant curves, floral or leaf accent" },
      { label: "Thú cưng", text: "logo for a pet shop, playful paw or animal silhouette, friendly" },
    ],
  },
];
